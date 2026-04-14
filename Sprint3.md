# QuickSwap – Sprint 3

---

## Work Completed

### Frontend

#### App shell & routing (`frontend/src/App.tsx`)
- **Lazy-loaded** pages with a shared `Suspense` fallback (“Loading…”).
- **`/`** — `LandingPage` when logged out, **`LoggedInLandingPage`** when logged in.
- **Auth routes**: `/signin`, `/signup`.
- **Auction**: `/auction`, `/auction/:id` (public).
- **Explore** (public): `/explore/trending`, `/explore/ending-soon`, `/explore/starting-soon` → **`ExploreListingsPage`** with a `mode` prop.
- **Protected** (wrapped in **`ProtectedRoute`**, redirects to `/signin` with return state): `/profile`, `/start_selling`, **`/edit-listing/:id`** (reuse **`StartSelling`** in edit mode).
- Root layout: **`AuthProvider`** wraps **`BrowserRouter`** so auth context and session reconciliation apply to all routes.

#### Authentication & session (`frontend/src/auth/`)
- **`AuthProvider.tsx`** — Initializes user from **`getValidUserFromStorage()`**; listens for **`AUTH_SESSION_EXPIRED_EVENT`**; **reconciles** session on route changes (`pathname` / search / hash), on a **60s interval**, and on **window focus**; **logout** clears tokens, user cache, and **TanStack Query** `topListingsQuery` data, then navigates home.
- **`auth-context.ts`** — **`readUserFromStorage`**, **`getValidUserFromStorage`** (honours **`accessTokenExpiry`** with a small skew so the client treats the session as expired slightly early), **`clearAuthStorage`**, **`notifyAuthSessionExpired`** (clears storage + dispatches event). Used by API paths that receive **401** to sync UI.
- **Sign-in / sign-up** — Persist **`accessToken`**, **`refreshToken`**, **`accessTokenExpiry`**, and **`user`** JSON for profile cache.
- **`useSignInRedirect`** — Navigate to `/signin` with **`state.from`** for post-login return (used by **`NotificationsBell`** when no token).

#### API helpers (`frontend/src/lib/`)
- **`api.ts`** — **`getApiUrl`**, **`getSSEUrl`** (absolute URL for **`EventSource`** when the API base is relative), **`authHeaders`**, **`apiErrorMessage`**, **`isRecord`**, **`isFetchAborted`**.
- **`listingApi.ts`** — **`fetchNotifications`**, **`fetchUnreadNotificationCount`**, **`markNotificationRead`**, **`markAllNotificationsRead`**, **`deleteListing`** (`DELETE /api/listing?id=…`), plus shared **`NotificationItem`** typing.

#### Notifications UI (`frontend/src/components/notifications/`)
- **`NotificationsBell.tsx`** — Renders only when **`isAuthenticated`**; polls **unread count** on an interval and on **`visibilitychange`**; bell toggles a panel that loads **`GET /api/notifications`**; **Mark all read**, per-item read + navigate to **`/auction/{listing_id}`**; click-outside and **Escape** close the panel; badge shows count or **`99+`**.

#### Landing, home feed & explore (`frontend/src/components/landingPage/`)
- **`useTopListingsQuery` / `topListingsQuery.ts`** — **TanStack React Query** for **`GET /api/toplistings`**; shared query key cleared on logout / session expiry.
- **`TopListingsStrip`** — Optional **`hideWhenEmpty`**, plain **`emptyText`**, or rich **`emptyState`** with **`StripEmptyStateView`** (illustrations + CTA); **`Show all`** when **`onShowAll`** is set and items exist; carousel vs grid **`layout`**.
- **`loggedin_landing_page.tsx`** — Logged-in hero + strips for trending / ending soon / starting soon; embeds **`NotificationsBell`** in the navbar.
- **`explore_listings_page.tsx`** — Single-feed explore pages driven by **`mode`**; back + profile actions in header.

