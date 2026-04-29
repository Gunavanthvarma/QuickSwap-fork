import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteListing } from "../../lib/listingApi";
import { NotificationsBell } from "../notifications/NotificationsBell";
import { AddressDetailsSection, PaymentDetailsSection } from "./SettingsAddressPayment";
import { StripEmptyStateView } from "../landingPage/top_listings_strip";
import { OptimizedImage, ErrorAlert, SkeletonGrid, useToast } from "../shared";
import { isValidPhone } from "../../utils/validation";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="profile-navbar">
      <div className="profile-navbar-left">
        <div className="navbar-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <span className="logo-text">Quickswap</span>
        </div>
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
      <nav className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Profile" role="navigation">
        <button type="button" className="navbar-link-button" onClick={() => { navigate("/"); closeMobileMenu(); }}>Browse</button>
        <button type="button" className="navbar-link-button" onClick={() => { navigate("/start_selling"); closeMobileMenu(); }}>Sell</button>
        <button type="button" className="navbar-link-button active" onClick={() => { navigate("/profile"); closeMobileMenu(); }}>Profile</button>
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

/** Full calendar date for profile copy, e.g. "April 9, 2025". */
export function formatMemberSinceDetailed(iso?: string): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function profileDisplayInitials(user: ProfileResponse, displayName: string): string {
  const f = user.first_name?.trim();
  const l = user.last_name?.trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  const em = user.email?.trim();
  if (em && em.length >= 2) return em.slice(0, 2).toUpperCase();
  return "?";
}

