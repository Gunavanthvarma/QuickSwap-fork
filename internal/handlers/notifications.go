package handlers

import (
	"net/http"
	"time"

	"github.com/quickswap/quickswap/internal/db"
)

// Notification represents a user notification record.
type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	ListingID string    `json:"listing_id"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

// getNotificationsHandler returns all notifications for the authenticated user.
// GET /api/notifications
func getNotificationsHandler(pg db.DBQuerier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		rows, err := pg.Query(r.Context(), `
			SELECT id, user_id, type, title, message, listing_id, is_read, created_at
			FROM notifications
			WHERE user_id = $1
			ORDER BY created_at DESC
		`, userID)
		if err != nil {
			respondError(w, "Failed to fetch notifications", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		notifications := []Notification{}
		for rows.Next() {
			var n Notification
			if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.ListingID, &n.IsRead, &n.CreatedAt); err != nil {
				continue
			}
			notifications = append(notifications, n)
		}

		respondJSON(w, map[string]interface{}{
			"notifications": notifications,
		})
	}
}

// getNotificationCountHandler returns the unread notification count for the user.
// GET /api/notifications/count
func getNotificationCountHandler(pg db.DBQuerier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		var count int
		err = pg.QueryRow(r.Context(), `
			SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false
		`, userID).Scan(&count)
		if err != nil {
			respondError(w, "Failed to fetch notification count", http.StatusInternalServerError)
			return
		}

		respondJSON(w, map[string]interface{}{
			"unread_count": count,
		})
	}
}

// markNotificationReadHandler marks a single notification as read.
// PUT /api/notifications/{id}/read
func markNotificationReadHandler(pg db.DBQuerier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		notifID := r.PathValue("id")
		if notifID == "" {
			respondError(w, "Notification ID is required", http.StatusBadRequest)
			return
		}

		result, err := pg.Exec(r.Context(), `
			UPDATE notifications SET is_read = true
			WHERE id = $1 AND user_id = $2
		`, notifID, userID)
		if err != nil {
			respondError(w, "Failed to mark notification as read", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			respondError(w, "Notification not found", http.StatusNotFound)
			return
		}

		respondJSON(w, map[string]interface{}{
			"message": "Notification marked as read",
		})
	}
}

// markAllNotificationsReadHandler marks all notifications as read for the authenticated user.
// PUT /api/notifications/read-all
func markAllNotificationsReadHandler(pg db.DBQuerier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		userID, err := getUserIDFromToken(r)
		if err != nil {
			respondError(w, err.Error(), http.StatusUnauthorized)
			return
		}

		_, err = pg.Exec(r.Context(), `
			UPDATE notifications SET is_read = true WHERE user_id = $1
		`, userID)
		if err != nil {
			respondError(w, "Failed to mark all notifications as read", http.StatusInternalServerError)
			return
		}

		respondJSON(w, map[string]interface{}{
			"message": "All notifications marked as read",
		})
	}
}

// deleteNotificationHandler deletes a single notification by ID.
// DELETE /api/notifications/{id}
func deleteNotificationHandler(pg db.DBQuerier) http.HandlerFunc {
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

		notifID := r.PathValue("id")
		if notifID == "" {
			respondError(w, "Notification ID is required", http.StatusBadRequest)
			return
		}

		result, err := pg.Exec(r.Context(), `
			DELETE FROM notifications WHERE id = $1 AND user_id = $2
		`, notifID, userID)
		if err != nil {
			respondError(w, "Failed to delete notification", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			respondError(w, "Notification not found", http.StatusNotFound)
			return
		}

		respondJSON(w, map[string]interface{}{
			"message": "Notification deleted",
		})
	}
}
