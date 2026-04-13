import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteListing } from "../../lib/listingApi";
import { NotificationsBell } from "../notifications/NotificationsBell";
import { AddressDetailsSection, PaymentDetailsSection } from "./SettingsAddressPayment";
import { StripEmptyStateView } from "../landingPage/top_listings_strip";
import type {
  ProfileResponse,
  EditFormState,
  UpdatePasswordFormState,
  ListingCardItem,
  BidCardItem,
  ActiveTab,
} from "./Profile.types";

// ─── ProfileNavbar ────────────────────────────────────────────────────────────

export const ProfileNavbar: React.FC = () => {
  const navigate = useNavigate();
  return (
    <header className="profile-navbar">
      <div className="profile-navbar-left">
        <button type="button" className="profile-back-pill" onClick={() => navigate("/")}>← Back</button>
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
      </div>
      <nav className="navbar-links" aria-label="Profile">
        <button type="button" className="navbar-link-button" onClick={() => navigate("/")}>Browse</button>
        <button type="button" className="navbar-link-button" onClick={() => navigate("/start_selling")}>Sell</button>
        <button type="button" className="navbar-link-button active" onClick={() => navigate("/profile")}>Profile</button>
      </nav>
      <div className="navbar-actions">
        <NotificationsBell />
      </div>
    </header>
  );
};

// ─── ProfileHeader ────────────────────────────────────────────────────────────

export function formatMemberSinceLabel(iso?: string): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface ProfileHeaderProps {
  user: ProfileResponse;
  displayName: string;
  itemsSold: number | null;
  memberSinceLabel: string | null;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  displayName,
  itemsSold,
  memberSinceLabel,
}) => (
  <section className="profile-header" aria-labelledby="profile-display-name">
    <div className="profile-header-content">
      <div className="profile-avatar">
        <img
          src="https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600"
          alt=""
          width={80}
          height={80}
          decoding="async"
        />
        <span className="profile-verified" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </div>
      <div className="profile-info">
        <h1 id="profile-display-name">{displayName}</h1>
        <p className="profile-username">{user.email}</p>
      </div>
      <div className="profile-stats">
        <div className="stat">
          <span className="stat-value">{itemsSold !== null ? itemsSold : "—"}</span>
          <span className="stat-label">Auctions ended</span>
        </div>
        {memberSinceLabel ? (
          <div className="stat">
            <span className="stat-value stat-value--compact">{memberSinceLabel}</span>
            <span className="stat-label">Member since</span>
          </div>
        ) : null}
      </div>
    </div>
  </section>
);

// ─── ProfileAside (sidebar) ───────────────────────────────────────────────────

export const ProfileAside: React.FC = () => {
  const navigate = useNavigate();
  return (
    <aside className="profile-sidebar" aria-label="Profile shortcuts">
      <div className="profile-sidebar-card">
        <h2 className="profile-sidebar-title">Quick links</h2>
        <nav className="profile-sidebar-nav">
          <button type="button" className="profile-sidebar-link" onClick={() => navigate("/")}>
            Browse home
          </button>
          <button type="button" className="profile-sidebar-link" onClick={() => navigate("/start_selling")}>
            Start selling
          </button>
          <button type="button" className="profile-sidebar-link" onClick={() => navigate("/explore/trending")}>
            Explore trending
          </button>
        </nav>
      </div>
      <div className="profile-sidebar-card">
        <h2 className="profile-sidebar-title">Activity</h2>
        <p className="profile-sidebar-text">
          Use the notifications bell on the home bar for alerts. Your listings and bids are updated in the tabs
          beside this panel.
        </p>
      </div>
    </aside>
  );
};

// ─── ProfileTabs ──────────────────────────────────────────────────────────────

interface ProfileTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({ activeTab, onTabChange }) => (
  <section className="profile-tabs" role="tablist" aria-label="Profile sections">
    <button
      type="button"
      role="tab"
      id="tab-listings"
      className={`tab ${activeTab === "listings" ? "active" : ""}`}
      aria-selected={activeTab === "listings"}
      aria-controls="profile-tab-panel"
      onClick={() => onTabChange("listings")}
    >
      My Listings
    </button>
    <button
      type="button"
      role="tab"
      id="tab-bids"
      className={`tab ${activeTab === "bids" ? "active" : ""}`}
      aria-selected={activeTab === "bids"}
      aria-controls="profile-tab-panel"
      onClick={() => onTabChange("bids")}
    >
      My Bids
    </button>
    <button
      type="button"
      role="tab"
      id="tab-settings"
      className={`tab ${activeTab === "settings" ? "active" : ""}`}
      aria-selected={activeTab === "settings"}
      aria-controls="profile-tab-panel"
      onClick={() => onTabChange("settings")}
    >
      Settings
    </button>
  </section>
);

