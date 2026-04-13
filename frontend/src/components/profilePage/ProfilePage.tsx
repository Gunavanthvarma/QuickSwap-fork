import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./profile_page.css";
import "../landingPage/loggedin_landing_page.css";

import type { ActiveTab } from "./Profile.types";
import { useProfile, useMyListings, useMyBids } from "./ProfileHooks";
import {
  ProfileNavbar,
  ProfileHeader,
  ProfileTabs,
  EditProfileModal,
  UpdatePasswordModal,
  DeleteAccountModal,
  DeleteAccountFinalModal,
  ListingsTab,
  BidsTab,
  SettingsTab,
} from "./Profilecomponents";

const ProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("listings");

  const {
    user, loading, error, displayName,
    isEditingProfile, editForm, setEditForm,
    profileSaveError, savingProfile, profileEditModalKey,
    handleEditOpen, handleEditSubmit, closeEdit,
    isUpdatingPassword, passwordForm, setPasswordForm,
    passwordUpdateError, savingPassword, passwordModalKey,
    handlePasswordOpen, handlePasswordSubmit, closePassword,
    deleteAccountFlow,
    deletePhraseInput,
    setDeletePhraseInput,
    deletePhraseError,
    deleteAccountError,
    deletingAccount,
    deleteAccountModalKey,
    handleDeleteAccountOpen,
    closeDeleteAccountFlow,
    tryAdvanceToFinalDeleteStep,
    confirmDeleteAccount,
  } = useProfile();

  const { userListings, loading: listingsLoading, error: listingsError, fetchMyListings } = useMyListings();
  const { userBids, loading: bidsLoading, error: bidsError, fetchMyBids } = useMyBids();

  useEffect(() => {
    if (user) {
      void fetchMyListings();
    }
  }, [user, fetchMyListings]);

  useEffect(() => {
    if (activeTab !== "bids") return;

    // Keep bid history fresh while user watches "My Bids".
    const intervalId = window.setInterval(() => {
      void fetchMyBids();
    }, 10_000);

    const onFocus = () => {
      void fetchMyBids();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeTab, fetchMyBids]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "listings") void fetchMyListings();
    if (tab === "bids") void fetchMyBids();
  };

  if (loading) return <div className="profile-page">Loading profile...</div>;
  if (error || !user) return <div className="profile-page">Unable to load profile.</div>;

  return (
    <div className="profile-page">
      {isEditingProfile &&
        createPortal(
          <EditProfileModal
            key={profileEditModalKey}
            user={user}
            editForm={editForm}
            setEditForm={setEditForm}
            onSubmit={handleEditSubmit}
            onClose={closeEdit}
            saveError={profileSaveError}
            saving={savingProfile}
          />,
          document.body
        )}
      {isUpdatingPassword &&
        createPortal(
          <UpdatePasswordModal
            key={passwordModalKey}
            passwordForm={passwordForm}
            setPasswordForm={setPasswordForm}
            onSubmit={handlePasswordSubmit}
            onClose={closePassword}
            updateError={passwordUpdateError}
            saving={savingPassword}
          />,
          document.body
        )}
      {deleteAccountFlow === "phrase" &&
        createPortal(
          <DeleteAccountModal
            key={deleteAccountModalKey}
            confirmPhrase={deletePhraseInput}
            setConfirmPhrase={setDeletePhraseInput}
            phraseError={deletePhraseError}
            onKeep={closeDeleteAccountFlow}
            onDelete={tryAdvanceToFinalDeleteStep}
          />,
          document.body
        )}
      {deleteAccountFlow === "final" &&
        createPortal(
          <DeleteAccountFinalModal
            onNo={closeDeleteAccountFlow}
            onYes={confirmDeleteAccount}
            error={deleteAccountError}
            deleting={deletingAccount}
          />,
          document.body
        )}

      <ProfileNavbar />
      <ProfileHeader user={user} displayName={displayName} />
      <ProfileTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <section className="profile-content">
        {activeTab === "listings" && (
          <ListingsTab listings={userListings} loading={listingsLoading} error={listingsError}  />
        )}
        {activeTab === "bids" && (
          <BidsTab bids={userBids} loading={bidsLoading} error={bidsError}  />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            onEditProfile={handleEditOpen}
            onUpdatePassword={handlePasswordOpen}
            onDeleteAccount={handleDeleteAccountOpen}
          />
        )}
      </section>
    </div>
  );
};

export default ProfilePage;