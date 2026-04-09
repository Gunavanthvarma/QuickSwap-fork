import React, { useState, useEffect } from "react";
import "./profile_page.css";

import type { ActiveTab } from "./Profile.types";
import { useProfile, useMyListings, useMyBids } from "./ProfileHooks";
import {
  ProfileNavbar,
  ProfileHeader,
  ProfileTabs,
  EditProfileModal,
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
  } = useProfile();

  const { userListings, loading: listingsLoading, error: listingsError, fetchMyListings } = useMyListings();
  const { userBids, loading: bidsLoading, error: bidsError, fetchMyBids } = useMyBids();

  useEffect(() => {
    if (user) fetchMyListings();
  }, [user]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "listings") fetchMyListings();
    if (tab === "bids") fetchMyBids();
  };

  if (loading) return <div className="profile-page">Loading profile...</div>;
  if (error || !user) return <div className="profile-page">Unable to load profile.</div>;

  return (
    <div className="profile-page">
      {isEditingProfile && (
        <EditProfileModal
          key={profileEditModalKey}
          user={user}
          editForm={editForm}
          setEditForm={setEditForm}
          onSubmit={handleEditSubmit}
          onClose={closeEdit}
          saveError={profileSaveError}
          saving={savingProfile}
        />
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
          <SettingsTab onEditProfile={handleEditOpen} />
        )}
      </section>
    </div>
  );
};

export default ProfilePage;