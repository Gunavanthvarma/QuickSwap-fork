package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/quickswap/quickswap/internal/auth"
	"github.com/redis/go-redis/v9"

	listing "github.com/quickswap/quickswap/internal/listings"
)

func createListingHandler(authClient *auth.Client, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract and validate token
		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Validate token by calling Supabase user endpoint
		reqUser, _ := http.NewRequest("GET", os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		reqUser.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))
		reqUser.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(reqUser)
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
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
			respondError(w, "Invalid response from auth", http.StatusInternalServerError)
			return
		}

		// Parse and validate request body

		var req struct {
			Title            string   `json:"title"`
			Subtitle         string   `json:"subtitle"`
			Description      string   `json:"description"`
			Category         string   `json:"category"`
			Subcategory      string   `json:"subcategory"`
			Condition        string   `json:"condition"`
			Brand            string   `json:"brand"`
			Color            string   `json:"color"`
			Size             string   `json:"size"`
			Images           []string `json:"images"`
			StartingBid      float64  `json:"starting_bid"`
			BuyNowPrice      *float64 `json:"buy_now_price,omitempty"`
			AuctionStartTime string   `json:"auction_start_time"`
			AuctionEndTime   string   `json:"auction_end_time"`
			Location         string   `json:"location"`
			Notes            string   `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Validate required fields
		if req.Title == "" || req.Description == "" || req.Category == "" || len(req.Images) == 0 || req.StartingBid == 0 || req.AuctionEndTime == "" || req.Location == "" {
			respondError(w, "Missing required fields", http.StatusBadRequest)
			return
		}

		auctionEnd, err := time.Parse(time.RFC3339, req.AuctionEndTime)
		if err != nil {
			respondError(w, "Invalid auction_end_time format (must be RFC3339)", http.StatusBadRequest)
			return
		}

		var auctionStart time.Time
		if req.AuctionStartTime != "" {
			auctionStart, err = time.Parse(time.RFC3339, req.AuctionStartTime)
			if err != nil {
				respondError(w, "Invalid auction_start_time format (must be RFC3339)", http.StatusBadRequest)
				return
			}
		}

		l := &listing.Listing{
			Title:            req.Title,
			Subtitle:         req.Subtitle,
			Description:      req.Description,
			Category:         req.Category,
			Subcategory:      req.Subcategory,
			Condition:        req.Condition,
			Brand:            req.Brand,
			Color:            req.Color,
			Size:             req.Size,
			Images:           req.Images,
			StartingBid:      req.StartingBid,
			BuyNowPrice:      req.BuyNowPrice,
			AuctionStartTime: auctionStart,
			AuctionEndTime:   auctionEnd,
			Location:         req.Location,
			Notes:            req.Notes,
			SellerID:         userResp.ID, // Use ID from token
		}

		id, err := listing.CreateListing(l)
		if err != nil {
			respondError(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Track active auction in Redis
		rdb.ZAdd(r.Context(), "active_auctions", redis.Z{
			Score:  float64(auctionEnd.Unix()),
			Member: id,
		})

		respondJSON(w, map[string]interface{}{
			"listing_id": id,
			"status":     "success",
			"message":    "Listing created successfully.",
		})
	}
}

// Handler to fetch all listings for the current logged-in user
func myListingHandler(authClient *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract and validate token
		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Validate token by calling Supabase user endpoint
		reqUser, _ := http.NewRequest("GET", os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		reqUser.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))
		reqUser.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(reqUser)

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
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
			respondError(w, "Invalid response from auth", http.StatusInternalServerError)
			return
		}
		fmt.Println(userResp)

		// Query Supabase for listings by this user
		supaURL := os.Getenv("SUPABASE_URL")
		apiKey := os.Getenv("SUPABASE_SERVICE_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("SUPABASE_ANON_KEY")
		}
		url := supaURL + "/rest/v1/listings?seller_id=eq." + userResp.ID
		reqListings, _ := http.NewRequest("GET", url, nil)
		reqListings.Header.Set("apikey", apiKey)
		reqListings.Header.Set("Authorization", "Bearer "+apiKey)
		reqListings.Header.Set("Content-Type", "application/json")

		respListings, err := http.DefaultClient.Do(reqListings)
		if err != nil {
			respondError(w, "Failed to fetch listings", http.StatusInternalServerError)
			return
		}
		defer respListings.Body.Close()

		if respListings.StatusCode != http.StatusOK {
			respondError(w, "Failed to fetch listings", http.StatusInternalServerError)
			return
		}

		var listingsArr []listing.Listing
		if err := json.NewDecoder(respListings.Body).Decode(&listingsArr); err != nil {
			respondError(w, "Invalid listings response", http.StatusInternalServerError)
			return
		}

		if len(listingsArr) == 0 {
			respondError(w, "No listings found", http.StatusNotFound)
			return
		}

		// Build response with required fields
		type ListingSummary struct {
			ListingID  string  `json:"listing_id"`
			Title      string  `json:"title"`
			Image      string  `json:"image"`
			CurrentBid float64 `json:"current_bid"`
			TimeLeft   string  `json:"time_left"`
			TotalBids  int     `json:"total_bids"`
			Status     string  `json:"status"`
		}

		var summaries []ListingSummary
		for _, l := range listingsArr {
			// Fetch bids for this listing
			bidsURL := supaURL + "/rest/v1/bids?listing_id=eq." + l.ID
			reqBids, _ := http.NewRequest("GET", bidsURL, nil)
			reqBids.Header.Set("apikey", apiKey)
			reqBids.Header.Set("Authorization", "Bearer "+apiKey)
			reqBids.Header.Set("Content-Type", "application/json")

			respBids, err := http.DefaultClient.Do(reqBids)
			if err != nil || respBids.StatusCode != http.StatusOK {
				respBids.Body.Close()
				summaries = append(summaries, ListingSummary{
					ListingID:  l.ID,
					Title:      l.Title,
					Image:      "",
					CurrentBid: l.StartingBid,
					TimeLeft:   "Ended",
					TotalBids:  0,
					Status:     "Ended",
				})
				continue
			}
			var bids []struct {
				BidAmount float64 `json:"bid_amount"`
			}
			if err := json.NewDecoder(respBids.Body).Decode(&bids); err != nil {
				respBids.Body.Close()
				summaries = append(summaries, ListingSummary{
					ListingID:  l.ID,
					Title:      l.Title,
					Image:      "",
					CurrentBid: l.StartingBid,
					TimeLeft:   "Ended",
					TotalBids:  0,
					Status:     "Ended",
				})
				continue
			}
			respBids.Body.Close()

			// Calculate max bid
			maxBid := l.StartingBid
			for _, b := range bids {
				if b.BidAmount > maxBid {
					maxBid = b.BidAmount
				}
			}
			totalBids := len(bids)

			// Calculate time left
			auctionEnd := l.AuctionEndTime
			duration := time.Until(auctionEnd)
			var timeLeft string
			var status string
			if duration > 0 {
				hours := int(duration.Hours())
				minutes := int(duration.Minutes()) % 60
				timeLeft = fmt.Sprintf("%dh %dm", hours, minutes)
				status = "Active"
			} else {
				timeLeft = "Ended"
				status = "Ended"
			}

			image := ""
			if len(l.Images) > 0 {
				image = l.Images[0]
			}

			summaries = append(summaries, ListingSummary{
				ListingID:  l.ID,
				Title:      l.Title,
				Image:      image,
				CurrentBid: maxBid,
				TimeLeft:   timeLeft,
				TotalBids:  totalBids,
				Status:     status,
			})
		}

		respondJSON(w, map[string]interface{}{
			"listings": summaries,
		})
	}
}

func singleListingHandler(authClient *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getSingleListing(w, r)
		case http.MethodPut:
			updateListing(w, r)
		case http.MethodDelete:
			deleteListing(w, r)
		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func getSingleListing(w http.ResponseWriter, r *http.Request) {
	listingID := r.URL.Query().Get("id")
	if listingID == "" {
		respondError(w, "Listing ID required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	// --- Optional: extract caller identity from token (for bid status) ---
	callerID := ""
	token := r.Header.Get("Authorization")
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	if token != "" {
		reqUser, _ := http.NewRequest("GET", supaURL+"/auth/v1/user", nil)
		reqUser.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))
		reqUser.Header.Set("Authorization", "Bearer "+token)

		respUser, err := http.DefaultClient.Do(reqUser)
		if err == nil && respUser.StatusCode == http.StatusOK {
			var userResp struct {
				ID string `json:"id"`
			}
			if err := json.NewDecoder(respUser.Body).Decode(&userResp); err == nil {
				callerID = userResp.ID
			}
			respUser.Body.Close()
		}
	}

	// --- Fetch listing ---
	listingURL := supaURL + "/rest/v1/listings?id=eq." + listingID
	reqListing, _ := http.NewRequest("GET", listingURL, nil)
	reqListing.Header.Set("apikey", apiKey)
	reqListing.Header.Set("Authorization", "Bearer "+apiKey)
	reqListing.Header.Set("Content-Type", "application/json")

	respListing, err := http.DefaultClient.Do(reqListing)
	if err != nil {
		respondError(w, "Failed to fetch listing", http.StatusInternalServerError)
		return
	}
	defer respListing.Body.Close()

	if respListing.StatusCode != http.StatusOK {
		respondError(w, "Failed to fetch listing", http.StatusInternalServerError)
		return
	}

	var listings []listing.Listing
	if err := json.NewDecoder(respListing.Body).Decode(&listings); err != nil || len(listings) == 0 {
		respondError(w, "Listing not found", http.StatusNotFound)
		return
	}
	l := listings[0]

	// --- Fetch seller profile ---
	sellerName := "Unknown"
	sellerEmail := ""
	profileURL := supaURL + "/rest/v1/profiles?id=eq." + l.SellerID
	reqProfile, _ := http.NewRequest("GET", profileURL, nil)
	reqProfile.Header.Set("apikey", apiKey)
	reqProfile.Header.Set("Authorization", "Bearer "+apiKey)
	reqProfile.Header.Set("Content-Type", "application/json")

	respProfile, err := http.DefaultClient.Do(reqProfile)
	if err == nil && respProfile.StatusCode == http.StatusOK {
		var profiles []struct {
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Email     string `json:"email"`
		}
		if err := json.NewDecoder(respProfile.Body).Decode(&profiles); err == nil && len(profiles) > 0 {
			sellerName = profiles[0].FirstName + " " + profiles[0].LastName
			sellerEmail = profiles[0].Email
		}
		respProfile.Body.Close()
	}

	// --- Fetch bids for this listing ---
	bidsURL := supaURL + "/rest/v1/bids?listing_id=eq." + listingID
	reqBids, _ := http.NewRequest("GET", bidsURL, nil)
	reqBids.Header.Set("apikey", apiKey)
	reqBids.Header.Set("Authorization", "Bearer "+apiKey)
	reqBids.Header.Set("Content-Type", "application/json")

	respBids, err := http.DefaultClient.Do(reqBids)
	if err != nil {
		respondError(w, "Failed to fetch bids", http.StatusInternalServerError)
		return
	}
	defer respBids.Body.Close()

	var bids []struct {
		UserID    string  `json:"user_id"`
		BidAmount float64 `json:"bid_amount"`
	}
	if err := json.NewDecoder(respBids.Body).Decode(&bids); err != nil {
		respondError(w, "Invalid bids response", http.StatusInternalServerError)
		return
	}

	// --- Compute bid stats ---
	currentBid := l.StartingBid
	highestBidderID := ""
	var callerLastBid *float64

	for _, b := range bids {
		if b.BidAmount > currentBid {
			currentBid = b.BidAmount
			highestBidderID = b.UserID
		}
		if b.UserID == callerID && (callerLastBid == nil || b.BidAmount > *callerLastBid) {
			amt := b.BidAmount
			callerLastBid = &amt
		}
	}

	// --- Compute time left ---
	duration := time.Until(l.AuctionEndTime)
	var timeLeft, status string
	if duration > 0 {
		hours := int(duration.Hours())
		minutes := int(duration.Minutes()) % 60
		seconds := int(duration.Seconds()) % 60
		timeLeft = fmt.Sprintf("%dh %dm %ds", hours, minutes, seconds)
		status = "active"
	} else {
		timeLeft = "Ended"
		status = "ended"
	}

	// Post-auction contact visibility:
	// - Seller can see winner's name + email after auction ended.
	// - Winning bidder can see seller's email after auction ended.
	showSellerEmailToWinner := status == "ended" && callerID != "" && callerID == highestBidderID
	showWinnerContactToSeller := status == "ended" && callerID != "" && callerID == l.SellerID && highestBidderID != ""
	winnerName := ""
	winnerEmail := ""
	if showWinnerContactToSeller {
		winnerProfileURL := supaURL + "/rest/v1/profiles?id=eq." + highestBidderID
		reqWinnerProfile, _ := http.NewRequest("GET", winnerProfileURL, nil)
		reqWinnerProfile.Header.Set("apikey", apiKey)
		reqWinnerProfile.Header.Set("Authorization", "Bearer "+apiKey)
		reqWinnerProfile.Header.Set("Content-Type", "application/json")
		respWinnerProfile, wErr := http.DefaultClient.Do(reqWinnerProfile)
		if wErr == nil && respWinnerProfile.StatusCode == http.StatusOK {
			var winnerProfiles []struct {
				FirstName string `json:"first_name"`
				LastName  string `json:"last_name"`
				Email     string `json:"email"`
			}
			if decErr := json.NewDecoder(respWinnerProfile.Body).Decode(&winnerProfiles); decErr == nil && len(winnerProfiles) > 0 {
				winnerName = winnerProfiles[0].FirstName + " " + winnerProfiles[0].LastName
				winnerEmail = winnerProfiles[0].Email
			}
			respWinnerProfile.Body.Close()
		}
	}

	image := ""
	if len(l.Images) > 0 {
		image = l.Images[0]
	}

	respondJSON(w, map[string]interface{}{
		"listing_id":         l.ID,
		"title":              l.Title,
		"subtitle":           l.Subtitle,
		"description":        l.Description,
		"category":           l.Category,
		"subcategory":        l.Subcategory,
		"color":              l.Color,
		"size":               l.Size,
		"notes":              l.Notes,
		"images":             l.Images,
		"image":              image,
		"seller_id":          l.SellerID,
		"seller_name":        sellerName,
		"current_bid":        currentBid,
		"starting_bid":       l.StartingBid,
		"buy_now_price":      l.BuyNowPrice,
		"total_bids":         len(bids),
		"time_left":          timeLeft,
		"status":             status,
		"auction_start_time": l.AuctionStartTime,
		"auction_end_time":   l.AuctionEndTime,
		"is_seller":          callerID == l.SellerID,
		"has_joined":         callerLastBid != nil,
		"is_highest_bidder":  callerID != "" && callerID == highestBidderID,
		"caller_last_bid":    callerLastBid,
		"location":           l.Location,
		"condition":          l.Condition,
		"brand":              l.Brand,
		"seller_email":       func() string {
			if showSellerEmailToWinner {
				return sellerEmail
			}
			return ""
		}(),
		"winner_name": func() string {
			if showWinnerContactToSeller {
				return winnerName
			}
			return ""
		}(),
		"winner_email": func() string {
			if showWinnerContactToSeller {
				return winnerEmail
			}
			return ""
		}(),
	})
}

func updateListing(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	listingID := r.URL.Query().Get("id")
	if listingID == "" {
		respondError(w, "Listing ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Title          string   `json:"title"`
		Subtitle       string   `json:"subtitle"`
		Description    string   `json:"description"`
		Category       string   `json:"category"`
		Subcategory    string   `json:"subcategory"`
		Condition      string   `json:"condition"`
		Brand          string   `json:"brand"`
		Color          string   `json:"color"`
		Size           string   `json:"size"`
		Images         []string `json:"images"`
		BuyNowPrice    *float64 `json:"buy_now_price"`
		AuctionEndTime string   `json:"auction_end_time"`
		Location       string   `json:"location"`
		Notes          string   `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	payload := map[string]interface{}{
		"title":            req.Title,
		"subtitle":         req.Subtitle,
		"description":      req.Description,
		"category":         req.Category,
		"subcategory":      req.Subcategory,
		"condition":        req.Condition,
		"brand":            req.Brand,
		"color":            req.Color,
		"size":             req.Size,
		"images":           req.Images,
		"buy_now_price":    req.BuyNowPrice,
		"auction_end_time": req.AuctionEndTime,
		"location":         req.Location,
		"notes":            req.Notes,
	}
	b, _ := json.Marshal(payload)

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	// Filter by id AND seller_id so users can only update their own listings
	url := supaURL + "/rest/v1/listings?id=eq." + listingID + "&seller_id=eq." + userID
	patchReq, _ := http.NewRequest("PATCH", url, bytes.NewReader(b))
	patchReq.Header.Set("Content-Type", "application/json")
	patchReq.Header.Set("apikey", apiKey)
	patchReq.Header.Set("Authorization", "Bearer "+apiKey)
	patchReq.Header.Set("Prefer", "return=representation")

	resp, err := http.DefaultClient.Do(patchReq)
	if err != nil {
		respondError(w, "Failed to update listing", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to update listing: "+string(body), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"message": "Listing updated"})
}

func deleteListing(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		respondError(w, err.Error(), http.StatusUnauthorized)
		return
	}

	listingID := r.URL.Query().Get("id")
	if listingID == "" {
		respondError(w, "Listing ID required", http.StatusBadRequest)
		return
	}

	supaURL := os.Getenv("SUPABASE_URL")
	apiKey := supabaseAPIKey()

	// Filter by id AND seller_id so users can only delete their own listings
	url := supaURL + "/rest/v1/listings?id=eq." + listingID + "&seller_id=eq." + userID
	delReq, _ := http.NewRequest("DELETE", url, nil)
	delReq.Header.Set("apikey", apiKey)
	delReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		respondError(w, "Failed to delete listing", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		respondError(w, "Failed to delete listing: "+string(body), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"message": "Listing deleted"})
}