#### Auction detail & live bids (`frontend/src/components/auction/`)
- **`auction_detail.tsx`** — Loads listing via **`GET /api/listing?id=`**; **`EventSource`** on **`getSSEUrl('/api/ws/auctions/{id}')`** for **`bid_update`** events; local state for **live bid**, SSE connection status, countdown (**`auctionCountdown.ts`**: server skew, **`formatCountdown`**, etc.); place bid **`POST /api/auctions/{id}/bid`**; seller **delete listing** via **`deleteListing`**.
- **`auctionCountdown.ts`** — Parsed/time-sync helpers covered by unit tests.

#### Start selling (create & edit) (`frontend/src/components/auction/start_selling.tsx`)
- **Create** flow: **`POST /api/createlisting`**; success card with links to listing, profile, or create another.
- **Edit** flow: route **`/edit-listing/:id`** loads existing listing, submits updates via **`PUT /api/listing`**, success copy distinguishes **updated** vs **published**.

#### Profile & settings (`frontend/src/components/profilePage/`)
- **`ProfilePage.tsx`** — **`ProfileNavbar`** (back, browse/sell/profile nav, **`NotificationsBell`**); **`ProfileHeader`** (initials avatar, display name, email, **Member since**, phone, **location**, **bio** read-only grid, edit button); **`ProfileHeaderCharts`** (listings active/sold + bids winning/outbid/lost donuts); tabs **Listings / Bids / Settings**.
- **`ProfileHooks.tsx`** — Loads **`GET /api/profile`**, merges into cached user; **edit profile** modal submit **`PUT /api/profile/update`** with **first_name, last_name, mobile** from the form and **preserves existing `bio` / `location`** from the cached user (those fields are **not** shown in the edit modal); password change with **`old_password`**, **`new_password`**, **`re_enter_new_password`**; **delete account** **`DELETE /api/profile/account`** with **`formatDeleteAccountApiError`** for readable Postgres/Supabase FK errors; **My Bids** tab refreshes on an interval and on window focus while active.
- **`Profilecomponents.tsx`** — **`ListingsTab`** / **`BidsTab`** cards navigate to **`/auction/{id}`**; listings may **delete** seller’s listing via **`deleteListing`**; **`SettingsTab`** wires **Edit profile**, **Update password**, **Delete account**; optional **`deleteAccountNotice`** when bids are loading, bids request failed, or user has bids (informational only, button stays enabled); **`SettingsAddressPayment.tsx`** for address and payment CRUD against **`/api/address`** and **`/api/add-payment`**.

#### Global test harness (`frontend/src/test/setup.ts`)
- In-memory **`localStorage`** polyfill when the Node/Vitest environment exposes a broken storage API (keeps auth/notification tests stable).

---

### Backend

#### 1. Profile Settings Endpoints
Extended the user profile surface with update, password-change, account-deletion, and stats endpoints.

- `PUT /api/profile/update` — Update first name, last name, mobile, bio, and location.
- `PUT /api/profile/password` — Change password with old-password verification. Validates length ≥ 6, new-password match, and re-authenticates with Supabase before applying.
- `DELETE /api/profile/account` — Permanently delete the authenticated user's Supabase account (requires service key). **When PostgreSQL is connected (`DATABASE_URL`), the handler first deletes that user’s rows in `bids` and `notifications` so foreign-key constraints do not block Supabase Admin user deletion.**
- `GET /api/profile/stats` — Return aggregate stats for the user (e.g. `items_sold` count).

#### 2. Address Management Endpoints
Full CRUD for saved shipping addresses, including a default-address promotion flow.

- `GET /api/address` — List all addresses for the authenticated user.
- `POST /api/address` — Add a new address (`full_name`, `street1`, `city`, `country` required). When `is_default: true`, clears the existing default first.
- `GET /api/address/{id}` — Fetch a single address by ID.
- `PUT /api/address/{id}` — Update an address by ID. Same default-promotion logic as POST.
- `DELETE /api/address/{id}` — Delete an address by ID.

