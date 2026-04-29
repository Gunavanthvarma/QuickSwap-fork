package handlers

import (
	"net/http"
)

// healthCheckHandler responds with a 200 OK and a simple JSON payload.
// This is used by cloud load balancers to ensure the container is healthy.
func healthCheckHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, map[string]string{
			"status": "ok",
		})
	}
}
