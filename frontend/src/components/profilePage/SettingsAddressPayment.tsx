import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ApiAddress, UiSavedPayment, UiPaymentBrand } from "./Profile.types";
import { clearLocalAuth, getApiUrl } from "../../utils/authApi";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeAddress(row: Record<string, unknown>): ApiAddress {
  return {
    id: String(row.id ?? ""),
    full_name: String(row.full_name ?? ""),
    street1: String(row.street1 ?? ""),
    street2: row.street2 != null ? String(row.street2) : "",
    city: String(row.city ?? ""),
    state: row.state != null ? String(row.state) : "",
    zip: row.zip != null ? String(row.zip) : "",
    country: String(row.country ?? ""),
    is_default: Boolean(row.is_default),
  };
}

type AddressFormState = {
  full_name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
};

const emptyAddressForm = (defaultChecked: boolean): AddressFormState => ({
  full_name: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  is_default: defaultChecked,
});

async function addressRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    clearLocalAuth();
    window.location.href = "/signin";
    throw new Error("Not signed in");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) {
    clearLocalAuth();
    window.location.href = "/signin";
    throw new Error(typeof data.error === "string" ? data.error : "Unauthorized");
  }
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  }
  return data as T;
}

const emptyPaymentForm = (): Omit<UiSavedPayment, "id" | "isDefault"> => ({
  brand: "visa",
  last4: "",
  expMonth: "",
  expYear: "",
});

// ─── Card brand icon (visual only) ───────────────────────────────────────────

const CardBrandIcon: React.FC<{ brand: UiPaymentBrand }> = ({ brand }) => (
  <span className={`settings-payment-brand settings-payment-brand--${brand}`}>
    {brand === "visa" && (
      <svg viewBox="0 0 48 32" width="44" height="30" aria-hidden>
        <rect fill="#1a1f71" width="48" height="32" rx="4" />
        <text x="24" y="21" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">
          VISA
        </text>
      </svg>
    )}
    {brand === "mastercard" && (
      <svg viewBox="0 0 48 32" width="44" height="30" aria-hidden>
        <rect fill="#f3f4f6" width="48" height="32" rx="4" />
        <circle cx="22" cy="16" r="9" fill="#eb001b" opacity="0.92" />
        <circle cx="26" cy="16" r="9" fill="#f79e1b" opacity="0.92" />
      </svg>
    )}
    {brand === "amex" && (
      <svg viewBox="0 0 48 32" width="44" height="30" aria-hidden>
        <rect fill="#006fcf" width="48" height="32" rx="4" />
        <text x="24" y="20" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="system-ui,sans-serif">
          AMEX
        </text>
      </svg>
    )}
    {brand === "other" && <span className="settings-payment-brand-fallback">Card</span>}
  </span>
);

// ─── Address section (GET/POST/PUT/DELETE /api/address) ─────────────────────