#### 3. Payment Method Endpoints
Manage saved payment cards with validation on card fields.

- `GET /api/add-payment` — List all payment methods for the authenticated user.
- `POST /api/add-payment` — Add a payment method (`card_type`, `last4` (exactly 4 digits), `expiry_month`, `expiry_year` required). Default-promotion flow applied when `is_default: true`.
- `GET /api/add-payment/{id}` — Fetch a single payment method by ID.
- `DELETE /api/add-payment/{id}` — Remove a payment method by ID.

#### 4. Single Listing Management (GET / PUT / DELETE)
Unified handler at `/api/listing` that supports public viewing, seller-only editing, and deletion.

- `GET /api/listing?id=<uuid>` — Public endpoint; returns full listing detail, seller profile, current highest bid, and full bid history.
- `PUT /api/listing?id=<uuid>` — Auth required. Seller-only update (title, description, category, images, end time, location, etc.). Returns the updated listing.
- `DELETE /api/listing?id=<uuid>` — Auth required. Seller-only deletion.

#### 5. Notification System
Five endpoints backed directly by PostgreSQL (`notifications` table).

- `GET /api/notifications` — Return all notifications for the user, ordered newest first.
- `GET /api/notifications/count` — Return the unread notification count (`unread_count`).
- `PUT /api/notifications/read-all` — Mark every notification for the user as read.
- `PUT /api/notifications/{id}/read` — Mark a single notification as read.
- `DELETE /api/notifications/{id}` — Delete a single notification.

#### 6. Real-Time Auction Updates via SSE
Server-Sent Events stream powered by Redis Pub/Sub.

- `GET /api/ws/auctions/{id}` — Opens a persistent SSE connection. Each bid placed on the auction publishes an event to the Redis channel `auction:events:<id>`; the handler forwards it to the browser client as an `bid_update` event with the full bid payload.

#### 7. Auction Settlement Worker
Background goroutine (`StartAuctionSettlementWorker`) that runs on server start.

- Polls a Redis sorted set every 30 seconds for auctions whose end time has passed.
- Marks each expired auction as `settled` in PostgreSQL.
- Reads the winning bid (highest) from Redis; writes the winner to the DB.
- Calls `createAuctionEndedNotifications` to insert notifications for:
  - **Seller** – "Your auction has ended" (with or without a winner).
  - **Winner** – "You won an auction!" (with winning price).
- Ensures the `listings` table has the required `settled` and `winner_id` columns via a one-time migration on startup.

---

## Frontend Unit Tests

All tests run with **Vitest** + **jsdom** + **Testing Library** (`npm test`). Config: `frontend/vitest.config.ts` (includes `src/test/setup.ts`).

| File | What it covers |
|------|----------------|
| `src/lib/__tests__/api.test.ts` | `isRecord`, `isFetchAborted`, `getApiUrl` / `getSSEUrl`, `apiErrorMessage`. |
| `src/lib/__tests__/listingApi.test.ts` | Mocked `fetch`: notifications list/count, mark read / mark all read, `deleteListing`, error paths. |
| `src/auth/__tests__/auth-context.test.ts` | `clearAuthStorage`, `readUserFromStorage`, `getValidUserFromStorage` (expiry skew), `notifyAuthSessionExpired`. |
| `src/components/notifications/__tests__/NotificationsBell.test.tsx` | Auth gate, badge / `99+`, panel load, redirect without token, mark all read, navigation on item, API error alert. |
| `src/components/profilePage/__tests__/Profilecomponents.test.tsx` | Listings/Bids tabs, **ProfileHeader**, **ProfileTabs**, **SettingsTab** actions. |
| `src/components/profilePage/__tests__/ProfileHeaderCharts.test.tsx` | Loading, empty, and populated chart **aria-label** / legends. |
| `src/components/profilePage/__tests__/ProfileHooks.test.ts` | `formatCurrency`, `getApiUrl`, **`formatDeleteAccountApiError`** (FK / bids messaging). |
| `src/components/landingPage/__tests__/top_listings_strip.test.tsx` | `hideWhenEmpty`, plain vs rich empty state, card click, Show all, **`StripEmptyStateView`** CTA-only layout. |
| `src/components/auction/__tests__/auctionCountdown.test.ts` | `parseTimeSyncPayload`, `computeServerSkewMs`, `remainingUntilEndMs`, `formatCountdown`. |

