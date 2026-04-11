import React from "react";
import { useNavigate } from "react-router-dom";
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
        <button className="profile-back-pill" onClick={() => navigate("/")}>← Back</button>
        <div className="navbar-logo">
          <span className="logo-text">Quickswap</span>
        </div>
      </div>
      <nav className="navbar-links">
        <button className="navbar-link-button" onClick={() => navigate("/")}>Browse</button>
        <button className="navbar-link-button" onClick={() => navigate("/start_selling")}>Sell</button>
        <button className="navbar-link-button active" onClick={() => navigate("/profile")}>Profile</button>
      </nav>
    </header>
  );
};

// ─── ProfileHeader ────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  user: ProfileResponse;
  displayName: string;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, displayName }) => (
  <section className="profile-header">
    <div className="profile-header-content">
      <div className="profile-avatar">
        <img
          src="https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600"
          alt="User avatar"
        />
      </div>
      <div className="profile-info">
        <h1>{displayName}</h1>
        <p className="profile-username">{user.email}</p>
      </div>
      <div className="profile-stats">
        <div className="stat"><span className="stat-value">24</span><span className="stat-label">Items sold</span></div>
        <div className="stat"><span className="stat-value">4.9</span><span className="stat-label">Rating</span></div>
        <div className="stat"><span className="stat-value">98%</span><span className="stat-label">Response rate</span></div>
      </div>
    </div>
  </section>
);

// ─── ProfileTabs ──────────────────────────────────────────────────────────────

interface ProfileTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({ activeTab, onTabChange }) => (
  <section className="profile-tabs">
    <button type="button" className={`tab ${activeTab === "listings" ? "active" : ""}`} onClick={() => onTabChange("listings")}>My Listings</button>
    <button type="button" className={`tab ${activeTab === "bids" ? "active" : ""}`} onClick={() => onTabChange("bids")}>My Bids</button>
    <button type="button" className={`tab ${activeTab === "settings" ? "active" : ""}`} onClick={() => onTabChange("settings")}>Settings</button>
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
    <div className="edit-profile-modal-overlay">
      <div className="edit-profile-modal-content">
        <h2>Edit Profile</h2>
        <form onSubmit={handleFormSubmit} className="edit-profile-form">
          {saveError ? (
            <p className="edit-profile-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="settings-group">
            <label>First Name</label>
            <input type="text" value={editForm.first_name} required disabled={saving}
              onChange={(e) => setEditForm((prev) => ({ ...prev, first_name: e.target.value }))} />
          </div>
          <div className="settings-group">
            <label>Last Name</label>
            <input type="text" value={editForm.last_name} required disabled={saving}
              onChange={(e) => setEditForm((prev) => ({ ...prev, last_name: e.target.value }))} />
          </div>
          <div className="settings-group">
            <label>Phone number</label>
            <input type="tel" value={editForm.mobile} required disabled={saving}
              onChange={(e) => setEditForm((prev) => ({ ...prev, mobile: e.target.value }))} />
          </div>
          <div className="settings-group">
            <label>Email address</label>
            <input type="email" value={user.email} disabled className="disabled-input" />
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
}

export const ListingsTab: React.FC<ListingsTabProps> = ({ listings, loading, error }) => {
  const navigate = useNavigate();
  if (loading) return <div>Loading your listings...</div>;
  if (error) return <div>{error}</div>;
  if (listings.length === 0) {
    return (
      <div className="profile-listings-empty">
        <div className="strip-scroll strip-scroll--empty">
          <StripEmptyStateView
            config={{
              illustration: "first-listing",
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
        <article key={listing.id} className="listing-card" style={{ cursor: "pointer" }} onClick={() => navigate(`/auction/${listing.id}`)}>
          <div className="listing-image-wrap">
            <img src={listing.image} alt={listing.name} />
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
        <article key={bid.id} className="bid-card" style={{ cursor: "pointer" }} onClick={() => navigate(`/auction/${bid.id}`)}>
          <div className="bid-image-wrap">
            <img src={bid.image} alt={bid.name} />
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        </article>
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