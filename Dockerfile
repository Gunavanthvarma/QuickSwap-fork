# ==========================================
# Build Stage
# ==========================================
FROM golang:1.21-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy go mod and sum files first (to leverage Docker layer caching)
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the entire project
COPY . .

# Build the Go app statically linked (important for Alpine)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o quickswap-server ./cmd/server

# ==========================================
# Run Stage
# ==========================================
FROM alpine:latest  

# Install CA certificates (Required to make HTTPS calls to Supabase/Upstash securely)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the compiled binary from the builder stage
COPY --from=builder /app/quickswap-server .

# Expose the fallback port (Render overrides this with $PORT)
EXPOSE 8082

# Start the server
CMD ["./quickswap-server"]
