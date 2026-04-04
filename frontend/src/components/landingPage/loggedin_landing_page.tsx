import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage, authHeaders, getApiUrl } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import "../landingPage/loggedin_landing_page.css";
import TopListingsStrip from "./top_listings_strip";
import type { StripItem } from "./top_listings_strip";

interface TopListingApiItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  current_bid: number;
  auction_start_time: string;
  auction_end_time: string;
}

interface TopListingsResponse {
  ending_soon: TopListingApiItem[] | null;
  starting_soon: TopListingApiItem[] | null;
  trending_now: TopListingApiItem[] | null;
}

const LoggedInLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem("user");
  const [trendingItems, setTrendingItems] = useState<StripItem[]>([]);
  const [endingSoonItems, setEndingSoonItems] = useState<StripItem[]>([]);
  const [latestItems, setLatestItems] = useState<StripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const mapToStripItems = (items: TopListingApiItem[] | null, tag: string): StripItem[] => {
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
      id: item.id,
      name: item.subtitle ? `${item.title} · ${item.subtitle}` : item.title,
      price: `Current bid: ${formatCurrency(item.current_bid)}`,
      image: item.image,
      tag,
    }));
  };

  useEffect(() => {
    const fetchTopListings = async () => {
      setLoading(true);
      setFetchError(null);

      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch(getApiUrl("/api/toplistings"), {
          method: "GET",
          headers: authHeaders(token),
        });

        const payload: TopListingsResponse = await response.json().catch(() => ({
          ending_soon: null,
          starting_soon: null,
          trending_now: null,
        }));

        if (!response.ok) {
          throw new Error(apiErrorMessage(payload, "Failed to fetch top listings"));
        }

        setTrendingItems(mapToStripItems(payload.trending_now, "Trending"));
        setEndingSoonItems(mapToStripItems(payload.ending_soon, "Ending soon"));
        setLatestItems(mapToStripItems(payload.starting_soon, "Latest"));
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : "Failed to fetch top listings");
      } finally {
        setLoading(false);
      }
    };

    fetchTopListings();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessTokenExpiry");
    localStorage.removeItem("user");
    // navigate("/", { replace: true }); // back to public landing
    window.location.href = "/";
  };

  const handleStartSelling = () => {
    if (!isLoggedIn) {
      navigate("/signin");
      return;
    }
    navigate("/start_selling");
  };

  return (
    <div className="landing">
      {/* Navbar – identical to your current one */}
      <header className="navbar">
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
        <nav className="navbar-links">
          {/* remove “How it works” / “Live auctions” for logged‑in view */}
          {/* You can add “Home”, “Explore”, etc. later if you want */}
        </nav>
        <div className="navbar-actions">
          <button className="btn primary" onClick={handleStartSelling}>
            Start selling
          </button>
          {isLoggedIn && (
            <>
              <button
                className="btn ghost"
                onClick={() => navigate("/profile")}
              >
                Profile
              </button>
              <button className="btn ghost" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero strip can stay, or you can shrink it later */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Live now · Tailored auctions</span>
          <h1>Pick up where you left off.</h1>
          <p>
            See trending auctions, lots you’re watching, and ones that are
            about to end — all in one place.
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={handleStartSelling}>
              Start a new auction
            </button>
            <button
              className="btn ghost"
              onClick={() => navigate("/profile")}
            >
              View your activity
            </button>
          </div>
        </div>
        <div className="hero-visual">
          {/* you can reuse your existing hero visuals here */}
          <div className="hero-card main">
            <img
              src="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Dashboard preview"
            />
            <div className="hero-tag">
              3 auctions ending in the next hour
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal strips */}
      {loading && <section className="strip-section">Loading auctions...</section>}
      {!loading && fetchError && <section className="strip-section">{fetchError}</section>}
      {!loading && !fetchError && (
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

      {/* Footer can stay the same if you like */}
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