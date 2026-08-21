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
ENV GATEWAY_PORT=8080
ENV ML_SERVICE_URL=http://forecast-ingest:8001
ENTRYPOINT ["/resili-gateway"]
