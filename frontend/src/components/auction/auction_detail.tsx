import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./auction_detail.css";

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

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const getApiUrl = (path: string): string => {
  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "";
  const apiBase = rawApiBase.replace(/["']+/g, "").trim();
  return apiBase ? `${apiBase.replace(/\/$/, "")}${path}` : path;
};

function currentUserIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return typeof parsed?.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

const AuctionDetail: React.FC = () => {
  const navigate = useNavigate();
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteUiMessage, setDeleteUiMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchListing = async () => {
      if (!listingId) {
        setError("Listing ID is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("accessToken");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(getApiUrl(`/api/listing?id=${encodeURIComponent(listingId)}`), {
          method: "GET",
          headers,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || "Failed to fetch listing");
        }

        const normalized: SingleListingResponse = {
          ...payload,
          images: Array.isArray(payload.images)
            ? payload.images.filter((img: unknown) => typeof img === "string")
            : [],
        };

        setListing(normalized);
        setSelectedImage(normalized.image || normalized.images[0] || "");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch listing");
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId]);

  useEffect(() => {
    if (listing && listing.status.toLowerCase() !== "active") {
      setDeleteConfirmOpen(false);
    }
  }, [listing]);

  const isListingOwner = useMemo(() => {
    if (!listing) return false;
    if (listing.is_seller) return true;
    const me = currentUserIdFromStorage();
    return Boolean(me && listing.seller_id && me === listing.seller_id);
  }, [listing]);

  if (loading) {
    return (
      <div className="auction-page">
        <p>Loading auction details...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="auction-page">
        <button className="auction-back" onClick={() => navigate(-1)}>
          Back
        </button>
        <p>{error || "Listing not found."}</p>
      </div>
    );
  }

  const {
    title,
    subtitle,
    description,
    images,
    seller_name,
    seller_id,
    current_bid,
    starting_bid,
    buy_now_price,
    total_bids,
    time_left,
    status,
    has_joined,
    is_highest_bidder,
    caller_last_bid,
    location,
    condition,
    brand,
  } = listing;

  const listingIsActive = status.toLowerCase() === "active";
  const canBid = !isListingOwner && listingIsActive;

  // Decide primary call-to-action text based on backend participation state.
  let primaryCtaLabel = "Join auction";
  if (isListingOwner) {
    primaryCtaLabel = "Manage listing";
  } else if (has_joined && is_highest_bidder) {
    primaryCtaLabel = "You are leading - raise max bid";
  } else if (has_joined && !is_highest_bidder) {
    primaryCtaLabel = "Place higher bid";
  }

  return (
    <div className="auction-page">
      {deleteConfirmOpen && listingIsActive &&
        createPortal(
          <div
            className="auction-delete-overlay"
            role="presentation"
            onClick={() => setDeleteConfirmOpen(false)}
          >
            <div
              className="auction-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auction-delete-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="auction-delete-title">Delete listing</h2>
              <p className="auction-delete-modal-text">
                Are you sure you want to delete this listing? This cannot be undone.
              </p>
              <div className="auction-delete-modal-actions">
                <button
                  type="button"
                  className="auction-btn-ghost"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="auction-btn-danger"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteUiMessage(
                      "Listing deletion is not available yet — the server does not support it in this build."
                    );
                  }}
                >
                  Delete listing
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <button className="auction-back" onClick={() => navigate(-1)}>
        Back to results
      </button>

      <div className="auction-layout">
        <section className="auction-gallery">
          <div className="auction-main-image">
            {selectedImage ? (
              <img src={selectedImage} alt={title} />
            ) : (
              <div className="auction-empty-image">No image available</div>
            )}
          </div>
          {images.length > 0 && (
            <div className="auction-thumbnails">
              {images.map((img, index) => (
                <button
                  key={`${img}-${index}`}
                  className="auction-thumb"
                  onClick={() => setSelectedImage(img)}
                >
                  <img src={img} alt={`Thumbnail ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="auction-summary">
          <header className="auction-header">
            <h1>{title}</h1>
            <p className="auction-subtitle">{subtitle || description}</p>
          </header>

          <div className="auction-meta-row">
            <div>
              <span className="auction-label">Seller</span>
              <span className="auction-value">{seller_name || "Unknown"}</span>
            </div>
            <div>
              <span className="auction-label">Time left</span>
              <span className="auction-value">{time_left}</span>
            </div>
            <div>
              <span className="auction-label">Bids</span>
              <span className="auction-value">{total_bids}</span>
            </div>
          </div>

          <div className="auction-price-card">
            <div className="auction-price-main">
              <span className="auction-label">Current bid</span>
              <div className="auction-price-line">
                <span className="auction-price">{formatCurrency(current_bid)}</span>
                {!isListingOwner && has_joined && (
                  <span
                    className={
                      "auction-badge " +
                      (is_highest_bidder ? "auction-badge-success" : "auction-badge-warning")
                    }
                  >
                    {is_highest_bidder ? "You are highest bidder" : "You have been outbid"}
                  </span>
                )}
              </div>
            </div>

            <div className="auction-last-bid">
              <span className="auction-label">Starting bid</span>
              <span className="auction-value">{formatCurrency(starting_bid)}</span>
            </div>

            {!isListingOwner && has_joined && (
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

          {isListingOwner && listingIsActive && (
            <div className="auction-seller-actions">
              <button
                type="button"
                className="auction-btn-delete-listing"
                onClick={() => {
                  setDeleteUiMessage(null);
                  setDeleteConfirmOpen(true);
                }}
              >
                Delete listing
              </button>
              {deleteUiMessage ? (
                <p className="auction-delete-ui-message" role="status">
                  {deleteUiMessage}
                </p>
              ) : null}
            </div>
          )}

          {canBid && (
            <div className="auction-actions">
              <button className="auction-btn-primary">{primaryCtaLabel}</button>

              {has_joined && (
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
                      value={bidAmount}
                      onChange={(event) => setBidAmount(event.target.value)}
                      placeholder={String(Math.ceil(current_bid + 5))}
                    />
                    <button className="auction-btn-ghost" disabled>
                      Bid
                    </button>
                  </div>
                  {!is_highest_bidder && (
                    <p className="auction-hint">
                      You are currently outbid. Try at least {formatCurrency(Math.ceil(current_bid + 5))} to take the lead.
                    </p>
                  )}
                </div>
              )}

              {!has_joined && (
                <p className="auction-hint">
                  Join the auction to place your first bid and get live updates when you are outbid.
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
    </div>
  );
};

export default AuctionDetail;