---

## Backend Unit Tests

All tests use `net/http/httptest` mock servers; no live Supabase or Redis connections are required.

### Auth (`auth_test.go`)

| Test | Description |
|------|-------------|
| `TestLoginHandler` | Rejects missing email (400); succeeds with valid credentials (200). |
| `TestSignupHandler` | Rejects missing email (400); succeeds with all required fields (200). |
| `TestLogoutHandler` | Rejects missing token (401); succeeds with valid Bearer token (200). |
| `TestMeHandler` | Returns 200 with a valid Bearer token. |
| `TestProfileHandler` | Returns 200 for an authenticated GET. |

### Handlers / Bid (`handlers_test.go`)

| Test | Description |
|------|-------------|
| `TestNewRouter` | Asserts `NewRouter` returns a non-nil handler. |
| `TestBidHandler` | Rejects requests with no Authorization header (401). |

### Bids & Top Listings (`bids_test.go`)

| Test | Description |
|------|-------------|
| `TestMyBidsHandler` | Rejects unauthenticated requests (401); returns 200 with a valid token. |
| `TestTopListingsHandler` | Returns 200 without auth (public endpoint). |

### Listings (`listing_test.go`)

| Test | Description |
|------|-------------|
| `TestMyListingHandler` | Rejects unauthenticated requests (401); returns 200 with token. |
| `TestCreateListingHandler` | Rejects unauthenticated requests (401); rejects missing fields (400). |
| `TestGetSingleListing_NoID` | Returns 400 when `id` query param is absent. |
| `TestGetSingleListing_Valid` | Returns 200 for a valid `?id=` with auth. |
| `TestGetSingleListing_NoToken` | Returns 200 — GET is a public operation. |
| `TestUpdateListing_NoToken` | Returns 401 for PUT without auth. |
| `TestUpdateListing_NoID` | Returns 400 for PUT without `id`. |
| `TestUpdateListing_Valid` | Returns 200 for authenticated PUT with all required fields. |
| `TestDeleteListing_NoToken` | Returns 401 for DELETE without auth. |
| `TestDeleteListing_NoID` | Returns 400 for DELETE without `id`. |
| `TestDeleteListing_Valid` | Returns 200 for authenticated DELETE with valid `id`. |
| `TestSingleListingHandler_MethodNotAllowed` | Returns 405 for unsupported methods (e.g. POST). |

### Profile (`profile_test.go`)

