import React from "react";

export interface StripItem {
  id: string;
  name: string;
  price: string;
  image: string;
  tag: string;
}

interface TopListingsStripProps {
  title: string;
  items: StripItem[];
  emptyText?: string;
  onViewItem: (id: string) => void;
  onShowAll?: () => void;
  layout?: "carousel" | "grid";
}

const TopListingsStrip: React.FC<TopListingsStripProps> = ({
  title,
  items,
  emptyText = "No auctions available.",
  onViewItem,
  onShowAll,
  layout = "carousel",
}) => {
  return (
    <section className="strip-section">
      <div className="strip-header">
        <h2>{title}</h2>
        {onShowAll && (
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
      <div className={`strip-scroll ${layout === "grid" ? "strip-grid" : ""}`}>
        {items.length === 0 && <div>{emptyText}</div>}
        {items.map((item) => (
          <article key={item.id} className="strip-card">
            <div className="strip-image-wrap">
              <img
                src={item.image}
                alt={item.name}
                width={220}
                height={147}
                loading="lazy"
                decoding="async"
              />
              <span className="product-tag">{item.tag}</span>
            </div>
            <div className="strip-body">
              <h3>{item.name}</h3>
              <div className="strip-meta">
                <span className="product-price">{item.price}</span>
                <button
                  type="button"
                  className="btn tiny"
                  onClick={() => onViewItem(item.id)}
                >
                  View
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TopListingsStrip;
