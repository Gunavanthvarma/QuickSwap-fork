// src/components/sell/StartSelling.tsx
import React, { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSignInRedirect } from "../../auth/useSignInRedirect";
import { apiErrorMessage, authHeaders, getApiUrl, isFetchAborted, isRecord } from "../../lib/api";
import "./start_selling.css";

interface StartSellingForm {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  subcategory: string;
  condition: string;
  brand: string;
  color: string;
  size: string;
  locationCity: string;
  startingBid: string;
  buyNowPrice: string;
  startTime: string;
  endTime: string;
  pickupNotes: string;
}

function readCreatedListingId(data: Record<string, unknown>): string | null {
  const lid = data.listing_id;
  if (typeof lid === "string" && lid.trim()) return lid.trim();
  if (typeof lid === "number" && Number.isFinite(lid)) return String(lid);
  const id = data.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

const initialSellForm: StartSellingForm = {
  title: "",
  subtitle: "",
  description: "",
  category: "",
  subcategory: "",
  condition: "used_good",
  brand: "",
  color: "",
  size: "",
  locationCity: "",
  startingBid: "",
  buyNowPrice: "",
  startTime: "",
  endTime: "",
  pickupNotes: "",
};

const subcategoriesByCategory: Record<string, string[]> = {
  electronics: ["Mobile phones", "Laptops", "Headphones", "Cameras", "Gaming consoles"],
  clothing: ["Men's T‑shirts", "Men's pants", "Women's tops", "Women's pants", "Jackets & coats"],
  home: ["Furniture", "Kitchen & dining", "Home decor", "Bedding", "Storage & organization"],
  books: ["Fiction", "Non‑fiction", "Textbooks", "Comics & graphic novels", "Kids' books"],
  sports: ["Fitness equipment", "Outdoor gear", "Team sports", "Cycling", "Sportswear"],
  other: ["Miscellaneous"],
};

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeCategoryKey(raw: string): string {
  const s = raw.trim().toLowerCase();
  for (const key of Object.keys(subcategoriesByCategory)) {
    if (s === key) return key;
  }
  for (const key of Object.keys(subcategoriesByCategory)) {
    if (s.startsWith(key)) return key;
  }
  return "other";
}

interface PhotoPreviewProps {
  file: File;
  onRemove: () => void;
  disabled: boolean;
}

const PhotoPreview: React.FC<PhotoPreviewProps> = ({ file, onRemove, disabled }) => {
  const [previewUrl, setPreviewUrl] = React.useState<string>("");

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="sell-photo-preview-item">
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          width={100}
          height={100}
          loading="lazy"
          decoding="async"
          className="sell-photo-img"
        />
      )}
      <div className="sell-photo-overlay">
        <span className="sell-photo-name" title={file.name}>{file.name}</span>
        <button
          type="button"
          onClick={onRemove}
          className="sell-photo-remove"
          disabled={disabled}
          aria-label={`Remove photo ${file.name}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const ExistingImagePreview: React.FC<{
  url: string;
  onRemove: () => void;
  disabled: boolean;
}> = ({ url, onRemove, disabled }) => (
  <div className="sell-photo-preview-item">
    <img src={url} alt="" width={100} height={100} loading="lazy" decoding="async" className="sell-photo-img" />
    <div className="sell-photo-overlay">
      <span className="sell-photo-name" title="Saved photo">
        Saved
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="sell-photo-remove"
        disabled={disabled}
        aria-label="Remove saved photo"
      >
        ✕
      </button>
    </div>
  </div>
);

const StartSelling: React.FC = () => {
  const navigate = useNavigate();
  const redirectToSignin = useSignInRedirect();
  const { id: editRouteId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editRouteId);

  const [form, setForm] = useState<StartSellingForm>(() => ({ ...initialSellForm }));

  const [photos, setPhotos] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [listingPublished, setListingPublished] = useState(false);
  const [listingUpdated, setListingUpdated] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editRouteId) return;
    const ac = new AbortController();
    const { signal } = ac;

    const load = async () => {
      setEditLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          redirectToSignin();
          return;
        }
        const response = await fetch(getApiUrl(`/api/listing?id=${encodeURIComponent(editRouteId)}`), {
          method: "GET",
          headers: authHeaders(token),
          signal,
        });
        const rawJson: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(apiErrorMessage(rawJson, "Failed to load listing"));
        }
        if (!isRecord(rawJson)) {
          throw new Error("Invalid listing response");
        }
        if (rawJson.is_seller !== true) {
          setError("You can only edit your own listings.");
          return;
        }

        const catRaw = typeof rawJson.category === "string" ? rawJson.category : "";
        const imagesRaw = rawJson.images;
        const imgs = Array.isArray(imagesRaw)
          ? imagesRaw.filter((x): x is string => typeof x === "string")
          : [];

        setExistingImageUrls(imgs.slice(0, 6));
        setForm({
          title: typeof rawJson.title === "string" ? rawJson.title : "",
          subtitle: typeof rawJson.subtitle === "string" ? rawJson.subtitle : "",
          description: typeof rawJson.description === "string" ? rawJson.description : "",
          category: normalizeCategoryKey(catRaw),
          subcategory: typeof rawJson.subcategory === "string" ? rawJson.subcategory : "",
          condition: typeof rawJson.condition === "string" && rawJson.condition ? rawJson.condition : "used_good",
          brand: typeof rawJson.brand === "string" ? rawJson.brand : "",
          color: typeof rawJson.color === "string" ? rawJson.color : "",
          size: typeof rawJson.size === "string" ? rawJson.size : "",
          locationCity: typeof rawJson.location === "string" ? rawJson.location : "",
          startingBid:
            typeof rawJson.starting_bid === "number" && Number.isFinite(rawJson.starting_bid)
              ? String(rawJson.starting_bid)
              : "",
          buyNowPrice:
            rawJson.buy_now_price != null && typeof rawJson.buy_now_price === "number"
              ? String(rawJson.buy_now_price)
              : "",
          startTime:
            typeof rawJson.auction_start_time === "string"
              ? toDatetimeLocalValue(rawJson.auction_start_time)
              : "",
          endTime:
            typeof rawJson.auction_end_time === "string" ? toDatetimeLocalValue(rawJson.auction_end_time) : "",
          pickupNotes: typeof rawJson.notes === "string" ? rawJson.notes : "",
        });
      } catch (err: unknown) {
        if (isFetchAborted(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        if (!signal.aborted) {
          setEditLoading(false);
        }
      }
    };

    void load();
    return () => ac.abort();
  }, [editRouteId, redirectToSignin]);

  const startAnotherListing = () => {
    setForm({ ...initialSellForm });
    setPhotos([]);
    setExistingImageUrls([]);
    setListingPublished(false);
    setListingUpdated(false);
    setCreatedListingId(null);
    setError("");
  };

  const handleChange =
    (field: keyof StartSellingForm) =>
    (
      e:
        | ChangeEvent<HTMLInputElement>
        | ChangeEvent<HTMLTextAreaElement>
        | ChangeEvent<HTMLSelectElement>
    ) => {
      setForm((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setPhotos((prev) => {
      const room = Math.max(0, 6 - existingImageUrls.length);
      const combined = [...prev, ...newFiles];
      return combined.slice(0, room);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to get current datetime in YYYY-MM-DDTHH:mm to block past selections
  const getMinDateTime = () => {
    const now = new Date();
    // Offset by local timezone to correctly format the HTML datetime-local constraint natively block
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  // Convert File objects to base64 strings for API
  const convertPhotosToBase64 = async (files: File[]): Promise<string[]> => {
    const promises = files.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  // Convert datetime-local to RFC3339 format (what Go expects)
  const formatDateTimeToRFC3339 = (dateTimeLocal: string): string => {
    if (!dateTimeLocal) return "";
    const date = new Date(dateTimeLocal);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date format");
    }
    return date.toISOString();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        redirectToSignin();
        return;
      }

      if (!form.title.trim() || !form.description.trim() || !form.category || !form.endTime || !form.locationCity.trim()) {
        throw new Error("Please fill out all required fields.");
      }

      const newImages = await convertPhotosToBase64(photos);
      const allImages = [...existingImageUrls, ...newImages];

      if (isEditMode && editRouteId) {
        if (allImages.length === 0) {
          throw new Error("At least one photo is required");
        }

        type UpdateListingBody = {
          title: string;
          subtitle: string;
          description: string;
          category: string;
          subcategory: string;
          condition: string;
          brand: string;
          color: string;
          size: string;
          images: string[];
          buy_now_price?: number;
          auction_end_time: string;
          location: string;
          notes: string;
        };

        const updateBody: UpdateListingBody = {
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          description: form.description.trim(),
          category: form.category,
          subcategory: form.subcategory || "",
          condition: form.condition,
          brand: form.brand.trim(),
          color: form.color.trim(),
          size: form.size.trim(),
          images: allImages,
          auction_end_time: formatDateTimeToRFC3339(form.endTime),
          location: form.locationCity.trim(),
          notes: form.pickupNotes.trim(),
        };

        if (form.buyNowPrice && parseFloat(form.buyNowPrice) > 0) {
          updateBody.buy_now_price = parseFloat(form.buyNowPrice);
        }

        const response = await fetch(getApiUrl(`/api/listing?id=${encodeURIComponent(editRouteId)}`), {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify(updateBody),
        });

        const contentType = response.headers.get("content-type");
        let data: Record<string, unknown> = {};

        if (contentType && contentType.toLowerCase().includes("application/json")) {
          data = (await response.json()) as Record<string, unknown>;
        } else {
          const textData = await response.text();
          throw new Error(`Server returned non-JSON response (${response.status}): ${textData.substring(0, 100)}`);
        }

        if (!response.ok) {
          throw new Error(apiErrorMessage(data, `Failed to update listing (${response.status})`));
        }

        setCreatedListingId(editRouteId);
        setListingUpdated(true);
        return;
      }

      if (!form.startingBid || parseFloat(form.startingBid) <= 0) {
        throw new Error("Starting bid must be greater than 0");
      }
      if (photos.length === 0) {
        throw new Error("At least one photo is required");
      }

      type CreateListingBody = {
        title: string;
        subtitle: string;
        description: string;
        category: string;
        subcategory: string;
        condition: string;
        brand: string;
        color: string;
        size: string;
        images: string[];
        starting_bid: number;
        auction_start_time: string;
        auction_end_time: string;
        location: string;
        notes: string;
        buy_now_price?: number;
      };

      const requestBody: CreateListingBody = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        description: form.description.trim(),
        category: form.category,
        subcategory: form.subcategory || "",
        condition: form.condition,
        brand: form.brand.trim(),
        color: form.color.trim(),
        size: form.size.trim(),
        images: newImages,
        starting_bid: parseFloat(form.startingBid),
        auction_start_time: form.startTime ? formatDateTimeToRFC3339(form.startTime) : new Date().toISOString(),
        auction_end_time: formatDateTimeToRFC3339(form.endTime),
        location: form.locationCity.trim(),
        notes: form.pickupNotes.trim(),
      };

      if (form.buyNowPrice && parseFloat(form.buyNowPrice) > 0) {
        requestBody.buy_now_price = parseFloat(form.buyNowPrice);
      }

      const response = await fetch(getApiUrl("/api/createlisting"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get("content-type");
      let data: Record<string, unknown> = {};

      if (contentType && contentType.toLowerCase().includes("application/json")) {
        data = (await response.json()) as Record<string, unknown>;
      } else {
        const textData = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${textData.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, `Failed to create listing (${response.status})`));
      }

      setCreatedListingId(readCreatedListingId(data));
      setListingPublished(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while saving the listing");
      console.error("Error saving listing:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const subcategoryOptions =
    form.category && subcategoriesByCategory[form.category]
      ? subcategoriesByCategory[form.category]
      : [];

  if (listingPublished || listingUpdated) {
    const successId = createdListingId || editRouteId;
    return (
      <div className="sell-page">
        <button type="button" className="sell-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <main id="main-content">
          <div className="sell-success-card" role="status" aria-live="polite">
            <h1 className="sell-success-title">{listingUpdated ? "Listing updated" : "Listing published"}</h1>
            <p className="sell-success-text">
              {listingUpdated
                ? "Your changes are saved. Open the listing below or manage auctions from your profile."
                : "Your auction is live. You can open it below or manage it from your profile."}
            </p>
            <div className="sell-success-actions">
              <div className="sell-success-primary-row">
                {successId ? (
                  <Link to={`/auction/${successId}`} className="sell-btn-primary sell-success-link">
                    View listing
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="sell-btn-primary sell-success-profile-btn"
                  onClick={() => navigate("/profile")}
                >
                  View profile
                </button>
              </div>
              {listingUpdated ? (
                <button
                  type="button"
                  className="sell-btn-secondary"
                  onClick={() => navigate(`/auction/${editRouteId}`)}
                >
                  Back to auction
                </button>
              ) : (
                <button type="button" className="sell-btn-secondary" onClick={startAnotherListing}>
                  Create another listing
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isEditMode && editLoading) {
    return (
      <div className="sell-page">
        <button type="button" className="sell-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <main id="main-content">
          <div className="sell-success-card" role="status">
            <p className="sell-success-text" style={{ marginBottom: 0 }}>
              Loading listing…
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="sell-page">
      <button type="button" className="sell-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <main id="main-content">
      <div className="sell-layout">
        {/* Left: photos */}
        <section className="sell-photos-card">
          <h2>Photos</h2>
          <p className="sell-helper">
            {isEditMode
              ? "Keep or remove existing photos and add new ones if needed. Up to six images total."
              : "Upload clear photos that show the item from multiple angles."}
          </p>

          <label className="sell-upload-area" htmlFor="sell-photos-input">
            <input
              id="sell-photos-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              style={{ display: "none" }}
              disabled={isSubmitting || existingImageUrls.length + photos.length >= 6}
            />
            <span className="sell-upload-icon">＋</span>
            <span>Click to upload or drag and drop</span>
            <span className="sell-upload-sub">
              PNG, JPG up to 10MB each. First photo becomes the cover.
            </span>
          </label>

          {existingImageUrls.length > 0 && (
            <div className="sell-photo-preview-row">
              {existingImageUrls.map((url, idx) => (
                <ExistingImagePreview
                  key={`${url.slice(0, 48)}-${idx}`}
                  url={url}
                  onRemove={() => removeExistingImage(idx)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <div className="sell-photo-preview-row">
              {photos.map((file, idx) => (
                <PhotoPreview
                  key={`${file.name}-${idx}`}
                  file={file}
                  onRemove={() => removePhoto(idx)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          )}
        </section>

        {/* Right: form */}
        <section className="sell-form-card">
          <h1>{isEditMode ? "Edit listing" : "Create a new auction"}</h1>
          <p className="sell-subtitle">
            {isEditMode
              ? "Update details buyers see. Starting bid and auction start time stay as originally set."
              : "Describe your item, set a starting bid, and choose when the auction runs."}
          </p>

          {error && (
            <div
              role="alert"
              style={{
                color: "red",
                marginBottom: "1rem",
                padding: "0.75rem",
                border: "1px solid #ff6b6b",
                borderRadius: "4px",
                backgroundColor: "#ffebee",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <form className="sell-form" onSubmit={handleSubmit}>
            {/* Basic info */}
            <div className="sell-field-group">
              <label htmlFor="sell-title">
                Title
                <input
                  id="sell-title"
                  type="text"
                  value={form.title}
                  onChange={handleChange("title")}
                  placeholder="e.g. Wooden dining table · seats 4"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label htmlFor="sell-subtitle">
                Short subtitle
                <input
                  id="sell-subtitle"
                  type="text"
                  value={form.subtitle}
                  onChange={handleChange("subtitle")}
                  placeholder="e.g. Solid oak, includes 4 matching chairs"
                  disabled={isSubmitting}
                />
              </label>

              <label htmlFor="sell-description">
                Detailed description
                <textarea
                  id="sell-description"
                  value={form.description}
                  onChange={handleChange("description")}
                  placeholder="Describe condition, dimensions, what's included, and anything a buyer should know."
                  rows={4}
                  maxLength={2000}
                  style={{ resize: "none", overflowY: "auto" }}
                  disabled={isSubmitting}
                  required
                />
              </label>
            </div>

            {/* Category & subcategory */}
            <div className="sell-two-column">
              <label htmlFor="sell-category">
                Category
                <select
                  id="sell-category"
                  value={form.category}
                  onChange={handleChange("category")}
                  disabled={isSubmitting}
                  required
                >
                  <option value="">Select category</option>
                  <option value="electronics">Electronics</option>
                  <option value="clothing">Clothing & accessories</option>
                  <option value="home">Home & kitchen</option>
                  <option value="books">Books</option>
                  <option value="sports">Sports & outdoors</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label htmlFor="sell-subcategory">
                Subcategory
                <select
                  id="sell-subcategory"
                  value={form.subcategory}
                  onChange={handleChange("subcategory")}
                  disabled={!form.category || isSubmitting}
                  required={!isEditMode}
                >
                  <option value="">
                    {form.category ? "Select subcategory" : "Choose a category first"}
                  </option>
                  {subcategoryOptions.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Generic attributes */}
            <div className="sell-two-column">
              <label htmlFor="sell-condition">
                Condition
                <select
                  id="sell-condition"
                  value={form.condition}
                  onChange={handleChange("condition")}
                  disabled={isSubmitting}
                >
                  <option value="new">New / with tags</option>
                  <option value="like_new">Like new</option>
                  <option value="used_good">Used · Good</option>
                  <option value="used_fair">Used · Fair</option>
                </select>
              </label>

              <label htmlFor="sell-brand">
                Brand (optional)
                <input
                  id="sell-brand"
                  type="text"
                  value={form.brand}
                  onChange={handleChange("brand")}
                  placeholder="e.g. Apple, Nike, IKEA"
                  disabled={isSubmitting}
                />
              </label>
            </div>

            <div className="sell-two-column">
              <label htmlFor="sell-color">
                Color (optional)
                <input
                  id="sell-color"
                  type="text"
                  value={form.color}
                  onChange={handleChange("color")}
                  placeholder="e.g. black, blue, oak"
                  disabled={isSubmitting}
                />
              </label>

              <label htmlFor="sell-size">
                Size / variant (optional)
                <input
                  id="sell-size"
                  type="text"
                  value={form.size}
                  onChange={handleChange("size")}
                  placeholder="e.g. M, 42, Queen, 256GB"
                  disabled={isSubmitting}
                />
              </label>
            </div>

            <div className="sell-two-column">
              <label htmlFor="sell-location-city">
                City / Area
                <input
                  id="sell-location-city"
                  type="text"
                  value={form.locationCity}
                  onChange={handleChange("locationCity")}
                  placeholder="e.g. Gainesville, FL"
                  disabled={isSubmitting}
                  required
                />
              </label>
            </div>

            {/* Auction settings */}
            <div className="sell-auction-card">
              <h2>Auction settings</h2>

              <div className="sell-two-column">
                <label htmlFor="sell-starting-bid">
                  Starting bid
                  <div className="sell-inline-input">
                    <span className="sell-prefix">$</span>
                    <input
                      id="sell-starting-bid"
                      type="number"
                      min={0}
                      step="1"
                      value={form.startingBid}
                      onChange={handleChange("startingBid")}
                      placeholder="e.g. 50"
                      disabled={isSubmitting || isEditMode}
                      required={!isEditMode}
                    />
                  </div>
                </label>

                <label htmlFor="sell-buy-now">
                  Optional buy‑now price
                  <div className="sell-inline-input">
                    <span className="sell-prefix">$</span>
                    <input
                      id="sell-buy-now"
                      type="number"
                      min={0}
                      step="1"
                      value={form.buyNowPrice}
                      onChange={handleChange("buyNowPrice")}
                      placeholder="Leave empty if not needed"
                      disabled={isSubmitting}
                    />
                  </div>
                </label>
              </div>

              <div className="sell-two-column">
                <label htmlFor="sell-start-time">
                  Auction start time
                  <input
                    id="sell-start-time"
                    type="datetime-local"
                    value={form.startTime}
                    onChange={handleChange("startTime")}
                    min={getMinDateTime()}
                    disabled={isSubmitting || isEditMode}
                  />
                </label>

                <label htmlFor="sell-end-time">
                  Auction end time
                  <input
                    id="sell-end-time"
                    type="datetime-local"
                    value={form.endTime}
                    onChange={handleChange("endTime")}
                    min={form.startTime || getMinDateTime()}
                    disabled={isSubmitting}
                    required
                  />
                </label>
              </div>

              <label htmlFor="sell-pickup-notes">
                Pickup & payment notes
                <textarea
                  id="sell-pickup-notes"
                  value={form.pickupNotes}
                  onChange={handleChange("pickupNotes")}
                  placeholder="e.g. Local pickup only. Cash or digital payments accepted."
                  rows={3}
                  disabled={isSubmitting}
                />
              </label>
            </div>

            <div className="sell-actions">
              <button type="submit" className="sell-btn-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? isEditMode
                    ? "Saving..."
                    : "Publishing..."
                  : isEditMode
                    ? "Save changes"
                    : "Publish auction"}
              </button>
              <p className="sell-disclaimer">
                {isEditMode
                  ? "Starting bid and auction start time cannot be changed after publish."
                  : "Your auction will go live at the chosen start time. You’ll be notified when new bids come in."}
              </p>
            </div>
          </form>
        </section>
      </div>
      </main>
    </div>
  );
};

export default StartSelling;