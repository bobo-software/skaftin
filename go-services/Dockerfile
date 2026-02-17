# Stage 1: Build Stage
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

# Copy dependency files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/api

# Stage 2: Production Stage
FROM alpine:3.20

RUN apk --no-cache add ca-certificates wget

COPY --from=builder /server /server

EXPOSE 4007

CMD ["/server"]
