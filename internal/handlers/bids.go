package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/quickswap/quickswap/internal/auth"
)

type Bid struct {
	ID          string  `json:"id"`
	ListingID   string  `json:"listing_id"`
	UserID      string  `json:"user_id"`
	BidAmount   float64 `json:"bid_amount"`
	Timestamp   string  `json:"timestamp"`
	Status      string  `json:"status"`
	IsAutoBid   bool    `json:"is_auto_bid"`
	BidSequence int     `json:"bid_sequence"`
	Title       string  `json:"title"`
	Image       string  `json:"image"`
	CurrentBid  float64 `json:"current_bid"`
	AuctionEnd  string  `json:"auction_end_time"`
	TimeLeft    string  `json:"time_left"`
	Label       string  `json:"label"`
}

func myBidsHandler(authClient *auth.Client) http.HandlerFunc {
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

		// Query Supabase for bids by this user
		supaURL := os.Getenv("SUPABASE_URL")
		apiKey := os.Getenv("SUPABASE_SERVICE_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("SUPABASE_ANON_KEY")
		}
		url := supaURL + "/rest/v1/bids?user_id=eq." + userResp.ID
		reqBids, _ := http.NewRequest("GET", url, nil)
		reqBids.Header.Set("apikey", apiKey)
		reqBids.Header.Set("Authorization", "Bearer "+apiKey)
		reqBids.Header.Set("Content-Type", "application/json")

		respBids, err := http.DefaultClient.Do(reqBids)
		if err != nil {
			respondError(w, "Failed to fetch bids", http.StatusInternalServerError)
			return
		}
		defer respBids.Body.Close()

		if respBids.StatusCode != http.StatusOK {
			respondError(w, "Failed to fetch bids", http.StatusInternalServerError)
			return
		}

		var bids []Bid
		if err := json.NewDecoder(respBids.Body).Decode(&bids); err != nil {
			respondError(w, "Invalid bids response", http.StatusInternalServerError)
			return
		}

		// For each bid, fetch listing details
		for i := range bids {
			listingURL := supaURL + "/rest/v1/listings?id=eq." + bids[i].ListingID
			reqListing, _ := http.NewRequest("GET", listingURL, nil)
			reqListing.Header.Set("apikey", apiKey)
			reqListing.Header.Set("Authorization", "Bearer "+apiKey)
			reqListing.Header.Set("Content-Type", "application/json")

			respListing, err := http.DefaultClient.Do(reqListing)
			if err != nil || respListing.StatusCode != http.StatusOK {
				continue // skip if listing not found
			}
			var listings []struct {
				Title      string   `json:"title"`
				Images     []string `json:"images"`
				CurrentBid float64  `json:"current_bid"`
				AuctionEnd string   `json:"auction_end_time"`
			}
			if err := json.NewDecoder(respListing.Body).Decode(&listings); err == nil && len(listings) > 0 {
				bids[i].Title = listings[0].Title
				if len(listings[0].Images) > 0 {
					bids[i].Image = listings[0].Images[0]
				}
				bids[i].CurrentBid = listings[0].CurrentBid
				bids[i].AuctionEnd = listings[0].AuctionEnd
				// Calculate time left
				auctionEnd, err := time.Parse(time.RFC3339, listings[0].AuctionEnd)
				if err == nil {
					duration := time.Until(auctionEnd)
					if duration > 0 {
						bids[i].TimeLeft = fmt.Sprintf("%dm left", int(duration.Minutes()))
					} else {
						bids[i].TimeLeft = "Ended"
					}
				}
				// Determine label
				if bids[i].TimeLeft == "Ended" {
					if bids[i].BidAmount == bids[i].CurrentBid {
						bids[i].Label = "Winning"
					} else {
						bids[i].Label = "Lost"
					}
				} else {
					if bids[i].BidAmount == bids[i].CurrentBid {
						bids[i].Label = "Winning"
					} else {
						bids[i].Label = "Outbid"
					}
				}
			}
			respListing.Body.Close()
		}

		respondJSON(w, map[string]interface{}{
			"bids": bids,
		})
	}
}

