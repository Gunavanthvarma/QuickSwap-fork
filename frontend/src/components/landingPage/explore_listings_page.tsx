import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./landing_page.css";
import "./loggedin_landing_page.css";
import TopListingsStrip from "./top_listings_strip";
import {
  mapTopListingsToStripItems,
  useTopListingsQuery,
} from "./topListingsQuery";

type ExploreMode = "trending" | "ending-soon" | "starting-soon";

interface ExploreListingsPageProps {
  mode: ExploreMode;
}

const ExploreListingsPage: React.FC<ExploreListingsPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useTopListingsQuery();

  const pageTitle = useMemo(() => {
    if (mode === "trending") return "Trending now";
    if (mode === "ending-soon") return "Ending soon";
    return "Latest";
  }, [mode]);

  const items = useMemo(() => {
    if (!data) return [];
    if (mode === "trending") return mapTopListingsToStripItems(data.trending_now, "Trending");
    if (mode === "ending-soon") return mapTopListingsToStripItems(data.ending_soon, "Ending soon");
    return mapTopListingsToStripItems(data.starting_soon, "Latest");
  }, [data, mode]);

  const listError = isError ? (error instanceof Error ? error.message : "Failed to fetch listings") : null;

  return (
    <div className="landing">
      <header className="navbar" aria-label="Explore listings">
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
        <div className="navbar-actions">
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>
            Back
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate("/profile")}>
            Profile
          </button>
        </div>
      </header>

      <main id="main-content">
      <section className="hero" style={{ minHeight: "auto", paddingBottom: "1rem" }}>
        <div className="hero-content">
          <span className="hero-badge">Explore</span>
          <h1>{pageTitle}</h1>
        </div>
      </section>

      {isPending && <section className="strip-section">Loading auctions...</section>}
      {!isPending && listError && <section className="strip-section">{listError}</section>}
      {!isPending && !listError && data && (
        <TopListingsStrip
          title={pageTitle}
          items={items}
          layout="grid"
          onViewItem={(id) => navigate(`/auction/${id}`)}
          emptyState={
            mode === "ending-soon"
              ? {
                  illustration: "ending",
                  title: "Nothing ending soon",
                  description:
                    "No auctions are winding down right now. See what’s trending instead.",
                  ctaLabel: "Browse trending",
                  onCta: () => navigate("/explore/trending"),
                }
              : mode === "starting-soon"
                ? {
                    illustration: "latest",
                    title: "No new listings yet",
                    description:
                      "List an item to kick off an auction, or open the home feed to browse live sales.",
                    ctaLabel: "Start selling",
                    onCta: () => navigate("/start_selling"),
                  }
                : {
                    illustration: "latest",
                    title: "Nothing trending yet",
                    description:
                      "There aren’t enough active bids to rank a trending list right now. Try ending soon or latest, or start a new auction.",
                    ctaLabel: "Browse ending soon",
                    onCta: () => navigate("/explore/ending-soon"),
                  }
          }
        />
      )}
      </main>
    </div>
  );
};

export default ExploreListingsPage;
