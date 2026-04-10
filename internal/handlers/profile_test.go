package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func setupProfileMockServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/v1/user":
			// GET → return user info; PUT → update password (success)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id": "user123", "email": "test@example.com"}`))
		case "/auth/v1/token":
			// POST → verify old password (always succeed in happy-path mock)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"access_token": "mock_token"}`))
		case "/auth/v1/admin/users/user123":
			// DELETE → delete account
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{}`))
		case "/rest/v1/profiles":
			w.WriteHeader(http.StatusOK)
			if r.Method == http.MethodGet {
				w.Write([]byte(`[{"id": "user123", "first_name": "Test", "last_name": "User", "email": "test@example.com"}]`))
			} else {
				w.Write([]byte(`[{"id": "user123"}]`))
			}
		case "/rest/v1/addresses":
			w.WriteHeader(http.StatusOK)
			if r.Method == http.MethodGet {
				w.Write([]byte(`[{"id": "addr1", "full_name": "John Doe", "street1": "123 Main St", "city": "Chennai", "country": "India", "is_default": true}]`))
			} else {
				w.Write([]byte(`[{"id": "addr1", "full_name": "John Doe"}]`))
			}
		case "/rest/v1/payment_methods":
			w.WriteHeader(http.StatusOK)
			if r.Method == http.MethodGet {
				w.Write([]byte(`[{"id": "pay1", "card_type": "Visa", "last4": "4242", "expiry_month": 12, "expiry_year": 2027, "is_default": true}]`))
			} else {
				w.Write([]byte(`[{"id": "pay1", "card_type": "Visa", "last4": "4242"}]`))
			}
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// badOldPasswordMockServer returns 400 for /auth/v1/token to simulate wrong old password.
func setupBadOldPasswordMockServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/v1/user":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id": "user123", "email": "test@example.com"}`))
		case "/auth/v1/token":
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error": "invalid_grant"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func initProfileTestEnv(ts *httptest.Server) {
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")
}

// ---- Helper Tests ----

func TestGetUserIDFromToken_MissingToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	req := httptest.NewRequest("GET", "/", nil)
	_, err := getUserIDFromToken(req)
	if err == nil {
		t.Error("Expected error for missing token, got nil")
	}
}

func TestGetUserIDFromToken_Valid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	id, err := getUserIDFromToken(req)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if id != "user123" {
		t.Errorf("Expected user123, got %s", id)
	}
}

func TestSupabaseAPIKey(t *testing.T) {
	os.Setenv("SUPABASE_SERVICE_KEY", "servicekey")
	os.Setenv("SUPABASE_ANON_KEY", "anonkey")
	if key := supabaseAPIKey(); key != "servicekey" {
		t.Errorf("Expected servicekey, got %s", key)
	}

	os.Unsetenv("SUPABASE_SERVICE_KEY")
	if key := supabaseAPIKey(); key != "anonkey" {
		t.Errorf("Expected anonkey, got %s", key)
	}
}

// ---- Profile Helper Tests ----

func TestStoreProfile(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	if err := storeProfile("user123", "Test", "User", "9999", "test@example.com"); err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}

func TestStoreProfile_EmptyURL(t *testing.T) {
	os.Setenv("SUPABASE_URL", "")
	if err := storeProfile("user123", "Test", "User", "9999", "test@example.com"); err != nil {
		t.Errorf("Expected nil for empty URL, got %v", err)
	}
}

func TestGetProfile(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	profile, err := getProfile("user123")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if profile == nil {
		t.Error("Expected profile map, got nil")
	}
}

// ---- Update Profile ----