// TopListingsHandler fetches listings for trending now, ending soon, and starting soon
func topListingsHandler(authClient *auth.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		supaURL := os.Getenv("SUPABASE_URL")
		apiKey := os.Getenv("SUPABASE_SERVICE_KEY")
		if apiKey == "" {
			apiKey = os.Getenv("SUPABASE_ANON_KEY")
		}

		url := supaURL + "/rest/v1/listings?select=*&order=auction_end_time.asc"
		reqListings, _ := http.NewRequest("GET", url, nil)
		reqListings.Header.Set("apikey", apiKey)
		reqListings.Header.Set("Authorization", "Bearer "+apiKey)
		reqListings.Header.Set("Content-Type", "application/json")

		respListings, err := http.DefaultClient.Do(reqListings)
		if err != nil || respListings.StatusCode != http.StatusOK {
			respondError(w, "Failed to fetch listings", http.StatusInternalServerError)
			return
		}
		defer respListings.Body.Close()

		var listings []struct {
			ID           string   `json:"id"`
			Title        string   `json:"title"`
			Subtitle     string   `json:"subtitle"`
			Images       []string `json:"images"`
			StartingBid  float64  `json:"starting_bid"`
			AuctionStart string   `json:"auction_start_time"`
			AuctionEnd   string   `json:"auction_end_time"`
		}
		if err := json.NewDecoder(respListings.Body).Decode(&listings); err != nil {
			respondError(w, "Invalid listings response", http.StatusInternalServerError)
			return
		}

		now := time.Now().UTC()
		var trending, endingSoon, startingSoon []map[string]interface{}

		for _, l := range listings {
			// Fetch top bid for this listing
			bidsURL := supaURL + "/rest/v1/bids?listing_id=eq." + l.ID + "&order=bid_amount.desc&limit=1"
			reqBids, _ := http.NewRequest("GET", bidsURL, nil)
			reqBids.Header.Set("apikey", apiKey)
			reqBids.Header.Set("Authorization", "Bearer "+apiKey)
			reqBids.Header.Set("Content-Type", "application/json")

			respBids, err := http.DefaultClient.Do(reqBids)
			if err != nil || respBids.StatusCode != http.StatusOK {
				continue
			}
			var bids []struct {
				BidAmount float64 `json:"bid_amount"`
			}
			if err := json.NewDecoder(respBids.Body).Decode(&bids); err != nil {
				respBids.Body.Close()
				continue
			}
			respBids.Body.Close()

			currentBid := l.StartingBid
			if len(bids) > 0 {
				currentBid = bids[0].BidAmount
			}

			auctionEnd, _ := time.Parse(time.RFC3339, l.AuctionEnd)
			auctionStart, _ := time.Parse(time.RFC3339, l.AuctionStart)

			card := map[string]interface{}{
				"id":                 l.ID,
				"title":              l.Title,
				"subtitle":           l.Subtitle,
				"image":              "",
				"current_bid":        currentBid,
				"auction_end_time":   l.AuctionEnd,
				"auction_start_time": l.AuctionStart,
			}
			if len(l.Images) > 0 {
				card["image"] = l.Images[0]
			}

			// Trending: highest current bid (top N)
			// Ending soon: active auction with <= 24h until auction_end_time
			// Starting soon: auction_start_time within next 1 hour and not started yet
			if auctionEnd.After(now) && auctionEnd.Sub(now) <= 24*time.Hour {
				endingSoon = append(endingSoon, card)
			} else if auctionStart.After(now) && auctionStart.Before(now.Add(1*time.Hour)) {
				startingSoon = append(startingSoon, card)
			} else if auctionEnd.After(now) {
				trending = append(trending, card)
			}
		}

		// Sort trending by current_bid descending
		// (Simple bubble sort for brevity, use sort.Slice in production)
		for i := 0; i < len(trending); i++ {
			for j := i + 1; j < len(trending); j++ {
				if trending[j]["current_bid"].(float64) > trending[i]["current_bid"].(float64) {
					trending[i], trending[j] = trending[j], trending[i]
				}
			}
		}
		if len(trending) > 5 {
			trending = trending[:5]
		}
		if len(endingSoon) > 50 {
			endingSoon = endingSoon[:50]
		}
		if len(startingSoon) > 5 {
			startingSoon = startingSoon[:5]
		}

		respondJSON(w, map[string]interface{}{
			"trending_now":  trending,
			"ending_soon":   endingSoon,
			"starting_soon": startingSoon,
		})
	}
}
