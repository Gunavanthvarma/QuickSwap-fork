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
          <button className="strip-view-all" onClick={onShowAll}>
            Show all
          </button>
        )}
      </div>
      <div className={`strip-scroll ${layout === "grid" ? "strip-grid" : ""}`}>
        {items.length === 0 && <div>{emptyText}</div>}
        {items.map((item) => (
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