export const AddressDetailsSection: React.FC = () => {
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingDefaultId, setMarkingDefaultId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(() => emptyAddressForm(true));

  const loadAddresses = useCallback(async (opts?: { quiet?: boolean }) => {
    setListError(null);
    if (!opts?.quiet) setLoading(true);
    try {
      const raw = await addressRequest<Record<string, unknown>[] | unknown>("/api/address", {
        method: "GET",
      });
      const rows = Array.isArray(raw) ? raw : [];
      setAddresses(rows.map((row) => normalizeAddress(row as Record<string, unknown>)));
    } catch (e) {
      setAddresses([]);
      setListError(e instanceof Error ? e.message : "Failed to load addresses");
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  const openAdd = () => {
    setEditingId(null);
    setModalError(null);
    setForm(emptyAddressForm(addresses.length === 0));
    setModalOpen(true);
  };

  const openEdit = (a: ApiAddress) => {
    setEditingId(a.id);
    setModalError(null);
    setForm({
      full_name: a.full_name,
      street1: a.street1,
      street2: a.street2,
      city: a.city,
      state: a.state,
      zip: a.zip,
      country: a.country,
      is_default: a.is_default,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setModalError(null);
  };

  const payloadFromForm = (f: AddressFormState) => ({
    full_name: f.full_name.trim(),
    street1: f.street1.trim(),
    street2: f.street2.trim(),
    city: f.city.trim(),
    state: f.state.trim(),
    zip: f.zip.trim(),
    country: f.country.trim(),
    is_default: f.is_default,
  });

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const body = payloadFromForm(form);
    if (!body.full_name || !body.street1 || !body.city || !body.country) {
      setModalError("Full name, address line 1, city, and country are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await addressRequest(`/api/address/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await addressRequest<Record<string, unknown>>("/api/address", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await loadAddresses({ quiet: true });
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Could not save address");
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    if (!window.confirm("Remove this address?")) return;
    setListError(null);
    try {
      await addressRequest(`/api/address/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadAddresses({ quiet: true });
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not delete address");
    }
  };

  const setDefaultAddress = async (a: ApiAddress) => {
    if (a.is_default) return;
    setMarkingDefaultId(a.id);
    setListError(null);
    try {
      await addressRequest(`/api/address/${encodeURIComponent(a.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: a.full_name,
          street1: a.street1,
          street2: a.street2,
          city: a.city,
          state: a.state,
          zip: a.zip,
          country: a.country,
          is_default: true,
        }),
      });
      await loadAddresses({ quiet: true });
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not update default");
    } finally {
      setMarkingDefaultId(null);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Address details</h2>
        {!loading && addresses.length > 0 && (
          <button type="button" className="btn primary" onClick={openAdd}>
            Add address
          </button>
        )}
      </div>

      {loading && <p className="settings-inline-status">Loading addresses…</p>}
      {listError && !loading && (
        <div className="settings-error-row" role="alert">
          <p className="edit-profile-error settings-error-text">{listError}</p>
          <button type="button" className="btn ghost" onClick={() => void loadAddresses()}>
            Retry
          </button>
        </div>
      )}

      {!loading && addresses.length === 0 && (
        <div className="settings-empty-state">
          <p>No address saved</p>
          <button type="button" className="btn primary" onClick={openAdd}>
            Add address
          </button>
        </div>
      )}

      {!loading && addresses.length > 0 && (
        <div className="settings-cards-grid">
          {addresses.map((a) => (
            <article key={a.id} className="settings-detail-card">
              {a.is_default && <span className="settings-default-pill">Default</span>}
              <h3 className="settings-detail-card-title">{a.full_name || "Saved address"}</h3>
              <p className="settings-detail-card-lines">
                {a.street1}
                {a.street2 ? (
                  <>
                    <br />
                    {a.street2}
                  </>
                ) : null}
                <br />
                {a.city}, {a.state} {a.zip}
                <br />
                {a.country}
              </p>
              <div className="settings-detail-card-actions">
                {!a.is_default && (
                  <button
                    type="button"
                    className="btn-link"
                    disabled={markingDefaultId === a.id}
                    onClick={() => void setDefaultAddress(a)}
                  >
                    {markingDefaultId === a.id ? "Updating…" : "Mark as default"}
                  </button>
                )}
                <button type="button" className="btn ghost" onClick={() => openEdit(a)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: "var(--error)" }}
                  onClick={() => void removeAddress(a.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen &&
        createPortal(
          <div className="edit-profile-modal-overlay" role="presentation" onClick={closeModal}>
            <div
              className="edit-profile-modal-content"
              role="dialog"
              aria-modal="true"
              aria-labelledby="address-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="address-modal-title">{editingId ? "Edit address" : "Add address"}</h2>
              <form className="edit-profile-form" onSubmit={(e) => void saveAddress(e)}>
                {modalError ? (
                  <p className="edit-profile-error" role="alert">
                    {modalError}
                  </p>
                ) : null}
                <div className="settings-group">
                  <label htmlFor="addr-name">Full name *</label>
                  <input
                    id="addr-name"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                    disabled={saving}
                    autoComplete="name"
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="addr-line1">Address line 1 *</label>
                  <input
                    id="addr-line1"
                    value={form.street1}
                    onChange={(e) => setForm((f) => ({ ...f, street1: e.target.value }))}
                    required
                    disabled={saving}
                    autoComplete="street-address"
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="addr-line2">Address line 2</label>
                  <input
                    id="addr-line2"
                    value={form.street2}
                    onChange={(e) => setForm((f) => ({ ...f, street2: e.target.value }))}
                    disabled={saving}
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="addr-city">City *</label>
                  <input
                    id="addr-city"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="settings-address-row">
                  <div className="settings-group">
                    <label htmlFor="addr-state">State / Region</label>
                    <input
                      id="addr-state"
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      disabled={saving}
                    />
                  </div>
                  <div className="settings-group">
                    <label htmlFor="addr-zip">Postal / ZIP</label>
                    <input
                      id="addr-zip"
                      value={form.zip}
                      onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="settings-group">
                  <label htmlFor="addr-country">Country *</label>
                  <input
                    id="addr-country"
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    required
                    disabled={saving}
                    autoComplete="country-name"
                  />
                </div>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    disabled={saving}
                    onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                  />
                  <span>Use as default address</span>
                </label>
                <div className="edit-profile-actions">
                  <button type="button" className="btn ghost" onClick={closeModal} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn primary" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Payment section ─────────────────────────────────────────────────────────

export const PaymentDetailsSection: React.FC = () => {
  const [payments, setPayments] = useState<UiSavedPayment[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(() => emptyPaymentForm());

  const openAdd = () => {
    setForm(emptyPaymentForm());
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const savePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = form.last4.replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) return;
    const m = form.expMonth.replace(/\D/g, "").slice(0, 2);
    const y = form.expYear.replace(/\D/g, "").slice(0, 4);
    if (!m || !y) return;

    const id = newId();
    setPayments((prev) => {
      const isFirst = prev.length === 0;
      const next: UiSavedPayment = {
        id,
        brand: form.brand,
        last4: digits,
        expMonth: m.padStart(2, "0"),
        expYear: y.length === 2 ? `20${y}` : y,
        isDefault: isFirst,
      };
      return [...prev, next];
    });
    closeModal();
  };

  const removePayment = (id: string) => {
    if (!window.confirm("Remove this payment method?")) return;
    setPayments((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed?.isDefault && next.length > 0) {
        return next.map((p, i) => (i === 0 ? { ...p, isDefault: true } : { ...p, isDefault: false }));
      }
      return next;
    });
  };

  const setDefaultPayment = (id: string) => {
    setPayments((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Payment details</h2>
        {payments.length > 0 && (
          <button type="button" className="btn primary" onClick={openAdd}>
            Add payment method
          </button>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="settings-empty-state">
          <p>No payment method saved</p>
          <button type="button" className="btn primary" onClick={openAdd}>
            Add payment method
          </button>
        </div>
      ) : (
        <div className="settings-cards-grid settings-cards-grid--payment">
          {payments.map((p) => (
            <article key={p.id} className="settings-payment-card">
              <div className="settings-payment-card-top">
                <CardBrandIcon brand={p.brand} />
                {p.isDefault && <span className="settings-default-pill">Default</span>}
              </div>
              <p className="settings-payment-number">
                <span aria-hidden>••••</span> {p.last4}
              </p>
              <p className="settings-payment-exp">
                Expires {p.expMonth}/{p.expYear.slice(-2)}
              </p>
              <div className="settings-detail-card-actions">
                {!p.isDefault && (
                  <button type="button" className="btn-link" onClick={() => setDefaultPayment(p.id)}>
                    Mark as default
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost"
                  style={{ color: "var(--error)" }}
                  onClick={() => removePayment(p.id)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen &&
        createPortal(
          <div className="edit-profile-modal-overlay" role="presentation" onClick={closeModal}>
            <div
              className="edit-profile-modal-content"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="payment-modal-title">Add payment method</h2>
              <p className="settings-modal-hint">For display only — not saved to a server in this build.</p>
              <form className="edit-profile-form" onSubmit={savePayment}>
                <div className="settings-group">
                  <label htmlFor="pay-brand">Card type</label>
                  <select
                    id="pay-brand"
                    className="settings-select"
                    value={form.brand}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, brand: e.target.value as UiPaymentBrand }))
                    }
                  >
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="amex">American Express</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="settings-group">
                  <label htmlFor="pay-last4">Last 4 digits *</label>
                  <input
                    id="pay-last4"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4242"
                    value={form.last4}
                    onChange={(e) => setForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    required
                  />
                </div>
                <div className="settings-address-row">
                  <div className="settings-group">
                    <label htmlFor="pay-mm">Expiry month *</label>
                    <input
                      id="pay-mm"
                      inputMode="numeric"
                      placeholder="MM"
                      maxLength={2}
                      value={form.expMonth}
                      onChange={(e) => setForm((f) => ({ ...f, expMonth: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                      required
                    />
                  </div>
                  <div className="settings-group">
                    <label htmlFor="pay-yy">Expiry year *</label>
                    <input
                      id="pay-yy"
                      inputMode="numeric"
                      placeholder="YYYY"
                      maxLength={4}
                      value={form.expYear}
                      onChange={(e) => setForm((f) => ({ ...f, expYear: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      required
                    />
                  </div>
                </div>
                <div className="edit-profile-actions">
                  <button type="button" className="btn ghost" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn primary">
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
