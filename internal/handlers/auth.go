package handlers

import (
	"encoding/json"
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


func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