| Test | Description |
|------|-------------|
| `TestGetUserIDFromToken_MissingToken` | Returns error when Authorization header is absent. |
| `TestGetUserIDFromToken_Valid` | Returns `user123` for a valid Bearer token. |
| `TestSupabaseAPIKey` | Prefers `SUPABASE_SERVICE_KEY` over `SUPABASE_ANON_KEY`. |
| `TestStoreProfile` | Successfully inserts profile row into Supabase. |
| `TestStoreProfile_EmptyURL` | Skips insert gracefully when `SUPABASE_URL` is unset. |
| `TestGetProfile` | Returns a non-nil profile map for a known user. |
| `TestUpdateProfileHandler_WrongMethod` | Returns 405 for non-PUT methods. |
| `TestUpdateProfileHandler_NoToken` | Returns 401 without auth. |
| `TestUpdateProfileHandler_Valid` | Returns 200 for authenticated PUT with valid fields. |
| `TestAddressHandler_GetNoToken` | Returns 401 for unauthenticated GET. |
| `TestAddressHandler_GetValid` | Returns 200 for authenticated GET. |
| `TestAddressHandler_PostNoToken` | Returns 401 for unauthenticated POST. |
| `TestAddressHandler_PostMissingFields` | Returns 400 when required address fields are absent. |
| `TestAddressHandler_PostValid` | Returns 200 for authenticated POST with all required fields. |
| `TestAddressHandler_PostIsDefault` | Returns 200 when `is_default: true` is set (clears old default). |
| `TestAddressHandler_MethodNotAllowed` | Returns 405 for DELETE on the collection route. |
| `TestAddressByIDHandler_GetNoToken` | Returns 401 for unauthenticated GET by ID. |
| `TestAddressByIDHandler_GetValid` | Returns 200 for authenticated GET by ID. |
| `TestAddressByIDHandler_PutNoToken` | Returns 401 for unauthenticated PUT. |
| `TestAddressByIDHandler_PutValid` | Returns 200 for authenticated PUT with valid fields. |
| `TestAddressByIDHandler_PutIsDefault` | Returns 200 when promoting a different address to default. |
| `TestAddressByIDHandler_DeleteNoToken` | Returns 401 for unauthenticated DELETE. |
| `TestAddressByIDHandler_DeleteValid` | Returns 200 for authenticated DELETE by ID. |
| `TestAddressByIDHandler_MethodNotAllowed` | Returns 405 for POST on the by-ID route. |
| `TestPaymentHandler_GetNoToken` | Returns 401 for unauthenticated GET. |
| `TestPaymentHandler_GetValid` | Returns 200 for authenticated GET. |
| `TestPaymentHandler_PostNoToken` | Returns 401 for unauthenticated POST. |
| `TestPaymentHandler_PostMissingFields` | Returns 400 when required card fields are absent. |
| `TestPaymentHandler_PostInvalidLast4` | Returns 400 when `last4` is not exactly 4 digits. |
| `TestPaymentHandler_PostValid` | Returns 200 for authenticated POST with valid card data. |
| `TestPaymentHandler_PostIsDefault` | Returns 200 when `is_default: true` is set. |
| `TestPaymentHandler_MethodNotAllowed` | Returns 405 for unsupported method (DELETE on collection route). |
| `TestPaymentByIDHandler_GetNoToken` | Returns 401 for unauthenticated GET by ID. |
| `TestPaymentByIDHandler_GetValid` | Returns 200 for authenticated GET by ID. |
| `TestPaymentByIDHandler_DeleteNoToken` | Returns 401 for unauthenticated DELETE. |
| `TestPaymentByIDHandler_DeleteValid` | Returns 200 for authenticated DELETE by ID. |
| `TestPaymentByIDHandler_MethodNotAllowed` | Returns 405 for PUT on the by-ID route. |
| `TestUpdatePasswordHandler_WrongMethod` | Returns 405 for non-PUT methods. |
| `TestUpdatePasswordHandler_NoToken` | Returns 401 without auth. |
| `TestUpdatePasswordHandler_MissingFields` | Returns 400 when `new_password` or `re_enter_new_password` is absent. |
| `TestUpdatePasswordHandler_PasswordMismatch` | Returns 400 when new passwords do not match. |
| `TestUpdatePasswordHandler_TooShort` | Returns 400 when new password is fewer than 6 characters. |
| `TestUpdatePasswordHandler_WrongOldPassword` | Returns 401 when old password is incorrect. |
| `TestUpdatePasswordHandler_Valid` | Returns 200 for valid password change. |
| `TestDeleteAccountHandler_WrongMethod` | Returns 405 for non-DELETE methods. |
| `TestDeleteAccountHandler_NoToken` | Returns 401 without auth. |
| `TestDeleteAccountHandler_NoServiceKey` | Returns 500 when `SUPABASE_SERVICE_KEY` is unset. |
| `TestDeleteAccountHandler_Valid` | Returns 200 for authenticated DELETE. |
| `TestProfileStatsHandler_WrongMethod` | Returns 405 for non-GET methods. |
| `TestProfileStatsHandler_NoToken` | Returns 401 without auth. |
| `TestProfileStatsHandler_Valid` | Returns 200 and correct `items_sold` count from mock listings. |
| `TestProfileStatsHandler_Zero` | Returns 200 with `items_sold: 0` when no ended auctions exist. |

