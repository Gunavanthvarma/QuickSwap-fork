export interface ProfileResponse {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
}

export interface MyListingApiItem {
  listing_id: string;
  title: string;
  image: string;
  current_bid: number;
  time_left: string;
  total_bids: number;
  status: string;
}

export interface MyBidsApiItem {
  id: string;
  listing_id: string;
  user_id: string;
  title: string;
  image: string;
  bid_amount: number;
  timestamp: string;
  status: string;
  is_auto_bid: boolean;
  bid_sequence: number;
  current_bid: number;
  auction_end_time: string;
  time_left: string;
  label: string;
}

export interface ListingCardItem {
  id: string;
  name: string;
  image: string;
  currentBid: string;
  timeLeft: string;
  bids: number;
  status: "active" | "sold";
}

export interface BidCardItem {
  id: string;
  name: string;
  image: string;
  yourBid: string;
  currentBid: string;
  timeLeft: string;
  status: "winning" | "outbid" | "lost";
}

export interface EditFormState {
  first_name: string;
  last_name: string;
  mobile: string;
}

export interface UpdatePasswordFormState {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export type ActiveTab = "listings" | "bids" | "settings";

/** Local-only UI models for payment settings (not persisted to API yet). */
export type UiPaymentBrand = "visa" | "mastercard" | "amex" | "other";

/** Address row from GET /api/address (matches backend / Supabase). */
export interface ApiAddress {
  id: string;
  full_name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
}

export interface UiSavedPayment {
  id: string;
  brand: UiPaymentBrand;
  last4: string;
  expMonth: string;
  expYear: string;
  isDefault: boolean;
}