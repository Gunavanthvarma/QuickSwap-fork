export interface ProfileResponse {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  mobile?: string;
  /** ISO timestamp from `profiles.created_at` when returned by the API */
  created_at?: string;
  /** Optional `profiles.location` (city, region, etc.) */
  location?: string;
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

/** JSON body from GET /api/mylistings */
export interface MyListingsApiResponse {
  listings?: MyListingApiItem[];
  error?: string;
  message?: string;
}

/** JSON body from GET /api/mybids when wrapped in an object */
export interface MyBidsApiResponse {
  bids?: MyBidsApiItem[];
  error?: string;
  message?: string;
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
  status: "active" | "sold" | "unsold";
}

export interface BidCardItem {
  id: string;
  name: string;
  image: string;
  yourBid: string;
  currentBid: string;
  timeLeft: string;
  status: "winning" | "bid_more" | "lost" | "won";
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

/** Card brand for icons (mapped from `card_type` strings). */
export type UiPaymentBrand = "visa" | "mastercard" | "amex" | "other";

/** Payment method from GET /api/add-payment (matches backend / Supabase). */
export interface ApiPaymentMethod {
  id: string;
  card_type: string;
  last4: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
}

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