---

## Updated Backend API Documentation

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | No | Register a new user. |
| POST | `/api/auth/login` | No | Authenticate and receive a session token. |
| POST | `/api/auth/logout` | Bearer | Invalidate the current session. |
| GET | `/api/auth/me` | Bearer | Return the current user's ID and email. |

### User Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/profile` | Bearer | Retrieve the full profile of the logged-in user. |
| PUT | `/api/profile/update` | Bearer | Update first name, last name, mobile, bio, and location. |
| PUT | `/api/profile/password` | Bearer | Change password (requires `old_password`, `new_password`, `re_enter_new_password`). |
| DELETE | `/api/profile/account` | Bearer | Permanently delete the user's account. |
| GET | `/api/profile/stats` | Bearer | Return profile stats (`items_sold`). |

#### PUT `/api/profile/update` — Request Body
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "mobile": "9876543210",
  "bio": "Vintage collector.",
  "location": "Mumbai, India"
}
```
- **200 OK**: `{"message": "Profile updated"}`
- **401 Unauthorized**: Missing or invalid token.
- **405 Method Not Allowed**: Non-PUT request.

#### PUT `/api/profile/password` — Request Body
```json
{
  "old_password": "currentPass1",
  "new_password": "newPass123",
  "re_enter_new_password": "newPass123"
}
```
- **200 OK**: `{"message": "Password updated"}`
- **400 Bad Request**: Missing fields, password mismatch, or password < 6 characters.
- **401 Unauthorized**: Wrong old password or missing token.

#### GET `/api/profile/stats` — Response
```json
{
  "items_sold": 5
}
```

---

### Listings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/createlisting` | Bearer | Create a new auction listing. |
| GET | `/api/mylistings` | Bearer | Get all listings created by the logged-in user. |
| GET | `/api/toplistings` | No | Get trending, ending-soon, and starting-soon listings (max 5 each). |
| GET | `/api/listing?id=<uuid>` | No | Get a single listing with seller info and bid history. |
| PUT | `/api/listing?id=<uuid>` | Bearer | Update a listing (seller only). |
| DELETE | `/api/listing?id=<uuid>` | Bearer | Delete a listing (seller only). |

#### GET `/api/listing?id=<uuid>` — Response (200 OK)
```json
{
  "listing": { "id": "...", "title": "...", "description": "...", "category": "...", "images": ["..."], "starting_bid": 15.00, "current_bid": 25.00, "auction_end_time": "...", "location": "..." },
  "seller": { "first_name": "John", "last_name": "Doe" },
  "bids": [{ "user_id": "...", "bid_amount": 25.00 }]
}
```
- **400 Bad Request**: Missing `id` query parameter.

#### PUT `/api/listing?id=<uuid>` — Request Body
```json
{
  "title": "Updated Title",
  "description": "Updated description.",
  "category": "Electronics",
  "images": ["https://..."],
  "auction_end_time": "2025-06-01T15:00:00Z",
  "location": "Delhi, India"
}
```
- **200 OK**: Updated listing object.
- **400 Bad Request**: Missing `id` or required fields.
- **401 Unauthorized**: Not authenticated.

---

