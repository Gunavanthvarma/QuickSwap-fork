import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../landingPage/loggedin_landing_page.css";
import TopListingsStrip from "./top_listings_strip";
import type { StripItem } from "./top_listings_strip";

type ExploreMode = "trending" | "ending-soon" | "starting-soon";

interface ExploreListingsPageProps {
  mode: ExploreMode;
}

interface TopListingApiItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  current_bid: number;
}

interface TopListingsResponse {
  ending_soon: TopListingApiItem[] | null;
  starting_soon: TopListingApiItem[] | null;
  trending_now: TopListingApiItem[] | null;
}

const ExploreListingsPage: React.FC<ExploreListingsPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<StripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageTitle = useMemo(() => {
    if (mode === "trending") return "Trending now";
    if (mode === "ending-soon") return "Ending soon";
    return "Latest";
  }, [mode]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const getApiUrl = (path: string) => {
    const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "";
    const apiBase = rawApiBase.replace(/["']+/g, "").trim();
    return apiBase ? `${apiBase.replace(/\/$/, "")}${path}` : path;
  };

  const mapToStripItems = (list: TopListingApiItem[] | null, tag: string): StripItem[] => {
    if (!Array.isArray(list)) return [];

    return list.map((item) => ({
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
      setError(null);

      try {
        const token = localStorage.getItem("accessToken");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(getApiUrl("/api/toplistings"), {
          method: "GET",
          headers,
        });

        const payload: TopListingsResponse = await response.json().catch(() => ({
          ending_soon: null,
          starting_soon: null,
          trending_now: null,
        }));

        if (!response.ok) {
          const message = (payload as any)?.error || (payload as any)?.message || "Failed to fetch listings";
          throw new Error(message);
        }

        if (mode === "trending") {
          setItems(mapToStripItems(payload.trending_now, "Trending"));
          return;
        }

        if (mode === "ending-soon") {
          setItems(mapToStripItems(payload.ending_soon, "Ending soon"));
          return;
        }

        setItems(mapToStripItems(payload.starting_soon, "Latest"));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch listings");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopListings();
  }, [mode]);

  return (
    <div className="landing">
      <header className="navbar">
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
        <div className="navbar-actions">
          <button className="btn ghost" onClick={() => navigate(-1)}>
            Back
          </button>
          <button className="btn ghost" onClick={() => navigate("/profile")}>
            Profile
          </button>
        </div>
      </header>

      <section className="hero" style={{ minHeight: "auto", paddingBottom: "1rem" }}>
        <div className="hero-content">
          <span className="hero-badge">Explore</span>
          <h1>{pageTitle}</h1>
        </div>
      </section>

      {loading && <section className="strip-section">Loading auctions...</section>}
      {!loading && error && <section className="strip-section">{error}</section>}
      {!loading && !error && (
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
                : undefined
          }
        />
      )}
    </div>
  );
};

export default ExploreListingsPage;