interface ProfileHeaderProps {
  user: ProfileResponse;
  displayName: string;
  onEditProfile?: () => void;
  /** Compact activity donuts (listings / bids); keeps the header row visually balanced. */
  activityCharts?: React.ReactNode;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  displayName,
  onEditProfile,
  activityCharts,
}) => {
  const initials = profileDisplayInitials(user, displayName);

  return (
    <section className="profile-header" aria-labelledby="profile-display-name">
      <div className="profile-header-top">
        <div className="profile-header-content">
          <div
            className="profile-avatar profile-avatar--initials"
            aria-hidden
          >
            <span className="profile-avatar-initials">{initials}</span>
          </div>
          <div className="profile-info">
            <h1 id="profile-display-name">{displayName}</h1>
            <p className="profile-username">{user.email}</p>
            {onEditProfile ? (
              <button type="button" className="btn ghost profile-inline-edit-btn" onClick={onEditProfile}>
                Edit profile
              </button>
            ) : null}
          </div>
        </div>
        {activityCharts}
      </div>
    </section>
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
  const toast = useToast();
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const validateField = (field: string, value: string) => {
    const errors: Record<string, string> = { ...fieldErrors };

    switch (field) {
      case 'first_name':
        if (!value.trim()) {
          errors.first_name = 'First name is required';
        } else {
          delete errors.first_name;
        }
        break;
      case 'last_name':
        if (!value.trim()) {
          errors.last_name = 'Last name is required';
        } else {
          delete errors.last_name;
        }
        break;
      case 'mobile':
        if (!value.trim()) {
          errors.mobile = 'Phone number is required';
        } else if (!isValidPhone(value)) {
          errors.mobile = 'Please enter a valid phone number (10-15 digits)';
        } else {
          delete errors.mobile;
        }
        break;
    }

    setFieldErrors(errors);
    return errors;
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all fields before submit
    const allErrors = {
      ...validateField('first_name', editForm.first_name),
      ...validateField('last_name', editForm.last_name),
      ...validateField('mobile', editForm.mobile),
    };
    if (Object.keys(allErrors).length > 0) return;
    const ok = await onSubmit(e);
    if (ok) {
      toast.success('Profile updated successfully');
      setShowSuccess(true);
    }
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
              onChange={(e) => {
                setEditForm((prev) => ({ ...prev, first_name: e.target.value }));
                validateField('first_name', e.target.value);
              }}
              aria-invalid={!!fieldErrors.first_name}
              aria-describedby={fieldErrors.first_name ? 'error-first-name' : undefined}
            />
            {fieldErrors.first_name && (
              <span id="error-first-name" className="field-error">{fieldErrors.first_name}</span>
            )}
          </div>
          <div className="settings-group">
            <label htmlFor="edit-last-name">Last Name</label>
            <input
              id="edit-last-name"
              type="text"
              value={editForm.last_name}
              required
              disabled={saving}
              onChange={(e) => {
                setEditForm((prev) => ({ ...prev, last_name: e.target.value }));
                validateField('last_name', e.target.value);
              }}
              aria-invalid={!!fieldErrors.last_name}
              aria-describedby={fieldErrors.last_name ? 'error-last-name' : undefined}
            />
            {fieldErrors.last_name && (
              <span id="error-last-name" className="field-error">{fieldErrors.last_name}</span>
            )}
          </div>
          <div className="settings-group">
            <label htmlFor="edit-mobile">Phone number</label>
            <input
              id="edit-mobile"
              type="tel"
              value={editForm.mobile}
              required
              disabled={saving}
              onChange={(e) => {
                setEditForm((prev) => ({ ...prev, mobile: e.target.value }));
                validateField('mobile', e.target.value);
              }}
              aria-invalid={!!fieldErrors.mobile}
              aria-describedby={fieldErrors.mobile ? 'error-mobile' : undefined}
            />
            {fieldErrors.mobile && (
              <span id="error-mobile" className="field-error">{fieldErrors.mobile}</span>
            )}
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
  const toast = useToast();
  const [showSuccess, setShowSuccess] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !showSuccess) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving, showSuccess]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const ok = await onSubmit(e);
    if (ok) {
      toast.success('Password updated successfully');
      setShowSuccess(true);
    }
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
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onKeep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onKeep]);

  return (
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
};

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
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        onNo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNo, deleting]);

  return (
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
};

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

  if (loading) return <SkeletonGrid variant="listing-card" count={4} />;
  if (error) return <ErrorAlert message={error} title="Could not load listings" />;
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
              <OptimizedImage
                src={listing.image}
                alt={listing.name}
                width={400}
                height={225}
              />
              <span className={`listing-status ${listing.status}`}>
                {listing.status === "active"
                  ? "Active"
                  : listing.status === "sold"
                    ? "Sold"
                    : "Unsold"}
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
  if (loading) return <SkeletonGrid variant="bid-card" count={4} />;
  if (error) return <ErrorAlert message={error} title="Could not load bids" />;
  if (bids.length === 0) {
    return (
      <div className="profile-bids-empty">
        <div className="strip-scroll strip-scroll--empty">
          <StripEmptyStateView
            config={{
              illustration: "no-bids",
              title: "No bids placed yet",
              description: "Explore auctions and place your first bid.",
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
            <OptimizedImage
              src={bid.image}
              alt={bid.name}
              width={400}
              height={225}
            />
            <span className={`bid-status ${bid.status}`}>
              {bid.status === "won" && "Won"}
              {bid.status === "winning" && "Winning"}
              {bid.status === "bid_more" && "Bid more"}
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
              {bid.status === "bid_more" && <span className="btn primary" style={{ display: "block", textAlign: "center" }}>Place higher bid</span>}
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
  /** Optional note under Delete account (does not block the button). */
  deleteAccountNotice?: string | null;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  onEditProfile,
  onUpdatePassword,
  onDeleteAccount,
  deleteAccountNotice = null,
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
      {deleteAccountNotice ? (
        <p className="settings-inline-hint" role="note">
          {deleteAccountNotice}
        </p>
      ) : null}
    </div>
  </div>
);

/** No-op export so stale imports of the removed success banner do not break the bundle. */
export const ProfileUpdateSuccessBanner: React.FC<{
  visible?: boolean;
  onDismiss?: () => void;
}> = () => null;

export { ProfileHeaderCharts } from "./ProfileHeaderCharts";