### Bidding

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/mybids` | Bearer | Get bid history for the logged-in user. |
| POST | `/api/auctions/{id}/bid` | Bearer | Place a bid on an auction. |

#### POST `/api/auctions/{id}/bid` — Request Body
```json
{ "amount": 45.00 }
```
- **200 OK**: `{"message": "Bid placed successfully"}`
- **400 Bad Request**: Bid too low, auction ended, or invalid payload.
- **401 Unauthorized**: Missing or invalid token.
- **404 Not Found**: Auction does not exist.

---

### Addresses

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/address` | Bearer | List all saved addresses. |
| POST | `/api/address` | Bearer | Add a new address. |
| GET | `/api/address/{id}` | Bearer | Get a single address by ID. |
| PUT | `/api/address/{id}` | Bearer | Update an address by ID. |
| DELETE | `/api/address/{id}` | Bearer | Delete an address by ID. |

#### POST `/api/address` — Request Body
```json
{
  "full_name": "John Doe",
  "street1": "123 Main St",
  "street2": "Apt 4B",
  "city": "Chennai",
  "state": "Tamil Nadu",
  "postal_code": "600001",
  "country": "India",
  "is_default": false
}
```
Required: `full_name`, `street1`, `city`, `country`.

- **200 OK**: Created address object.
- **400 Bad Request**: Missing required fields.
- **401 Unauthorized**: Missing or invalid token.

---

### Payment Methods

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/add-payment` | Bearer | List all saved payment methods. |
| POST | `/api/add-payment` | Bearer | Add a new payment method. |
| GET | `/api/add-payment/{id}` | Bearer | Get a single payment method by ID. |
| DELETE | `/api/add-payment/{id}` | Bearer | Delete a payment method by ID. |

#### POST `/api/add-payment` — Request Body
```json
{
  "card_type": "Visa",
  "last4": "4242",
  "expiry_month": 12,
  "expiry_year": 2027,
  "is_default": false
}
```
Required: `card_type`, `last4` (exactly 4 digits), `expiry_month`, `expiry_year`.

- **200 OK**: Created payment method object.
- **400 Bad Request**: Missing fields or invalid `last4`.
- **401 Unauthorized**: Missing or invalid token.

---

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Bearer | Get all notifications for the user (newest first). |
| GET | `/api/notifications/count` | Bearer | Get the unread notification count. |
| PUT | `/api/notifications/read-all` | Bearer | Mark all notifications as read. |
| PUT | `/api/notifications/{id}/read` | Bearer | Mark a single notification as read. |
| DELETE | `/api/notifications/{id}` | Bearer | Delete a single notification. |

#### GET `/api/notifications` — Response (200 OK)
```json
{
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "auction_won",
      "title": "You won an auction!",
      "message": "Congratulations! You won the auction for \"Vintage T-Shirt\" with a bid of $45.00.",
      "listing_id": "uuid",
      "is_read": false,
      "created_at": "2025-04-13T10:00:00Z"
    }
  ]
}
```

#### GET `/api/notifications/count` — Response (200 OK)
```json
{ "unread_count": 3 }
```

Notification types generated by the settlement worker:
- `auction_won` — sent to the auction winner.
- `auction_ended_seller` — sent to the seller when an auction ends with a winner.
- `auction_ended_no_bids` — sent to the seller when an auction ends with no bids.

---

### Real-Time Auction Updates (SSE)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/ws/auctions/{id}` | No | Open an SSE stream for live bid updates on a specific auction. |

The server sets `Content-Type: text/event-stream` and subscribes to the Redis Pub/Sub channel `auction:events:<id>`. Each new bid publishes to that channel, and the event is forwarded to the client immediately.

#### SSE Event Format
```
event: bid_update
data: {"auction_id":"...","current_bid":50.00,"highest_bidder":"..."}
```

- Payload is forwarded from Redis as published by the bid pipeline (`current_bid`, `highest_bidder`, etc.).
- **Frontend** (`auction_detail.tsx`) parses this JSON and merges it into live UI state.
- The connection stays open until the client disconnects.
- No authentication is required (publicly observable bid stream).