// ─── EditProfileModal ─────────────────────────────────────────────────────────

interface EditProfileModalProps {
  user: ProfileResponse;
  editForm: EditFormState;
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  onSubmit: (e: React.FormEvent) => Promise<boolean>;
  onClose: () => void;
  saveError?: string | null;
  saving?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  user,
  editForm,
  setEditForm,
  onSubmit,
  onClose,
  saveError,
  saving = false,
}) => {
  const [showSuccess, setShowSuccess] = React.useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit(e);
    if (ok) setShowSuccess(true);
  };

  if (showSuccess) {
    return (
      <div className="edit-profile-modal-overlay">
        <div className="edit-profile-modal-content">
          <h2>Edit Profile</h2>
          <p className="edit-profile-success" role="status">
            Profile updated successfully
          </p>
          <div className="edit-profile-actions edit-profile-actions--single">
            <button type="button" className="btn primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-modal-overlay" role="presentation">
      <div
        className="edit-profile-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        <h2 id="edit-profile-title">Edit Profile</h2>
        <form onSubmit={handleFormSubmit} className="edit-profile-form">
          {saveError ? (
            <p className="edit-profile-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="settings-group">
            <label htmlFor="edit-first-name">First Name</label>
            <input
              id="edit-first-name"
              type="text"
              value={editForm.first_name}
              required
              disabled={saving}
              onChange={(e) => setEditForm((prev) => ({ ...prev, first_name: e.target.value }))}
            />
          </div>
          <div className="settings-group">
            <label htmlFor="edit-last-name">Last Name</label>
            <input
              id="edit-last-name"
              type="text"
              value={editForm.last_name}
              required
              disabled={saving}
              onChange={(e) => setEditForm((prev) => ({ ...prev, last_name: e.target.value }))}
            />
          </div>
          <div className="settings-group">
            <label htmlFor="edit-mobile">Phone number</label>
            <input
              id="edit-mobile"
              type="tel"
              value={editForm.mobile}
              required
              disabled={saving}
              onChange={(e) => setEditForm((prev) => ({ ...prev, mobile: e.target.value }))}
            />
          </div>
          <div className="settings-group">
            <label htmlFor="edit-email-readonly">Email address</label>
            <input
              id="edit-email-readonly"
              type="email"
              value={user.email}
              disabled
              className="disabled-input"
            />
          </div>
          <div className="edit-profile-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── UpdatePasswordModal ──────────────────────────────────────────────────────

interface UpdatePasswordModalProps {
  passwordForm: UpdatePasswordFormState;
  setPasswordForm: React.Dispatch<React.SetStateAction<UpdatePasswordFormState>>;
  onSubmit: (e: React.FormEvent) => Promise<boolean>;
  onClose: () => void;
  updateError?: string | null;
  saving?: boolean;
}

export const UpdatePasswordModal: React.FC<UpdatePasswordModalProps> = ({
  passwordForm,
  setPasswordForm,
  onSubmit,
  onClose,
  updateError,
  saving = false,
}) => {
  const [showSuccess, setShowSuccess] = React.useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const ok = await onSubmit(e);
    if (ok) setShowSuccess(true);
  };

  if (showSuccess) {
    return (
      <div className="edit-profile-modal-overlay">
        <div className="edit-profile-modal-content">
          <h2>Update password</h2>
          <p className="edit-profile-success" role="status">
            Password updated successfully
          </p>
          <div className="edit-profile-actions edit-profile-actions--single">
            <button type="button" className="btn primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-modal-overlay">
      <div className="edit-profile-modal-content">
        <h2>Update password</h2>
        <form onSubmit={handleFormSubmit} className="edit-profile-form">
          {updateError ? (
            <p className="edit-profile-error" role="alert">
              {updateError}
            </p>
          ) : null}
          <div className="settings-group">
            <label htmlFor="update-pw-old">Old password</label>
            <input
              id="update-pw-old"
              type="password"
              autoComplete="current-password"
              value={passwordForm.old_password}
              required
              disabled={saving}
              onChange={(e) =>
                setPasswordForm((prev) => ({ ...prev, old_password: e.target.value }))
              }
            />
          </div>
          <div className="settings-group">
            <label htmlFor="update-pw-new">New password</label>
            <input
              id="update-pw-new"
              type="password"
              autoComplete="new-password"
              value={passwordForm.new_password}
              required
              disabled={saving}
              onChange={(e) =>
                setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
              }
            />
          </div>
          <div className="settings-group">
            <label htmlFor="update-pw-confirm">Re-enter new password</label>
            <input
              id="update-pw-confirm"
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirm_password}
              required
              disabled={saving}
              onChange={(e) =>
                setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))
              }
            />
          </div>
          <div className="edit-profile-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
              Close
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Updating…" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── DeleteAccountModal (step 1) ──────────────────────────────────────────────

interface DeleteAccountModalProps {
  confirmPhrase: string;
  setConfirmPhrase: React.Dispatch<React.SetStateAction<string>>;
  phraseError: string | null;
  onKeep: () => void;
  onDelete: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  confirmPhrase,
  setConfirmPhrase,
  phraseError,
  onKeep,
  onDelete,
}) => (
  <div className="edit-profile-modal-overlay">
    <div className="edit-profile-modal-content">
      <h2>Delete account</h2>
      <p className="delete-account-prompt">Are you sure you want to delete the account?</p>
      <div className="settings-group">
        <label htmlFor="delete-account-confirm">Type <strong>Delete</strong> to confirm</label>
        <input
          id="delete-account-confirm"
          type="text"
          autoComplete="off"
          value={confirmPhrase}
          onChange={(e) => setConfirmPhrase(e.target.value)}
          placeholder="Delete"
        />
      </div>
      {phraseError ? (
        <p className="edit-profile-error" role="alert">
          {phraseError}
        </p>
      ) : null}
      <div className="edit-profile-actions">
        <button type="button" className="btn ghost" onClick={onKeep}>
          Keep
        </button>
        <button type="button" className="btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  </div>
);

// ─── DeleteAccountFinalModal (step 2) ─────────────────────────────────────────

interface DeleteAccountFinalModalProps {
  onNo: () => void;
  onYes: () => void | Promise<void>;
  error?: string | null;
  deleting?: boolean;
}

export const DeleteAccountFinalModal: React.FC<DeleteAccountFinalModalProps> = ({
  onNo,
  onYes,
  error,
  deleting = false,
}) => (
  <div className="edit-profile-modal-overlay">
    <div className="edit-profile-modal-content">
      <h2>Delete account</h2>
      <p className="delete-account-prompt">Are you sure you want to delete account?</p>
      {error ? (
        <p className="edit-profile-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="edit-profile-actions">
        <button type="button" className="btn ghost" onClick={onNo} disabled={deleting}>
          No
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={deleting}
          onClick={() => {
            void onYes();
          }}
        >
          {deleting ? "Deleting…" : "Yes"}
        </button>
      </div>
    </div>
  </div>
);

// ─── ListingsTab ──────────────────────────────────────────────────────────────

interface ListingsTabProps {
  listings: ListingCardItem[];
  loading: boolean;
  error: string | null;
  onRefreshListings?: () => void;
}

export const ListingsTab: React.FC<ListingsTabProps> = ({ listings, loading, error, onRefreshListings }) => {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (listingId: string, name: string) => {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/signin");
      return;
    }
    setDeletingId(listingId);
    try {
      await deleteListing(listingId, token);
      onRefreshListings?.();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Failed to delete listing");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div>Loading your listings...</div>;
  if (error) return <div>{error}</div>;
  if (listings.length === 0) {
    return (
      <div className="profile-listings-empty">
        <div className="strip-scroll strip-scroll--empty">
          <StripEmptyStateView
            config={{
              illustration: "first-listing",
              title: "No listings yet",
              description: "Create your first auction to reach buyers with a clear end time and live bidding.",
              ctaLabel: "Start your first listing",
              onCta: () => navigate("/start_selling"),
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="listings-grid">
      {listings.map((listing) => (
        <article key={listing.id} className="listing-card">
          <div
            className="listing-card-main"
            role="button"
            tabIndex={0}
            aria-label={`Open auction: ${listing.name}`}
            onClick={() => navigate(`/auction/${listing.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/auction/${listing.id}`);
              }
            }}
          >
            <div className="listing-image-wrap">
              <img
                src={listing.image}
                alt=""
                width={400}
                height={225}
                loading="lazy"
                decoding="async"
              />
              <span className={`listing-status ${listing.status}`}>
                {listing.status === "active" ? "Active" : "Ended"}
              </span>
            </div>
            <div className="listing-body">
              <h3>{listing.name}</h3>
              <div className="listing-details">
                <div className="price-info">
                  <span className="label">Current bid</span>
                  <span className="value">{listing.currentBid}</span>
                </div>
                <div className="price-info">
                  <span className="label">Time left</span>
                  <span className="value">{listing.timeLeft}</span>
                </div>
              </div>
              <div className="listing-meta">
                <span>{listing.bids} bids</span>
                <span className="btn-link">View details</span>
              </div>
            </div>
          </div>
          <div className="listing-card-actions">
            <button
              type="button"
              className="listing-action-btn listing-action-btn--secondary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/edit-listing/${listing.id}`);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="listing-action-btn listing-action-btn--danger"
              disabled={deletingId === listing.id}
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(listing.id, listing.name);
              }}
            >
              {deletingId === listing.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};

// ─── BidsTab ──────────────────────────────────────────────────────────────────

interface BidsTabProps {
  bids: BidCardItem[];
  loading: boolean;
  error: string | null;
}

export const BidsTab: React.FC<BidsTabProps> = ({ bids, loading, error }) => {
  const navigate = useNavigate();
  if (loading) return <div>Loading your bids...</div>;
  if (error) return <div>{error}</div>;
  if (bids.length === 0) {
    return (
      <div className="profile-bids-empty">
        <div className="strip-scroll strip-scroll--empty">
          <StripEmptyStateView
            config={{
              illustration: "no-bids",
              ctaLabel: "Browse live auctions",
              onCta: () => navigate("/"),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bids-grid">
      {bids.map((bid) => (
        <div
          key={bid.id}
          className="bid-card"
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          aria-label={`Open auction: ${bid.name}`}
          onClick={() => navigate(`/auction/${bid.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(`/auction/${bid.id}`);
            }
          }}
        >
          <div className="bid-image-wrap">
            <img
              src={bid.image}
              alt=""
              width={400}
              height={225}
              loading="lazy"
              decoding="async"
            />
            <span className={`bid-status ${bid.status}`}>
              {bid.status === "winning" && "Winning"}
              {bid.status === "outbid" && "Outbid"}
              {bid.status === "lost" && "Lost"}
            </span>
          </div>
          <div className="bid-body">
            <h3>{bid.name}</h3>
            <div className="bid-details">
              <div className="price-info">
                <span className="label">Your bid</span>
                <span className="value">{bid.yourBid}</span>
              </div>
              <div className="price-info">
                <span className="label">Current bid</span>
                <span className="value">{bid.currentBid}</span>
              </div>
            </div>
            {bid.timeLeft && (
              <div className="bid-time">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{bid.timeLeft}</span>
              </div>
            )}
            <div className="bid-actions">
              {bid.status === "outbid" && <span className="btn primary" style={{ display: "block", textAlign: "center" }}>Place higher bid</span>}
              {bid.status === "winning" && <span className="btn ghost" style={{ display: "block", textAlign: "center" }}>View auction</span>}
              {bid.status === "lost" && <span className="btn ghost" style={{ display: "block", textAlign: "center" }}>View details</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── SettingsTab ──────────────────────────────────────────────────────────────

interface SettingsTabProps {
  onEditProfile: () => void;
  onUpdatePassword: () => void;
  onDeleteAccount: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  onEditProfile,
  onUpdatePassword,
  onDeleteAccount,
}) => (
  <div className="settings-container">
    <div className="settings-section">
      <h2>Account Details</h2>
      <div className="settings-group inline" style={{ marginBottom: 0 }}>
        <label>Personal information</label>
        <button type="button" className="btn ghost" onClick={onEditProfile}>Edit profile</button>
      </div>
    </div>
    <AddressDetailsSection />
    <PaymentDetailsSection />
    <div className="settings-section">
      <h2>Privacy & Security</h2>
      <div className="settings-group inline">
        <label>Change password</label>
        <button type="button" className="btn ghost" onClick={onUpdatePassword}>
          Update password
        </button>
      </div>
      <div className="settings-group inline" style={{ marginBottom: 0 }}>
        <label style={{ color: "var(--error)" }}>Delete account</label>
        <button
          type="button"
          className="btn ghost"
          style={{ color: "var(--error)", borderColor: "var(--error-soft)" }}
          onClick={onDeleteAccount}
        >
          Delete account
        </button>
      </div>
    </div>
  </div>
);

/** No-op export so stale imports of the removed success banner do not break the bundle. */
export const ProfileUpdateSuccessBanner: React.FC<{
  visible?: boolean;
  onDismiss?: () => void;
}> = () => null;