func TestUpdateProfileHandler_WrongMethod(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updateProfileHandler(nil)
	req := httptest.NewRequest("GET", "/api/profile/update", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

func TestUpdateProfileHandler_NoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updateProfileHandler(nil)
	req := httptest.NewRequest("PUT", "/api/profile/update", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestUpdateProfileHandler_Valid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updateProfileHandler(nil)
	body := []byte(`{"first_name": "Updated", "last_name": "User", "mobile": "1234567890"}`)
	req := httptest.NewRequest("PUT", "/api/profile/update", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

// ---- Address GET (list) ----

func TestAddressHandler_GetNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	req := httptest.NewRequest("GET", "/api/address", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestAddressHandler_GetValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	req := httptest.NewRequest("GET", "/api/address", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

// ---- Address POST ----

func TestAddressHandler_PostNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	req := httptest.NewRequest("POST", "/api/address", bytes.NewBuffer([]byte(`{}`)))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestAddressHandler_PostMissingFields(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	req := httptest.NewRequest("POST", "/api/address", bytes.NewBuffer([]byte(`{"city": "Chennai"}`)))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", rr.Code)
	}
}

func TestAddressHandler_PostValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	body := []byte(`{"full_name":"John Doe","street1":"123 Main St","city":"Chennai","country":"India","is_default":false}`)
	req := httptest.NewRequest("POST", "/api/address", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestAddressHandler_PostIsDefault(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	body := []byte(`{"full_name":"John Doe","street1":"123 Main St","city":"Chennai","country":"India","is_default":true}`)
	req := httptest.NewRequest("POST", "/api/address", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200 with is_default:true, got %d", rr.Code)
	}
}

func TestAddressHandler_MethodNotAllowed(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/address", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

// ---- Address by ID ----

func TestAddressByIDHandler_GetNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	req := httptest.NewRequest("GET", "/api/address/addr1", nil)
	req.SetPathValue("id", "addr1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_GetValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	req := httptest.NewRequest("GET", "/api/address/addr1", nil)
	req.SetPathValue("id", "addr1")
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_PutNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	req := httptest.NewRequest("PUT", "/api/address/addr1", bytes.NewBuffer([]byte(`{}`)))
	req.SetPathValue("id", "addr1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_PutValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	body := []byte(`{"full_name":"Jane Doe","street1":"456 New St","city":"Mumbai","country":"India","is_default":false}`)
	req := httptest.NewRequest("PUT", "/api/address/addr1", bytes.NewBuffer(body))
	req.SetPathValue("id", "addr1")
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_PutIsDefault(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	body := []byte(`{"full_name":"Jane Doe","street1":"456 New St","city":"Mumbai","country":"India","is_default":true}`)
	req := httptest.NewRequest("PUT", "/api/address/addr1", bytes.NewBuffer(body))
	req.SetPathValue("id", "addr1")
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200 with is_default:true, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_DeleteNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/address/addr1", nil)
	req.SetPathValue("id", "addr1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_DeleteValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/address/addr1", nil)
	req.SetPathValue("id", "addr1")
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestAddressByIDHandler_MethodNotAllowed(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := addressByIDHandler(nil)
	req := httptest.NewRequest("POST", "/api/address/addr1", nil)
	req.SetPathValue("id", "addr1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

// ---- Payment GET (list) ----

func TestPaymentHandler_GetNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	req := httptest.NewRequest("GET", "/api/add-payment", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestPaymentHandler_GetValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	req := httptest.NewRequest("GET", "/api/add-payment", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

// ---- Payment POST ----

func TestPaymentHandler_PostNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	req := httptest.NewRequest("POST", "/api/add-payment", bytes.NewBuffer([]byte(`{}`)))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestPaymentHandler_PostMissingFields(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	req := httptest.NewRequest("POST", "/api/add-payment", bytes.NewBuffer([]byte(`{"card_type":"Visa"}`)))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", rr.Code)
	}
}

func TestPaymentHandler_PostInvalidLast4(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	body := []byte(`{"card_type":"Visa","last4":"12","expiry_month":12,"expiry_year":2027}`)
	req := httptest.NewRequest("POST", "/api/add-payment", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for invalid last4, got %d", rr.Code)
	}
}

func TestPaymentHandler_PostValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	body := []byte(`{"card_type":"Visa","last4":"4242","expiry_month":12,"expiry_year":2027,"is_default":false}`)
	req := httptest.NewRequest("POST", "/api/add-payment", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestPaymentHandler_PostIsDefault(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	body := []byte(`{"card_type":"Mastercard","last4":"1234","expiry_month":6,"expiry_year":2028,"is_default":true}`)
	req := httptest.NewRequest("POST", "/api/add-payment", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200 with is_default:true, got %d", rr.Code)
	}
}

func TestPaymentHandler_MethodNotAllowed(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/add-payment", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

// ---- Payment by ID ----

func TestPaymentByIDHandler_GetNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentByIDHandler(nil)
	req := httptest.NewRequest("GET", "/api/add-payment/pay1", nil)
	req.SetPathValue("id", "pay1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestPaymentByIDHandler_GetValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentByIDHandler(nil)
	req := httptest.NewRequest("GET", "/api/add-payment/pay1", nil)
	req.SetPathValue("id", "pay1")
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestPaymentByIDHandler_DeleteNoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentByIDHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/add-payment/pay1", nil)
	req.SetPathValue("id", "pay1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestPaymentByIDHandler_DeleteValid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentByIDHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/add-payment/pay1", nil)
	req.SetPathValue("id", "pay1")
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestPaymentByIDHandler_MethodNotAllowed(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := paymentByIDHandler(nil)
	req := httptest.NewRequest("PUT", "/api/add-payment/pay1", nil)
	req.SetPathValue("id", "pay1")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

// ---- Update Password ----

func TestUpdatePasswordHandler_WrongMethod(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	req := httptest.NewRequest("GET", "/api/profile/password", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

func TestUpdatePasswordHandler_NoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	req := httptest.NewRequest("PUT", "/api/profile/password", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestUpdatePasswordHandler_MissingFields(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	req := httptest.NewRequest("PUT", "/api/profile/password", bytes.NewBuffer([]byte(`{"old_password":"old"}`)))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for missing fields, got %d", rr.Code)
	}
}

func TestUpdatePasswordHandler_PasswordMismatch(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	body := []byte(`{"old_password":"old123","new_password":"newpass1","re_enter_new_password":"newpass2"}`)
	req := httptest.NewRequest("PUT", "/api/profile/password", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for password mismatch, got %d", rr.Code)
	}
}

func TestUpdatePasswordHandler_TooShort(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	body := []byte(`{"old_password":"old123","new_password":"abc","re_enter_new_password":"abc"}`)
	req := httptest.NewRequest("PUT", "/api/profile/password", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for short password, got %d", rr.Code)
	}
}

func TestUpdatePasswordHandler_WrongOldPassword(t *testing.T) {
	ts := setupBadOldPasswordMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	body := []byte(`{"old_password":"wrongold","new_password":"newpass1","re_enter_new_password":"newpass1"}`)
	req := httptest.NewRequest("PUT", "/api/profile/password", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for wrong old password, got %d", rr.Code)
	}
}

func TestUpdatePasswordHandler_Valid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := updatePasswordHandler(nil)
	body := []byte(`{"old_password":"correct123","new_password":"newpass1","re_enter_new_password":"newpass1"}`)
	req := httptest.NewRequest("PUT", "/api/profile/password", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

// ---- Delete Account ----

func TestDeleteAccountHandler_WrongMethod(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := deleteAccountHandler(nil)
	req := httptest.NewRequest("GET", "/api/profile/account", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}

func TestDeleteAccountHandler_NoToken(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := deleteAccountHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/profile/account", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestDeleteAccountHandler_NoServiceKey(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)
	os.Unsetenv("SUPABASE_SERVICE_KEY")

	handler := deleteAccountHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/profile/account", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected 500 for missing service key, got %d", rr.Code)
	}
}

func TestDeleteAccountHandler_Valid(t *testing.T) {
	ts := setupProfileMockServer()
	defer ts.Close()
	initProfileTestEnv(ts)

	handler := deleteAccountHandler(nil)
	req := httptest.NewRequest("DELETE", "/api/profile/account", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}
