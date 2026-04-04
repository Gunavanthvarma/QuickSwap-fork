// src/components/sell/StartSelling.tsx
import React, { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiErrorMessage, authHeaders, getApiUrl } from "../../lib/api";
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

const subcategoriesByCategory: Record<string, string[]> = {
  electronics: ["Mobile phones", "Laptops", "Headphones", "Cameras", "Gaming consoles"],
  clothing: ["Men's T‑shirts", "Men's pants", "Women's tops", "Women's pants", "Jackets & coats"],
  home: ["Furniture", "Kitchen & dining", "Home decor", "Bedding", "Storage & organization"],
  books: ["Fiction", "Non‑fiction", "Textbooks", "Comics & graphic novels", "Kids' books"],
  sports: ["Fitness equipment", "Outdoor gear", "Team sports", "Cycling", "Sportswear"],
  other: ["Miscellaneous"],
};

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
      {previewUrl && <img src={previewUrl} alt={file.name} className="sell-photo-img" />}
      <div className="sell-photo-overlay">
        <span className="sell-photo-name" title={file.name}>{file.name}</span>
        <button 
          type="button" 
          onClick={onRemove} 
          className="sell-photo-remove" 
          disabled={disabled}
          title="Remove photo"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const StartSelling: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<StartSellingForm>({
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
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

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
      const combined = [...prev, ...newFiles];
      return combined.slice(0, 6); // Max 6 images
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error("Authentication required. Please log in.");
      }

      if (!form.title.trim() || !form.description.trim() || !form.category || !form.endTime || !form.locationCity.trim()) {
        throw new Error("Please fill out all required fields.");
      }
      if (!form.startingBid || parseFloat(form.startingBid) <= 0) {
        throw new Error("Starting bid must be greater than 0");
      }
      if (photos.length === 0) {
        throw new Error("At least one photo is required");
      }

      const images = await convertPhotosToBase64(photos);

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
        images: images,
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
        method: 'POST',
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

      alert(`Listing created successfully!`);
      navigate('/profile');
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the listing');
      console.error('Error creating listing:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const subcategoryOptions =
    form.category && subcategoriesByCategory[form.category]
      ? subcategoriesByCategory[form.category]
      : [];

  return (
    <div className="sell-page">
      <button className="sell-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="sell-layout">
        {/* Left: photos */}
        <section className="sell-photos-card">
          <h2>Photos</h2>
          <p className="sell-helper">
            Upload clear photos that show the item from multiple angles.
          </p>

          <label className="sell-upload-area">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              style={{ display: "none" }}
              disabled={isSubmitting}
            />
            <span className="sell-upload-icon">＋</span>
            <span>Click to upload or drag and drop</span>
            <span className="sell-upload-sub">
              PNG, JPG up to 10MB each. First photo becomes the cover.
            </span>
          </label>

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
          <h1>Create a new auction</h1>
          <p className="sell-subtitle">
            Describe your item, set a starting bid, and choose when the auction runs.
          </p>

          {error && (
            <div style={{ 
              color: 'red', 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              border: '1px solid #ff6b6b', 
              borderRadius: '4px', 
              backgroundColor: '#ffebee',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <form className="sell-form" onSubmit={handleSubmit}>
            {/* Basic info */}
            <div className="sell-field-group">
              <label>
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={handleChange("title")}
                  placeholder="e.g. Wooden dining table · seats 4"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label>
                Short subtitle
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={handleChange("subtitle")}
                  placeholder="e.g. Solid oak, includes 4 matching chairs"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                Detailed description
                <textarea
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
              <label>
                Category
                <select
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

              <label>
                Subcategory
                <select
                  value={form.subcategory}
                  onChange={handleChange("subcategory")}
                  disabled={!form.category || isSubmitting}
                  required
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
              <label>
                Condition
                <select
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

              <label>
                Brand (optional)
                <input
                  type="text"
                  value={form.brand}
                  onChange={handleChange("brand")}
                  placeholder="e.g. Apple, Nike, IKEA"
                  disabled={isSubmitting}
                />
              </label>
            </div>

            <div className="sell-two-column">
              <label>
                Color (optional)
                <input
                  type="text"
                  value={form.color}
                  onChange={handleChange("color")}
                  placeholder="e.g. black, blue, oak"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                Size / variant (optional)
                <input
                  type="text"
                  value={form.size}
                  onChange={handleChange("size")}
                  placeholder="e.g. M, 42, Queen, 256GB"
                  disabled={isSubmitting}
                />
              </label>
            </div>

            <div className="sell-two-column">
              <label>
                City / Area
                <input
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
                <label>
                  Starting bid
                  <div className="sell-inline-input">
                    <span className="sell-prefix">$</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={form.startingBid}
                      onChange={handleChange("startingBid")}
                      placeholder="e.g. 50"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </label>

                <label>
                  Optional buy‑now price
                  <div className="sell-inline-input">
                    <span className="sell-prefix">$</span>
                    <input
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
                <label>
                  Auction start time
                  <input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={handleChange("startTime")}
                    min={getMinDateTime()}
                    disabled={isSubmitting}
                  />
                </label>

                <label>
                  Auction end time
                  <input
                    type="datetime-local"
                    value={form.endTime}
                    onChange={handleChange("endTime")}
                    min={form.startTime || getMinDateTime()}
                    disabled={isSubmitting}
                    required
                  />
                </label>
              </div>

              <label>
                Pickup & payment notes
                <textarea
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
                {isSubmitting ? "Publishing..." : "Publish auction"}
              </button>
              <p className="sell-disclaimer">
                Your auction will go live at the chosen start time. You’ll be notified when new bids come in.
              </p>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default StartSelling;