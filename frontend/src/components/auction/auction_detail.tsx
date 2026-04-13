import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { apiErrorMessage, authHeaders, getApiUrl, getSSEUrl, isFetchAborted, isRecord } from "../../lib/api";
import { deleteListing } from "../../lib/listingApi";
import { formatCurrency } from "../../lib/format";
import {
  computeServerSkewMs,
  formatCountdown,
  parseAuctionEndMsFromListing,
  parseTimeSyncPayload,
  remainingUntilEndMs,
} from "./auctionCountdown";
import "./auction_detail.css";

/** Payload from Redis → SSE `bid_update` events (see backend `ProcessBidWithTx`). */
interface BidUpdatePayload {
  auction_id: string;
  current_bid: number;
  highest_bidder: string;
}

function parseBidUpdatePayload(raw: string): BidUpdatePayload | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!isRecord(v)) return null;
    const auction_id = v.auction_id;
    const current_bid = v.current_bid;
    const highest_bidder = v.highest_bidder;
    if (typeof auction_id !== "string" || typeof highest_bidder !== "string") return null;
    const bid =
      typeof current_bid === "number"
        ? current_bid
        : typeof current_bid === "string"
          ? Number.parseFloat(current_bid)
          : NaN;
    if (!Number.isFinite(bid)) return null;
    return { auction_id, current_bid: bid, highest_bidder };
  } catch {
    return null;
  }
}

interface SingleListingResponse {
  listing_id: string;
  title: string;
  subtitle: string;
  description: string;
  images: string[];
  image: string;
  seller_id: string;
  seller_name: string;
  current_bid: number;
  starting_bid: number;
  buy_now_price?: number | null;
  total_bids: number;
  time_left: string;
  status: string;
  auction_end_time: string;
  is_seller: boolean;
  has_joined: boolean;
  is_highest_bidder: boolean;
  caller_last_bid?: number | null;
  location?: string;
  condition?: string;
  brand?: string;
}

