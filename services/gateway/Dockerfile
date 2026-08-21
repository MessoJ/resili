# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /resili-gateway ./cmd/server

# Runtime stage
FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
COPY --from=builder /resili-gateway /resili-gateway
EXPOSE 8080
# NOTE: do NOT hardcode GATEWAY_PORT here. Platforms such as Heroku, Render and
# Cloud Run inject their own $PORT that the process must bind, and the gateway
# already falls back to 8080 for local runs (see cmd/server/main.go). Compose
# sets GATEWAY_PORT explicitly for the local stack.
ENV ML_SERVICE_URL=http://forecast-ingest:8001
ENTRYPOINT ["/resili-gateway"]
