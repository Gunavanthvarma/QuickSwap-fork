package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/quickswap/quickswap/internal/auth"
)

// getUserIDFromToken validates the bearer token against Supabase and returns the user ID.
func getUserIDFromToken(r *http.Request) (string, error) {
	token := r.Header.Get("Authorization")
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	if token == "" {
		return "", fmt.Errorf("authorization header required")
	}

	supaURL := os.Getenv("SUPABASE_URL")
	supaKey := os.Getenv("SUPABASE_ANON_KEY")

	req, _ := http.NewRequest("GET", supaURL+"/auth/v1/user", nil)
	req.Header.Set("apikey", supaKey)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to verify token")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("invalid or expired token")
	}

	var user struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", fmt.Errorf("invalid auth response")
	}
	return user.ID, nil
}

func supabaseAPIKey() string {
	if key := os.Getenv("SUPABASE_SERVICE_KEY"); key != "" {
		return key
	}
	return os.Getenv("SUPABASE_ANON_KEY")
}

// getUserWithEmail returns both the user ID and email from the bearer token.
func getUserWithEmail(r *http.Request) (id, email, rawToken string, err error) {
	rawToken = r.Header.Get("Authorization")
	if len(rawToken) > 7 && rawToken[:7] == "Bearer " {
		rawToken = rawToken[7:]
	}
	if rawToken == "" {
		return "", "", "", fmt.Errorf("authorization header required")
	}

	supaURL := os.Getenv("SUPABASE_URL")
	supaKey := os.Getenv("SUPABASE_ANON_KEY")

	req, _ := http.NewRequest("GET", supaURL+"/auth/v1/user", nil)
	req.Header.Set("apikey", supaKey)
	req.Header.Set("Authorization", "Bearer "+rawToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to verify token")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", "", fmt.Errorf("invalid or expired token")
	}

	var user struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", "", "", fmt.Errorf("invalid auth response")
	}
	return user.ID, user.Email, rawToken, nil
}

// ---- Profile Handlers ----

func profileHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		profile, err := getProfile(userID)
		if err != nil {
			respondError(w, "Profile not found or error fetching", http.StatusNotFound)
			return
		}

		respondJSON(w, profile)
	}
}

func updateProfileHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		var req struct {
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Mobile    string `json:"mobile"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		supaURL := os.Getenv("SUPABASE_URL")
		apiKey := supabaseAPIKey()
		url := supaURL + "/rest/v1/profiles?id=eq." + userID
		payload := map[string]interface{}{
			"first_name": req.FirstName,
			"last_name":  req.LastName,
			"mobile":     req.Mobile,
		}
		b, _ := json.Marshal(payload)
		patchReq, _ := http.NewRequest("PATCH", url, bytes.NewReader(b))
		patchReq.Header.Set("Content-Type", "application/json")
		patchReq.Header.Set("apikey", apiKey)
		patchReq.Header.Set("Authorization", "Bearer "+apiKey)
		patchReq.Header.Set("Prefer", "return=representation")
		patchResp, err := http.DefaultClient.Do(patchReq)
		if err != nil || patchResp.StatusCode < 200 || patchResp.StatusCode >= 300 {
			body, _ := io.ReadAll(patchResp.Body)
			respondError(w, "Failed to update profile: "+string(body), http.StatusInternalServerError)
			return
		}
		defer patchResp.Body.Close()

		respondJSON(w, map[string]string{"message": "Profile updated"})
	}
}

// storeProfile inserts a profile row into Supabase on signup.
// Best-effort: failures are logged but do not block signup.
func storeProfile(userID, firstName, lastName, mobile, email string) error {
	supaURL := os.Getenv("SUPABASE_URL")
	if supaURL == "" {
		return nil
	}
	apiKey := supabaseAPIKey()
	if apiKey == "" {
		return nil
	}

	payload := []map[string]string{{
		"id":         userID,
		"first_name": firstName,
		"last_name":  lastName,
		"mobile":     mobile,
		"email":      email,
	}}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", supaURL+"/rest/v1/profiles", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Prefer", "return=representation")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase insert failed: status=%d body=%s", resp.StatusCode, string(body))
	}
	return nil
}

func getProfile(userID string) (map[string]interface{}, error) {
	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	url := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s&select=*", supaURL, userID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch profile: status=%d", resp.StatusCode)
	}

	var profiles []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&profiles); err != nil {
		return nil, err
	}
	if len(profiles) == 0 {
		return nil, fmt.Errorf("profile not found")
	}
	return profiles[0], nil
}

// ---- Address Handlers ----

func addressHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getAddressesHandler(w, r)
		case http.MethodPost:
			createAddressHandler(w, r)
		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func addressByIDHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getAddressByID(w, r)
		case http.MethodPut:
			updateAddressHandler(w, r)
		case http.MethodDelete:
			deleteAddressHandler(w, r)
		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func getAddressesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()
	url := supaURL + "/rest/v1/addresses?user_id=eq." + userID + "&order=is_default.desc,created_at.asc"

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		respondError(w, "Failed to fetch addresses", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var addresses []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&addresses); err != nil {
		respondError(w, "Invalid response", http.StatusInternalServerError)
		return
	}

	if addresses == nil {
		addresses = []map[string]interface{}{}
	}
	respondJSON(w, addresses)
}

func createAddressHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req struct {
		FullName  string `json:"full_name"`
		Street1   string `json:"street1"`
		Street2   string `json:"street2"`
		City      string `json:"city"`
		State     string `json:"state"`
		ZIP       string `json:"zip"`
		Country   string `json:"country"`
		IsDefault bool   `json:"is_default"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.FullName == "" || req.Street1 == "" || req.City == "" || req.Country == "" {
		respondError(w, "full_name, street1, city, and country are required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	if req.IsDefault {
		if err := clearDefaultAddresses(supaURL, apiKey, userID); err != nil {
			respondError(w, "Failed to update defaults", http.StatusInternalServerError)
			return
		}
	}

	payload := map[string]interface{}{
		"user_id":    userID,
		"full_name":  req.FullName,
		"street1":    req.Street1,
		"street2":    req.Street2,
		"city":       req.City,
		"state":      req.State,
		"zip":        req.ZIP,
		"country":    req.Country,
		"is_default": req.IsDefault,
	}
	b, _ := json.Marshal(payload)

	postReq, _ := http.NewRequest("POST", supaURL+"/rest/v1/addresses", bytes.NewReader(b))
	postReq.Header.Set("Content-Type", "application/json")
	postReq.Header.Set("apikey", apiKey)
	postReq.Header.Set("Authorization", "Bearer "+apiKey)
	postReq.Header.Set("Prefer", "return=representation")

	resp, err := http.DefaultClient.Do(postReq)
	if err != nil {
		respondError(w, "Failed to save address", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to save address: "+string(body), http.StatusInternalServerError)
		return
	}

	var created []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)
	if len(created) > 0 {
		respondJSON(w, created[0])
		return
	}
	respondJSON(w, map[string]string{"message": "Address saved"})
}

func updateAddressHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		respondError(w, "Address ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		FullName  string `json:"full_name"`
		Street1   string `json:"street1"`
		Street2   string `json:"street2"`
		City      string `json:"city"`
		State     string `json:"state"`
		ZIP       string `json:"zip"`
		Country   string `json:"country"`
		IsDefault bool   `json:"is_default"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	if req.IsDefault {
		if err := clearDefaultAddresses(supaURL, apiKey, userID); err != nil {
			respondError(w, "Failed to update defaults", http.StatusInternalServerError)
			return
		}
	}

	payload := map[string]interface{}{
		"full_name":  req.FullName,
		"street1":    req.Street1,
		"street2":    req.Street2,
		"city":       req.City,
		"state":      req.State,
		"zip":        req.ZIP,
		"country":    req.Country,
		"is_default": req.IsDefault,
	}
	b, _ := json.Marshal(payload)

	// Filter by both id and user_id to prevent users from updating others' addresses
	url := supaURL + "/rest/v1/addresses?id=eq." + id + "&user_id=eq." + userID
	patchReq, _ := http.NewRequest("PATCH", url, bytes.NewReader(b))
	patchReq.Header.Set("Content-Type", "application/json")
	patchReq.Header.Set("apikey", apiKey)
	patchReq.Header.Set("Authorization", "Bearer "+apiKey)
	patchReq.Header.Set("Prefer", "return=representation")

	resp, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		respondError(w, "Failed to update address", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to update address: "+string(body), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"message": "Address updated"})
}

func deleteAddressHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		respondError(w, "Address ID required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	// Filter by both id and user_id to prevent users from deleting others' addresses
	url := supaURL + "/rest/v1/addresses?id=eq." + id + "&user_id=eq." + userID
	delReq, _ := http.NewRequest("DELETE", url, nil)
	delReq.Header.Set("apikey", apiKey)
	delReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		respondError(w, "Failed to delete address", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to delete address: "+string(body), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"message": "Address deleted"})
}

func getAddressByID(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		respondError(w, "Address ID required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()
	url := supaURL + "/rest/v1/addresses?id=eq." + id + "&user_id=eq." + userID

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		respondError(w, "Failed to fetch address", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var addresses []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&addresses); err != nil || len(addresses) == 0 {
		respondError(w, "Address not found", http.StatusNotFound)
		return
	}
	respondJSON(w, addresses[0])
}

func clearDefaultAddresses(supaURL, apiKey, userID string) error {
	url := supaURL + "/rest/v1/addresses?user_id=eq." + userID + "&is_default=eq.true"
	b, _ := json.Marshal(map[string]bool{"is_default": false})
	req, _ := http.NewRequest("PATCH", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("failed to clear default addresses: status %d", resp.StatusCode)
	}
	return nil
}

// ---- Payment Handlers ----

func paymentHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getPaymentMethodsHandler(w, r)
		case http.MethodPost:
			addPaymentMethodHandler(w, r)
		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func paymentByIDHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getPaymentByID(w, r)
		case http.MethodDelete:
			deletePaymentMethodHandler(w, r)
		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func getPaymentMethodsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()
	url := supaURL + "/rest/v1/payment_methods?user_id=eq." + userID + "&order=is_default.desc,created_at.asc"

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		respondError(w, "Failed to fetch payment methods", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var methods []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&methods); err != nil {
		respondError(w, "Invalid response", http.StatusInternalServerError)
		return
	}

	if methods == nil {
		methods = []map[string]interface{}{}
	}
	respondJSON(w, methods)
}

func addPaymentMethodHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	var req struct {
		CardType    string `json:"card_type"`
		Last4       string `json:"last4"`
		ExpiryMonth int    `json:"expiry_month"`
		ExpiryYear  int    `json:"expiry_year"`
		IsDefault   bool   `json:"is_default"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.CardType == "" || req.Last4 == "" || req.ExpiryMonth == 0 || req.ExpiryYear == 0 {
		respondError(w, "card_type, last4, expiry_month, and expiry_year are required", http.StatusBadRequest)
		return
	}
	if len(req.Last4) != 4 {
		respondError(w, "last4 must be exactly 4 digits", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	if req.IsDefault {
		if err := clearDefaultPayments(supaURL, apiKey, userID); err != nil {
			respondError(w, "Failed to update defaults", http.StatusInternalServerError)
			return
		}
	}

	// Only store non-sensitive metadata — full card number never touches this server.
	// Actual card tokenization should be handled via Stripe on the frontend,
	// with only the resulting token/last4/expiry stored here.
	payload := map[string]interface{}{
		"user_id":      userID,
		"card_type":    req.CardType,
		"last4":        req.Last4,
		"expiry_month": req.ExpiryMonth,
		"expiry_year":  req.ExpiryYear,
		"is_default":   req.IsDefault,
	}
	b, _ := json.Marshal(payload)

	postReq, _ := http.NewRequest("POST", supaURL+"/rest/v1/payment_methods", bytes.NewReader(b))
	postReq.Header.Set("Content-Type", "application/json")
	postReq.Header.Set("apikey", apiKey)
	postReq.Header.Set("Authorization", "Bearer "+apiKey)
	postReq.Header.Set("Prefer", "return=representation")

	resp, err := http.DefaultClient.Do(postReq)
	if err != nil {
		respondError(w, "Failed to save payment method", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to save payment method: "+string(body), http.StatusInternalServerError)
		return
	}

	var created []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&created)
	if len(created) > 0 {
		respondJSON(w, created[0])
		return
	}
	respondJSON(w, map[string]string{"message": "Payment method saved"})
}

func deletePaymentMethodHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		respondError(w, "Payment method ID required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	// Filter by both id and user_id to prevent users from deleting others' payment methods
	url := supaURL + "/rest/v1/payment_methods?id=eq." + id + "&user_id=eq." + userID
	delReq, _ := http.NewRequest("DELETE", url, nil)
	delReq.Header.Set("apikey", apiKey)
	delReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		respondError(w, "Failed to delete payment method", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to delete payment method: "+string(body), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"message": "Payment method deleted"})
}

func getPaymentByID(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if id == "" {
		respondError(w, "Payment method ID required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()
	url := supaURL + "/rest/v1/payment_methods?id=eq." + id + "&user_id=eq." + userID

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		respondError(w, "Failed to fetch payment method", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var methods []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&methods); err != nil || len(methods) == 0 {
		respondError(w, "Payment method not found", http.StatusNotFound)
		return
	}
	respondJSON(w, methods[0])
}

func clearDefaultPayments(supaURL, apiKey, userID string) error {
	url := supaURL + "/rest/v1/payment_methods?user_id=eq." + userID + "&is_default=eq.true"
	b, _ := json.Marshal(map[string]bool{"is_default": false})
	req, _ := http.NewRequest("PATCH", url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("failed to clear default payments: status %d", resp.StatusCode)
	}
	return nil
}

// ---- Update Password ----

// updatePasswordHandler handles PUT /api/profile/password.
// Accepts old_password, new_password, re_enter_new_password.
// Verifies the old password before applying the update.
func updatePasswordHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, email, token, err := getUserWithEmail(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}
		_ = userID // used implicitly via token ownership

		var req struct {
			OldPassword     string `json:"old_password"`
			NewPassword     string `json:"new_password"`
			ReEnterPassword string `json:"re_enter_new_password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.OldPassword == "" || req.NewPassword == "" || req.ReEnterPassword == "" {
			respondError(w, "old_password, new_password, and re_enter_new_password are required", http.StatusBadRequest)
			return
		}
		if req.NewPassword != req.ReEnterPassword {
			respondError(w, "new_password and re_enter_new_password do not match", http.StatusBadRequest)
			return
		}
		if len(req.NewPassword) < 6 {
			respondError(w, "New password must be at least 6 characters", http.StatusBadRequest)
			return
		}

		supaURL := os.Getenv("SUPABASE_URL")
		supaKey := os.Getenv("SUPABASE_ANON_KEY")

		// Verify old password by attempting a login
		loginPayload, _ := json.Marshal(map[string]string{
			"email":    email,
			"password": req.OldPassword,
		})
		loginReq, _ := http.NewRequest("POST", supaURL+"/auth/v1/token?grant_type=password", bytes.NewReader(loginPayload))
		loginReq.Header.Set("Content-Type", "application/json")
		loginReq.Header.Set("apikey", supaKey)

		loginResp, err := http.DefaultClient.Do(loginReq)
		if err != nil {
			respondError(w, "Failed to verify old password", http.StatusInternalServerError)
			return
		}
		defer loginResp.Body.Close()
		if loginResp.StatusCode != http.StatusOK {
			respondError(w, "Old password is incorrect", http.StatusUnauthorized)
			return
		}

		// Update password via Supabase Auth (user's own token)
		updatePayload, _ := json.Marshal(map[string]string{"password": req.NewPassword})
		updateReq, _ := http.NewRequest("PUT", supaURL+"/auth/v1/user", bytes.NewReader(updatePayload))
		updateReq.Header.Set("Content-Type", "application/json")
		updateReq.Header.Set("apikey", supaKey)
		updateReq.Header.Set("Authorization", "Bearer "+token)

		updateResp, err := http.DefaultClient.Do(updateReq)
		if err != nil {
			respondError(w, "Failed to update password", http.StatusInternalServerError)
			return
		}
		defer updateResp.Body.Close()

		if updateResp.StatusCode < 200 || updateResp.StatusCode >= 300 {
			body, _ := io.ReadAll(updateResp.Body)
			respondError(w, "Failed to update password: "+string(body), http.StatusInternalServerError)
			return
		}

		respondJSON(w, map[string]string{"message": "Password updated successfully"})
	}
}

// ---- Delete Account ----

// deleteAccountHandler handles DELETE /api/profile/account.
// Permanently removes the user from Supabase Auth (requires service role key).
func deleteAccountHandler(_ *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		svcKey := os.Getenv("SUPABASE_SERVICE_KEY")
		if svcKey == "" {
			respondError(w, "Server configuration error: service key not set", http.StatusInternalServerError)
			return
		}

		supaURL := os.Getenv("SUPABASE_URL")

		// Delete via Supabase Admin API — requires service role key
		delReq, _ := http.NewRequest("DELETE", supaURL+"/auth/v1/admin/users/"+userID, nil)
		delReq.Header.Set("apikey", svcKey)
		delReq.Header.Set("Authorization", "Bearer "+svcKey)

		resp, err := http.DefaultClient.Do(delReq)
		if err != nil {
			respondError(w, "Failed to delete account", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			body, _ := io.ReadAll(resp.Body)
			respondError(w, "Failed to delete account: "+string(body), http.StatusInternalServerError)
			return
		}

		respondJSON(w, map[string]string{"message": "Account deleted successfully"})
	}
}
