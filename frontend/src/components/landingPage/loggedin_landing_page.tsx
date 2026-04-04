import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import "./landing_page.css";
import "./loggedin_landing_page.css";
import TopListingsStrip from "./top_listings_strip";
import {
  mapTopListingsToStripItems,
  useTopListingsQuery,
} from "./topListingsQuery";

const LoggedInLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const { data, isPending, isError, error } = useTopListingsQuery();

  const trendingItems = useMemo(
    () => (data ? mapTopListingsToStripItems(data.trending_now, "Trending") : []),
    [data],
  );
  const endingSoonItems = useMemo(
    () => (data ? mapTopListingsToStripItems(data.ending_soon, "Ending soon") : []),
    [data],
  );
  const latestItems = useMemo(
    () => (data ? mapTopListingsToStripItems(data.starting_soon, "Latest") : []),
    [data],
  );

  const fetchError = isError ? (error instanceof Error ? error.message : "Failed to fetch top listings") : null;

  const handleLogout = () => {
    logout();
  };

  const handleStartSelling = () => {
    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }
    navigate("/start_selling");
  };

  return (
    <div className="landing">
      <header className="navbar">
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
        <nav className="navbar-links" aria-label="Primary" />
        <div className="navbar-actions">
          <button type="button" className="btn primary" onClick={handleStartSelling}>
            Start selling
          </button>
          {isAuthenticated && (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate("/profile")}
              >
                Profile
              </button>
              <button type="button" className="btn ghost" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      <main id="main-content">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Live now · Tailored auctions</span>
          <h1>Pick up where you left off.</h1>
          <p>
            See trending auctions, lots you’re watching, and ones that are
            about to end — all in one place.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary" onClick={handleStartSelling}>
              Start a new auction
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => navigate("/profile")}
            >
              View your activity
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card main">
            <img
              src="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="People collaborating at a laptop, representing your QuickSwap dashboard activity"
              width={800}
              height={533}
              decoding="async"
              fetchPriority="high"
            />
            <div className="hero-tag">
              3 auctions ending in the next hour
            </div>
          </div>
        </div>
      </section>

      {isPending && <section className="strip-section">Loading auctions...</section>}
      {!isPending && fetchError && <section className="strip-section">{fetchError}</section>}
      {!isPending && !fetchError && data && (
        <>
          <TopListingsStrip
            title="Trending now"
            items={trendingItems}
            onShowAll={() => navigate("/explore/trending")}
            onViewItem={(id) => navigate(`/auction/${id}`)}
          />
          <TopListingsStrip
            title="Ending soon"
            items={endingSoonItems}
            onShowAll={() => navigate("/explore/ending-soon")}
            onViewItem={(id) => navigate(`/auction/${id}`)}
          />
          <TopListingsStrip
            title="Latest"
            items={latestItems}
            onShowAll={() => navigate("/explore/starting-soon")}
            onViewItem={(id) => navigate(`/auction/${id}`)}
          />
        </>
      )}

      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Quickswap. All rights reserved.</span>
        <span className="footer-links">
          <a href="#!">Privacy</a> · <a href="#!">Terms</a> ·{" "}
          <a href="#!">Support</a>
        </span>
      </footer>
    </div>
  );
};

export default LoggedInLandingPage;
