// LandingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearLocalAuth, postAuthLogout } from "../../utils/authApi";
import "./landing_page.css";
// import Signup from './components/authenticate/Signup';

const mockListings = [
  {
    id: 1,
    name: "Gaming Laptop · 1 hr flash auction",
    price: "Current bid: $780",
    image:
      "https://images.pexels.com/photos/2115217/pexels-photo-2115217.jpeg?auto=compress&cs=tinysrgb&w=600",
    tag: "High intent",
  },
  {
    id: 2,
    name: "iPhone 14 Pro · 20 min left",
    price: "Current bid: $620",
    image:
      "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=600",
    tag: "Hot",
  },
  {
    id: 3,
    name: "Mechanical Keyboard · 5 min left",
    price: "Current bid: $95",
    image:
      "https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=600",
    tag: "Ending soon",
  },
  {
    id: 4,
    name: "Sony WH‑1000XM · fresh listing",
    price: "Starting bid: $110",
    image:
      "https://images.pexels.com/photos/3394664/pexels-photo-3394664.jpeg?auto=compress&cs=tinysrgb&w=600",
    tag: "New",
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [logoutBusy, setLogoutBusy] = useState(false);

  const isLoggedIn = !!localStorage.getItem("user");
  const handleLogout = async () => {
    if (logoutBusy) return;
    const token = localStorage.getItem("accessToken");
    setLogoutBusy(true);
    try {
      if (token) await postAuthLogout(token);
    } finally {
      clearLocalAuth();
      setLogoutBusy(false);
      navigate("/", { replace: true });
    }
  };

  const handleStartSelling = () => {
    if (!isLoggedIn) {
      // not logged in → go to sign in
      navigate("/signin");
      return;
    }
    // logged in: later this can go to /sell; for now maybe /profile
    // navigate("/sell");
    navigate("/start_selling");
  };

  return (
    <div className="landing">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
        <nav className="navbar-links">
          <a href="#features">How it works</a>
          <a href="#auctions">Live auctions</a>
          {!isLoggedIn && (<a href="#about">Why Quickswap</a>)}
        </nav>
        <div className="navbar-actions">
          <button className="btn primary" onClick={handleStartSelling}>
            Start selling
          </button>
          {isLoggedIn ? (
            <>
              <button className="btn ghost" onClick={() => navigate("/profile")}>
                Profile
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  void handleLogout();
                }}
                disabled={logoutBusy}
              >
                {logoutBusy ? "Logging out…" : "Logout"}
              </button>
            </>
          ) : (
          <button className="btn ghost" onClick={() => navigate("/signin")}>
            Sign in
          </button>
        )}
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">
            Live now · Real‑time local auctions
          </span>
          <h1>
            Turn slow chats into real‑time bidding wars.
          </h1>
          <p>
            Quickswap replaces endless price negotiations with a transparent,
            time‑boxed auction engine. List once, set a window, and let buyers
            compete in real time while the market discovers the true price.
          </p>
          <div className="hero-actions">
            <button className="btn primary">Launch a 15‑min auction</button>
            <button className="btn ghost">Browse live bids</button>
          </div>
          <div className="hero-meta">
            <div>
              <strong>5× faster</strong>
              <span>From listing to sale vs. chat‑based marketplaces</span>
            </div>
            <div>
              <strong>100% visible</strong>
              <span>All bids in one real‑time feed</span>
            </div>
            <div>
              <strong>No DMs</strong>
              <span>Zero back‑and‑forth haggling</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-card main">
            <img
              src="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Real-time bidding interface"
            />
            <div className="hero-tag">
              Live bid · 00:03:21 left · 17 active bidders
            </div>
          </div>
          <div className="hero-card secondary">
            <h3>Seller sets the rules</h3>
            <p>
              Choose a soft starting price and a fixed time window — Quickswap
              handles the rest.
            </p>
          </div>
          <div className="hero-card secondary">
            <h3>Buyers see everything</h3>
            <p>
              Transparent, real‑time bids with no hidden offers or private
              deals.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <div className="feature">
          <h3>From days to minutes</h3>
          <p>
            Compress the entire sale lifecycle into a short auction window
            instead of waiting on messages for days.
          </p>
        </div>
        <div className="feature">
          <h3>Real‑time bidding engine</h3>
          <p>
            Buyers place bids in a live, shared feed with instant updates and
            clear price discovery.
          </p>
        </div>
        <div className="feature">
          <h3>No chat, no stress</h3>
          <p>
            One listing, one auction — no "Is this available?" spam, no
            low‑ball DMs, no coordination chaos.
          </p>
        </div>
      </section>

      {/* Live auctions */}
      <section id="auctions" className="products">
        <div className="section-header">
          <h2>Live local auctions</h2>
          <p>Examples of how items move from listing to sold in minutes.</p>
        </div>
        <div className="products-grid">
          {mockListings.map((listing) => (
            <article key={listing.id} className="product-card">
              <div className="product-image-wrap">
                <img src={listing.image} alt={listing.name} />
                <span className="product-tag">{listing.tag}</span>
              </div>
              <div className="product-body">
                <h3>{listing.name}</h3>
                <div className="product-meta">
                  <span className="product-price">{listing.price}</span>
                  <button className="btn tiny">View auction</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* About / CTA */}
      {!isLoggedIn && (
      <section id="about" className="about">
        <div className="about-inner">
          <div>
            <h2>Bring auction‑grade efficiency to peer‑to‑peer selling.</h2>
            <p>
              Quickswap is built for local marketplaces that want the clarity of
              an order book, the speed of a flash sale, and the simplicity of
              listing once and walking away. No extra commitments, just clean,
              competitive bidding.
            </p>
          </div>
          <button className="btn primary" onClick={() => navigate("/signin")}>Join the early access</button>
        </div>
      </section>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>
          © {new Date().getFullYear()} Quickswap. All rights reserved.
        </span>
        <span className="footer-links">
          <a href="#!">Privacy</a> · <a href="#!">Terms</a> ·{" "}
          <a href="#!">Support</a>
        </span>
      </footer>
    </div>
  );
};

export default LandingPage;