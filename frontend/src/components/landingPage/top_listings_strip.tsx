import React from "react";

export interface StripItem {
  id: string;
  name: string;
  price: string;
  image: string;
  tag: string;
}

export type StripEmptyIllustration = "ending" | "latest";

export interface StripEmptyStateConfig {
  illustration: StripEmptyIllustration;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}

interface TopListingsStripProps {
  title: string;
  items: StripItem[];
  emptyText?: string;
  /** Rich empty state; when set and `items` is empty, replaces plain `emptyText`. */
  emptyState?: StripEmptyStateConfig;
  onViewItem: (id: string) => void;
  onShowAll?: () => void;
  layout?: "carousel" | "grid";
}

const StripEmptyIllustrationSvg: React.FC<{ variant: StripEmptyIllustration }> = ({
  variant,
}) => {
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

const TopListingsStrip: React.FC<TopListingsStripProps> = ({
  title,
  items,
  emptyText = "No auctions available.",
  emptyState,
  onViewItem,
  onShowAll,
  layout = "carousel",
}) => {
  const isEmpty = items.length === 0;
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
          <button className="strip-view-all" onClick={onShowAll}>
            Show all
          </button>
        )}
      </div>
      <div className={scrollClass}>
        {isEmpty && emptyState && (
          <div className="strip-empty" role="status">
            <div className="strip-empty-illustration">
              <StripEmptyIllustrationSvg variant={emptyState.illustration} />
            </div>
            <h3 className="strip-empty-title">{emptyState.title}</h3>
            <p className="strip-empty-desc">{emptyState.description}</p>
            <button
              type="button"
              className="strip-empty-cta"
              onClick={emptyState.onCta}
            >
              {emptyState.ctaLabel}
            </button>
          </div>
        )}
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
              <img src={item.image} alt={item.name} />
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
