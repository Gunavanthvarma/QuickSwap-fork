package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	auth "github.com/quickswap/quickswap/internal/auth"
)

func loginHandler(c *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email      string `json:"email"`
			Password   string `json:"password"`
			RememberMe bool   `json:"rememberMe"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Email == "" || req.Password == "" {
			respondError(w, "Email and password required", http.StatusBadRequest)
			return
		}

		session, err := c.Login(req.Email, req.Password)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		respondJSON(w, map[string]interface{}{
			"session": map[string]interface{}{
				"access_token":  session.AccessToken,
				"refresh_token": session.RefreshToken,
				"expires_in":    session.ExpiresIn,
				"user":          session.User,
			},
		})
	}
}

func signupHandler(c *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Email     string `json:"email"`
			Password  string `json:"password"`
			Mobile    string `json:"mobile"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Email == "" || req.Password == "" {
			respondError(w, "Email and password required", http.StatusBadRequest)
			return
		}

		if len(req.Password) < 6 {
			respondError(w, "Password must be at least 6 characters", http.StatusBadRequest)
			return
		}

		session, err := c.Signup(req.Email, req.Password)
		if err != nil {
			respondError(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Best-effort: store profile details in a separate `profiles` table in Supabase
		if session != nil && session.User.ID != "" {
			if err := storeProfile(session.User.ID, req.FirstName, req.LastName, req.Mobile, req.Email); err != nil {
				log.Printf("Warning: failed to store profile: %v", err)
			}
		}

		// Return a `session` object when tokens are available so frontend code stays consistent
		if session != nil && session.AccessToken != "" {
			respondJSON(w, map[string]interface{}{
				"session": map[string]interface{}{
					"access_token":  session.AccessToken,
					"refresh_token": session.RefreshToken,
					"expires_in":    session.ExpiresIn,
					"user":          session.User,
				},
			})
			return
		}

		// No session (e.g. email confirmation required) — return user and message
		if session != nil && session.User.ID != "" {
			respondJSON(w, map[string]interface{}{"user": session.User, "message": "Check your email to confirm your account"})
			return
		}

		// Fallback
		respondJSON(w, map[string]interface{}{"message": "Signup completed"})
	}
}

func logoutHandler(c *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		if err := c.Logout(token); err != nil {
			respondError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		respondJSON(w, map[string]string{"message": "Logged out"})
	}
}

func meHandler(c *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Validate token by calling Supabase user endpoint
		req, _ := http.NewRequest("GET", os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		req.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			respondError(w, "Failed to get user", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respondError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		var userResp struct {
			ID    string `json:"id"`
			Email string `json:"email"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
			respondError(w, "Invalid response", http.StatusInternalServerError)
			return
		}

		respondJSON(w, userResp)
	}
}

func profileHandler(c *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// 1. Get user ID from Supabase Auth
		supaURL := os.Getenv("SUPABASE_URL")
		supaKey := os.Getenv("SUPABASE_ANON_KEY")

		authReq, _ := http.NewRequest("GET", supaURL+"/auth/v1/user", nil)
		authReq.Header.Set("apikey", supaKey)
		authReq.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(authReq)
		if err != nil {
			respondError(w, "Failed to verify session", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respondError(w, "Invalid session", http.StatusUnauthorized)
			return
		}

		var userData struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
			respondError(w, "Error parsing user data", http.StatusInternalServerError)
			return
		}

		// 2. Fetch profile from DB
		profile, err := getProfile(userData.ID)
		if err != nil {
			respondError(w, "Profile not found or error fetching", http.StatusNotFound)
			return
		}

		respondJSON(w, profile)
	}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
func updateProfileHandler(c *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Get user ID from Supabase Auth
		supaURL := os.Getenv("SUPABASE_URL")
		supaKey := os.Getenv("SUPABASE_ANON_KEY")
		authReq, _ := http.NewRequest("GET", supaURL+"/auth/v1/user", nil)
		authReq.Header.Set("apikey", supaKey)
		authReq.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(authReq)
		if err != nil || resp.StatusCode != http.StatusOK {
			respondError(w, "Invalid session", http.StatusUnauthorized)
			return
		}
		defer resp.Body.Close()
		var userData struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
			respondError(w, "Error parsing user data", http.StatusInternalServerError)
			return
		}

		// Parse update fields
		var req struct {
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Mobile    string `json:"mobile"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Patch Supabase profiles table
		svcKey := os.Getenv("SUPABASE_SERVICE_KEY")
		apiKey := svcKey
		if apiKey == "" {
			apiKey = supaKey
		}
		url := supaURL + "/rest/v1/profiles?id=eq." + userData.ID
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

// storeProfile attempts to insert a profile row into Supabase `profiles` table.
// This is best-effort: failures are logged but do not block signup.
func storeProfile(userID, firstName, lastName, mobile, email string) error {
	supaURL := os.Getenv("SUPABASE_URL")
	if supaURL == "" {
		return nil
	}

	// Use service role key if available for inserts, otherwise fall back to anon key
	svcKey := os.Getenv("SUPABASE_SERVICE_KEY")
	anonKey := os.Getenv("SUPABASE_ANON_KEY")
	apiKey := svcKey
	if apiKey == "" {
		apiKey = anonKey
	}
	if apiKey == "" {
		return nil
	}

	url := supaURL + "/rest/v1/profiles"

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

	req, err := http.NewRequest("POST", url, bytes.NewReader(b))
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
	apiKey := os.Getenv("SUPABASE_SERVICE_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("SUPABASE_ANON_KEY")
	}

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
