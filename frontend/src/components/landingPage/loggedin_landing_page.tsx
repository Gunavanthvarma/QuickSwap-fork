import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { LoadingSpinner, ErrorAlert, OptimizedImage } from "../shared";
import "./landing_page.css";
import "./loggedin_landing_page.css";
import TopListingsStrip from "./top_listings_strip";
import { NotificationsBell } from "../notifications/NotificationsBell";
import {
  mapTopListingsToStripItems,
  useTopListingsQuery,
} from "./topListingsQuery";

const LoggedInLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { data, isPending, isError, error } = useTopListingsQuery();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isOnHomePage = location.pathname === "/";

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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const [recentSearches, setRecentSearches] = React.useState<string[]>(() => {
    const stored = localStorage.getItem("recentSearches");
    return stored ? JSON.parse(stored) : [];
  });

  const handleSearch = (e: React.FormEvent, query: string = searchQuery) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      // Add to recent searches
      const updated = [trimmedQuery, ...recentSearches.filter(s => s !== trimmedQuery)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem("recentSearches", JSON.stringify(updated));

      navigate(`/explore/trending?q=${encodeURIComponent(trimmedQuery)}`);
      setSearchQuery("");
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
  };

  return (
    <div className="landing">
      {/* Skip navigation link */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <header className="navbar">
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
        <button
          type="button"
          className="navbar-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Primary" role="navigation">
          <div className="navbar-search-wrapper">
            <form className="navbar-search" onSubmit={(e) => handleSearch(e, searchQuery)}>
              <input
                type="text"
                placeholder="Search auctions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search auctions"
                className="search-input"
                autoComplete="off"
              />
              <button type="submit" className="search-button" aria-label="Search">
                🔍
              </button>
            </form>
            {recentSearches.length > 0 && searchQuery === "" && (
              <div className="recent-searches" role="region" aria-label="Recent searches">
                <div className="recent-searches-header">
                  <span className="recent-searches-title">Recent</span>
                  <button
                    type="button"
                    className="clear-recent"
                    onClick={clearRecentSearches}
                    aria-label="Clear recent searches"
                  >
                    Clear
                  </button>
                </div>
                <div className="recent-searches-list">
                  {recentSearches.map((search, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="recent-search-item"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSearch(e, search);
                      }}
                    >
                      <span>🔍</span>
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <a href="#trending" onClick={closeMobileMenu} className={isOnHomePage ? 'nav-link-active' : ''}>
            Trending
          </a>
          <button
            type="button"
            className="navbar-link-button"
            onClick={() => { navigate("/explore/trending"); closeMobileMenu(); }}
          >
            Explore
          </button>
        </nav>
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
          <NotificationsBell />
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
            <OptimizedImage
              src="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="People collaborating at a laptop, representing your QuickSwap dashboard activity"
              width={800}
              height={533}
              priority
            />
            <div className="hero-tag">
              3 auctions ending in the next hour
            </div>
          </div>
        </div>
      </section>

      {isPending && (
        <section className="strip-section">
          <LoadingSpinner message="Loading trending auctions..." size="medium" />
        </section>
      )}
      {!isPending && fetchError && (
        <section className="strip-section">
          <ErrorAlert
            title="Failed to load auctions"
            message={fetchError}
            fullWidth
          />
        </section>
      )}
      {!isPending && !fetchError && data && (
        <>
          <TopListingsStrip
            title="Trending now"
            items={trendingItems}
            onShowAll={() => navigate("/explore/trending")}
            onViewItem={(id) => navigate(`/auction/${id}`)}
            emptyState={{
              illustration: "latest",
              title: "Nothing trending yet",
              description:
                "When auctions heat up, they’ll appear here. List something new or browse individual categories from Explore.",
              ctaLabel: "Start selling",
              onCta: () => {
                handleStartSelling();
              },
            }}
          />
          <TopListingsStrip
            title="Ending soon"
            items={endingSoonItems}
            hideWhenEmpty
            onShowAll={() => navigate("/explore/ending-soon")}
            onViewItem={(id) => navigate(`/auction/${id}`)}
          />
          <TopListingsStrip
            title="Latest"
            items={latestItems}
            hideWhenEmpty
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
