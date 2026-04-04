import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiErrorMessage, authHeaders, getApiUrl, isFetchAborted, isRecord } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
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

  const canBid = !is_seller && status.toLowerCase() === "active";

  // Decide primary call-to-action text based on backend participation state.
  let primaryCtaLabel = "Join auction";
  if (is_seller) {
    primaryCtaLabel = "Manage listing";
  } else if (has_joined && is_highest_bidder) {
    primaryCtaLabel = "You are leading - raise max bid";
  } else if (has_joined && !is_highest_bidder) {
    primaryCtaLabel = "Place higher bid";
  }

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
                {!is_seller && has_joined && (
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

            {!is_seller && has_joined && (
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

          {canBid && (
            <div className="auction-actions">
              <button type="button" className="auction-btn-primary">{primaryCtaLabel}</button>

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
                    <button type="button" className="auction-btn-ghost" disabled>
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
      </main>
    </div>
  );
};

export default AuctionDetail;