const AuctionDetail: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();

  const listingId = useMemo(
    () => paramId || searchParams.get("id") || "",
    [paramId, searchParams],
  );

  const [listing, setListing] = useState<SingleListingResponse | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [bidAmount, setBidAmount] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoinedLocal, setHasJoinedLocal] = useState(false);
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [deletingListing, setDeletingListing] = useState(false);
  const bidInputRef = useRef<HTMLInputElement | null>(null);

  /** Live bid row from SSE (`/api/ws/auctions/:id`). */
  const [liveBid, setLiveBid] = useState<BidUpdatePayload | null>(null);
  const [liveBidEventCount, setLiveBidEventCount] = useState(0);
  const [sseStatus, setSseStatus] = useState<"idle" | "connecting" | "open" | "closed">("idle");

  /** When backend sends SSE `time_sync` (optional until backend ships it). */
  const [serverSkewMs, setServerSkewMs] = useState<number | null>(null);
  /** Prefer Unix end from `time_sync`; fallback computed from listing.auction_end_time. */
  const [auctionEndMs, setAuctionEndMs] = useState<number | null>(null);
  const [auctionEndedByServer, setAuctionEndedByServer] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    const fetchListing = async () => {
      if (!listingId) {
        setError("Listing ID is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setListing(null);

      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch(getApiUrl(`/api/listing?id=${encodeURIComponent(listingId)}`), {
          method: "GET",
          headers: authHeaders(token),
          signal,
        });

        const rawJson: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(apiErrorMessage(rawJson, "Failed to fetch listing"));
        }

        if (!isRecord(rawJson)) {
          throw new Error("Invalid listing response");
        }

        const imagesRaw = rawJson.images;
        const images = Array.isArray(imagesRaw)
          ? imagesRaw.filter((img): img is string => typeof img === "string")
          : [];

        const normalized: SingleListingResponse = {
          ...(rawJson as unknown as SingleListingResponse),
          images,
        };

        setListing(normalized);
        setSelectedImage(normalized.image || normalized.images[0] || "");
        setAuctionEndMs(parseAuctionEndMsFromListing(normalized.auction_end_time));
        setServerSkewMs(null);
        setAuctionEndedByServer(false);
        setHasJoinedLocal(normalized.has_joined);
        setBidError(null);
        setBidAmount("");
      } catch (err: unknown) {
        if (isFetchAborted(err)) return;
        setError(err instanceof Error ? err.message : "Failed to fetch listing");
        setListing(null);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchListing();
    return () => ac.abort();
  }, [listingId]);

  // Real-time: SSE GET /api/ws/auctions/{id} — bid_update (today); optional time_sync + auction_ended when backend adds them.
  useEffect(() => {
    setLiveBid(null);
    setLiveBidEventCount(0);
    setSseStatus("idle");

    if (!listingId || !listing) return;
    if (listing.listing_id !== listingId) return;
    if (listing.status.toLowerCase() !== "active") return;

    let es: EventSource | null = null;
    const url = getSSEUrl(`/api/ws/auctions/${encodeURIComponent(listingId)}`);
    setSseStatus("connecting");
    es = new EventSource(url);

    es.addEventListener("open", () => {
      setSseStatus("open");
    });

    es.addEventListener("time_sync", (ev: MessageEvent) => {
      const sync = parseTimeSyncPayload(String(ev.data));
      if (!sync || sync.auction_id !== listingId) return;
      const skew = computeServerSkewMs(sync.server_time, Date.now());
      if (skew != null) setServerSkewMs(skew);
      if (sync.auction_end_unix != null) {
        setAuctionEndMs(sync.auction_end_unix * 1000);
      }
    });

    es.addEventListener("auction_ended", (ev: MessageEvent) => {
      try {
        const raw = JSON.parse(String(ev.data)) as unknown;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const aid = (raw as { auction_id?: string }).auction_id;
          if (typeof aid === "string" && aid !== listingId) return;
        }
      } catch {
        /* accept event without body */
      }
      setAuctionEndedByServer(true);
    });

    es.addEventListener("bid_update", (ev: MessageEvent) => {
      const payload = parseBidUpdatePayload(String(ev.data));
      if (!payload) return;
      setLiveBid(payload);
      setLiveBidEventCount((n) => n + 1);
    });

    es.addEventListener("error", () => {
      setSseStatus("closed");
      es?.close();
      es = null;
    });

    return () => {
      es?.close();
      setSseStatus("closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect when auction id or active status changes, not on every listing field update
  }, [listingId, listing?.listing_id, listing?.status]);

  // Tick every second for countdown while auction is active on this page.
  useEffect(() => {
    if (!listing || listing.status.toLowerCase() !== "active" || auctionEndedByServer) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [listing, auctionEndedByServer]);

  if (loading) {
    return (
      <div className="auction-page">
        <main id="main-content">
          <p>Loading auction details...</p>
        </main>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="auction-page">
        <button type="button" className="auction-back" onClick={() => navigate(-1)}>
          Back
        </button>
        <main id="main-content">
          <p>{error || "Listing not found."}</p>
        </main>
      </div>
    );
  }

  const {
    title,
    subtitle,
    description,
    images,
    seller_name,
    current_bid,
    starting_bid,
    buy_now_price,
    total_bids,
    time_left,
    status,
    is_seller,
    has_joined,
    is_highest_bidder,
    caller_last_bid,
    location,
    condition,
    brand,
  } = listing;

  const hasJoinedAuction = has_joined || hasJoinedLocal;

  const displayCurrentBid = liveBid != null ? liveBid.current_bid : current_bid;
  const displayTotalBids = total_bids + liveBidEventCount;
  const displayIsHighestBidder =
    liveBid != null && user?.id ? user.id === liveBid.highest_bidder : is_highest_bidder;

  const endMs = auctionEndMs ?? parseAuctionEndMsFromListing(listing.auction_end_time);
  const remainingMs =
    endMs != null
      ? remainingUntilEndMs(endMs, Date.now() + tick * 0, serverSkewMs)
      : null;
  const clientCountdownEnded = remainingMs != null && remainingMs <= 0;
  const auctionInactive =
    status.toLowerCase() !== "active" || auctionEndedByServer || clientCountdownEnded;

  const displayTimeLeft =
    remainingMs != null && !auctionEndedByServer
      ? formatCountdown(remainingMs)
      : auctionEndedByServer || clientCountdownEnded
        ? "Ended"
        : time_left;

  const auctionStatusLabel = auctionInactive ? "Ended" : "Active";
  const canBid = !is_seller && !auctionInactive;

  // Decide primary call-to-action text based on backend participation state.
  let primaryCtaLabel = "Join auction";
  if (is_seller) {
    primaryCtaLabel = "Manage listing";
  } else if (hasJoinedAuction && displayIsHighestBidder) {
    primaryCtaLabel = "You are leading - raise max bid";
  } else if (hasJoinedAuction && !displayIsHighestBidder) {
    primaryCtaLabel = "Place higher bid";
  }

  const handlePrimaryAction = () => {
    if (!canBid || is_seller) return;
    if (!hasJoinedAuction) {
      setHasJoinedLocal(true);
      setBidError(null);
      window.setTimeout(() => bidInputRef.current?.focus(), 0);
      return;
    }
    bidInputRef.current?.focus();
  };

  const handleDeleteListing = async () => {
    if (!listingId) return;
    if (!window.confirm("Delete this listing permanently? This cannot be undone.")) return;
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/signin");
      return;
    }
    setDeletingListing(true);
    try {
      await deleteListing(listingId, token);
      navigate("/profile");
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Failed to delete listing");
    } finally {
      setDeletingListing(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!canBid || bidSubmitting) return;
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/signin");
      return;
    }

    const amount = Number.parseFloat(bidAmount);
    if (!Number.isFinite(amount)) {
      setBidError("Enter a valid bid amount.");
      return;
    }
    const minimumNextBid = Math.ceil(displayCurrentBid + 1);
    if (amount < minimumNextBid) {
      setBidError(`Bid must be at least ${formatCurrency(minimumNextBid)}.`);
      return;
    }

    setBidSubmitting(true);
    setBidError(null);
    try {
      const response = await fetch(getApiUrl(`/api/auctions/${encodeURIComponent(listingId)}/bid`), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ amount }),
      });
      const raw: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiErrorMessage(raw, "Failed to place bid"));
      }

      setBidAmount("");
      setHasJoinedLocal(true);
      if (user?.id) {
        setLiveBid({
          auction_id: listingId,
          current_bid: amount,
          highest_bidder: user.id,
        });
      }
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setBidSubmitting(false);
    }
  };

  const thumbLabel = (index: number) =>
    `Show image ${index + 1} of ${images.length} for ${title}`;

  return (
    <div className="auction-page">
      <button type="button" className="auction-back" onClick={() => navigate(-1)}>
        Back to results
      </button>

      <main id="main-content">
      <div className="auction-layout">
        <section className="auction-gallery" aria-label="Listing images">
          <div className="auction-main-image">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={title}
                width={800}
                height={533}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="auction-empty-image">No image available</div>
            )}
          </div>
          {images.length > 0 && (
            <div className="auction-thumbnails" role="group" aria-label="Image thumbnails">
              {images.map((img, index) => (
                <button
                  type="button"
                  key={`${img}-${index}`}
                  className="auction-thumb"
                  onClick={() => setSelectedImage(img)}
                  aria-label={thumbLabel(index)}
                  aria-pressed={selectedImage === img}
                >
                  <img src={img} alt="" width={70} height={70} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="auction-summary">
          <header className="auction-header">
            <h1>{title}</h1>
            <p className="auction-subtitle">{subtitle || description}</p>
            {!auctionInactive && (
              <p className="auction-live-row" aria-live="polite">
                <span
                  className={
                    "auction-live-pill " +
                    (sseStatus === "open"
                      ? "auction-live-pill--open"
                      : sseStatus === "connecting"
                        ? "auction-live-pill--connecting"
                        : "auction-live-pill--offline")
                  }
                >
                  {sseStatus === "open"
                    ? "Live bid updates"
                    : sseStatus === "connecting"
                      ? "Connecting to live updates…"
                      : "Live updates unavailable"}
                </span>
              </p>
            )}
          </header>

          <div className="auction-meta-row">
            <div>
              <span className="auction-label">Seller</span>
              <span className="auction-value">{seller_name || "Unknown"}</span>
            </div>
            <div>
              <span className="auction-label">Time left</span>
              <span className="auction-value" aria-live="polite">
                {displayTimeLeft}
              </span>
            </div>
            <div>
              <span className="auction-label">Status</span>
              <span className="auction-value">{auctionStatusLabel}</span>
            </div>
            <div>
              <span className="auction-label">Bids</span>
              <span className="auction-value">{displayTotalBids}</span>
            </div>
          </div>

          <div className="auction-price-card">
            <div className="auction-price-main">
              <span className="auction-label">Current bid</span>
              <div className="auction-price-line">
                <span className="auction-price" aria-live="polite">
                  {formatCurrency(displayCurrentBid)}
                </span>
                {!is_seller && hasJoinedAuction && (
                  <span
                    className={
                      "auction-badge " +
                      (displayIsHighestBidder ? "auction-badge-success" : "auction-badge-warning")
                    }
                  >
                    {displayIsHighestBidder ? "You are highest bidder" : "You have been outbid"}
                  </span>
                )}
              </div>
            </div>

            <div className="auction-last-bid">
              <span className="auction-label">Starting bid</span>
              <span className="auction-value">{formatCurrency(starting_bid)}</span>
            </div>

            {!is_seller && hasJoinedAuction && (
              <div className="auction-last-bid">
                <span className="auction-label">Your last bid</span>
                <span className="auction-value">
                  {caller_last_bid ? formatCurrency(caller_last_bid) : "-"}
                </span>
              </div>
            )}

            {typeof buy_now_price === "number" && (
              <div className="auction-last-bid">
                <span className="auction-label">Buy now</span>
                <span className="auction-value">{formatCurrency(buy_now_price)}</span>
              </div>
            )}
          </div>

          {is_seller && (
            <div className="auction-seller-actions">
              <button
                type="button"
                className="auction-btn-ghost"
                onClick={() => navigate(`/edit-listing/${listingId}`)}
              >
                Edit listing
              </button>
              <button
                type="button"
                className="auction-btn-delete-listing"
                disabled={deletingListing}
                onClick={() => void handleDeleteListing()}
              >
                {deletingListing ? "Deleting…" : "Delete listing"}
              </button>
              <p className="auction-delete-ui-message">
                Update details or remove this listing. Bidders will see changes after you save.
              </p>
            </div>
          )}

          {!is_seller && (
            <div className="auction-actions">
              <button
                type="button"
                className="auction-btn-primary"
                disabled={!canBid}
                aria-disabled={!canBid}
                onClick={handlePrimaryAction}
              >
                {canBid ? primaryCtaLabel : "Auction ended"}
              </button>

              {hasJoinedAuction && (
                <div className="auction-bid-input">
                  <label className="auction-label" htmlFor="bid-amount">
                    Enter your bid
                  </label>
                  <div className="auction-bid-row">
                    <span className="auction-bid-prefix">$</span>
                    <input
                      id="bid-amount"
                      type="number"
                      className="auction-bid-field"
                      ref={bidInputRef}
                      value={bidAmount}
                      onChange={(event) => setBidAmount(event.target.value)}
                      placeholder={String(Math.ceil(displayCurrentBid + 5))}
                      disabled={!canBid}
                    />
                    <button
                      type="button"
                      className="auction-btn-ghost"
                      disabled={!canBid || bidSubmitting}
                      onClick={() => {
                        void handlePlaceBid();
                      }}
                    >
                      {bidSubmitting ? "Bidding..." : "Bid"}
                    </button>
                  </div>
                  {bidError && (
                    <p className="auction-hint" role="alert">
                      {bidError}
                    </p>
                  )}
                  {!displayIsHighestBidder && canBid && (
                    <p className="auction-hint">
                      You are currently outbid. Try at least {formatCurrency(Math.ceil(displayCurrentBid + 5))} to take the lead.
                    </p>
                  )}
                  {!canBid && (
                    <p className="auction-hint">Bidding is closed for this auction.</p>
                  )}
                </div>
              )}

              {!hasJoinedAuction && canBid && (
                <p className="auction-hint">
                  Join the auction to place your first bid and get live updates when you are outbid.
                </p>
              )}
              {!hasJoinedAuction && !canBid && (
                <p className="auction-hint">
                  This auction has ended. Refresh later to see final settlement details.
                </p>
              )}
            </div>
          )}

          <section className="auction-details">
            <h2>Item details</h2>
            <ul>
              <li>{description || "No description provided."}</li>
              {condition ? <li>Condition: {condition}</li> : null}
              {brand ? <li>Brand: {brand}</li> : null}
            </ul>

            <h3>Pickup and location</h3>
            <p>{location || "Location will be shared with the winning bidder."}</p>
          </section>
        </section>
      </div>
      </main>
    </div>
  );
};

export default AuctionDetail;