import React from "react";
import { OptimizedImage } from "../shared";

export interface StripItem {
  id: string;
  name: string;
  price: string;
  image: string;
  tag: string;
}

export type StripEmptyIllustration =
  | "ending"
  | "latest"
  | "first-listing"
  | "no-bids";

export interface StripEmptyStateConfig {
  illustration: StripEmptyIllustration;
  title?: string;
  description?: string;
  ctaLabel: string;
  onCta: () => void;
}

interface TopListingsStripProps {
  title: string;
  items: StripItem[];
  emptyText?: string;
  /** Rich empty state; when set and `items` is empty, replaces plain `emptyText`. */
  emptyState?: StripEmptyStateConfig;
  /** When true and there are no items, the entire section (heading + body) is omitted. */
  hideWhenEmpty?: boolean;
  onViewItem: (id: string) => void;
  onShowAll?: () => void;
  layout?: "carousel" | "grid";
}

const StripEmptyIllustrationSvg: React.FC<{ variant: StripEmptyIllustration }> = ({
  variant,
}) => {
  if (variant === "first-listing") {
    return (
      <svg
        className="strip-empty-svg"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <path
          d="M38 40h40l16 16v38a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8z"
          fill="none"
          strokeWidth="3"
          strokeLinejoin="round"
          className="strip-empty-svg-stroke"
        />
        <path
          d="M48 58h28M48 72h20"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="strip-empty-svg-stroke-soft"
        />
        <circle cx="82" cy="46" r="16" className="strip-empty-svg-badge" />
        <path
          d="M82 38v16M74 46h16"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="strip-empty-svg-plus"
        />
      </svg>
    );
  }
  if (variant === "no-bids") {
    return (
      <svg
        className="strip-empty-svg"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <rect
          x="26"
          y="50"
          width="50"
          height="38"
          rx="8"
          fill="none"
          strokeWidth="3"
          strokeLinejoin="round"
          className="strip-empty-svg-stroke"
        />
        <path
          d="M51 50V34"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="strip-empty-svg-stroke"
        />
        <path
          d="M36 64h30M36 76h22"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="strip-empty-svg-stroke-soft"
        />
        <path
          d="M84 70V46M76 54l8-8 8 8"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="strip-empty-svg-stroke"
        />
        <circle cx="84" cy="88" r="14" className="strip-empty-svg-badge" />
        <path
          d="M84 82v12M78 88h12"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="strip-empty-svg-plus"
        />
      </svg>
    );
  }
  if (variant === "ending") {
    return (
      <svg
        className="strip-empty-svg"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <circle cx="60" cy="60" r="44" fill="none" strokeWidth="3" className="strip-empty-svg-stroke" />
        <path
          d="M60 36v28l18 10"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="strip-empty-svg-stroke"
        />
        <circle cx="60" cy="60" r="4" className="strip-empty-svg-fill" />
      </svg>
    );
  }
  return (
    <svg
      className="strip-empty-svg"
      viewBox="0 0 120 120"
      aria-hidden
    >
      <rect
        x="24"
        y="28"
        width="72"
        height="56"
        rx="8"
        fill="none"
        strokeWidth="3"
        className="strip-empty-svg-stroke"
      />
      <path
        d="M40 48h40M40 60h28M40 72h36"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="strip-empty-svg-stroke-soft"
      />
      <circle cx="88" cy="88" r="18" className="strip-empty-svg-badge" />
      <path
        d="M88 80v16M80 88h16"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="strip-empty-svg-plus"
      />
    </svg>
  );
};

export const StripEmptyStateView: React.FC<{ config: StripEmptyStateConfig }> = ({
  config,
}) => {
  const { illustration, title, description, ctaLabel, onCta } = config;
  const minimal = !title?.trim() && !description?.trim();

  return (
    <div
      className={`strip-empty${minimal ? " strip-empty--cta-only" : ""}`}
      role="status"
    >
      <div className="strip-empty-illustration">
        <StripEmptyIllustrationSvg variant={illustration} />
      </div>
      {title?.trim() ? (
        <h3 className="strip-empty-title">{title}</h3>
      ) : null}
      {description?.trim() ? (
        <p className="strip-empty-desc">{description}</p>
      ) : null}
      <button type="button" className="strip-empty-cta" onClick={onCta}>
        {ctaLabel}
      </button>
    </div>
  );
};

const TopListingsStrip: React.FC<TopListingsStripProps> = ({
  title,
  items,
  emptyText = "No auctions available.",
  emptyState,
  hideWhenEmpty = false,
  onViewItem,
  onShowAll,
  layout = "carousel",
}) => {
  const isEmpty = items.length === 0;
  if (hideWhenEmpty && isEmpty) {
    return null;
  }
  const scrollClass = [
    "strip-scroll",
    layout === "grid" ? "strip-grid" : "",
    isEmpty ? "strip-scroll--empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="strip-section">
      <div className="strip-header">
        <h2>{title}</h2>
        {onShowAll && !isEmpty && (
          <button
            type="button"
            className="strip-view-all"
            onClick={onShowAll}
            aria-label={`Show all ${title}`}
          >
            Show all
          </button>
        )}
      </div>
      <div className={scrollClass}>
        {isEmpty && emptyState && <StripEmptyStateView config={emptyState} />}
        {isEmpty && !emptyState && (
          <div className="strip-empty strip-empty--plain">{emptyText}</div>
        )}
        {!isEmpty &&
          items.map((item) => (
          <article
            key={item.id}
            className="strip-card"
            style={{ cursor: "pointer" }}
            onClick={() => onViewItem(item.id)}
          >
            <div className="strip-image-wrap">
              <OptimizedImage
                src={item.image}
                alt={item.name}
                width={220}
                height={147}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 300px"
              />
              <span className="product-tag">{item.tag}</span>
            </div>
            <div className="strip-body">
              <h3>{item.name}</h3>
              <div className="strip-meta">
                <span className="product-price">{item.price}</span>
                <span className="strip-card-link">View details</span>
              </div>
            </div>
          </article>
          ))}
      </div>
    </section>
  );
};

export default TopListingsStrip;
