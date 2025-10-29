# 🚀 Skaftin Platform - Supabase/Appwrite Alternative

A comprehensive self-hosted backend-as-a-service platform designed for modern application development.  
Built with Node.js, TypeScript, PostgreSQL, and MinIO — providing database management, file storage, authentication, and MCP integration for AI-assisted development.

---

## 🧱 Core Features

- **Authentication & Authorization** via JWT tokens (email/password)
- **Database Management** using PostgreSQL with schema-per-project isolation
- **File Storage** using MinIO (S3-compatible) with bucket-per-project
- **Real-time Events** using Socket.io (Redis integration planned)
- **SQL Editor** with query execution and result visualization
- **GraphQL API** with auto-generated schemas
- **RESTful API** built with Express.js (Fastify migration planned)
- **TypeScript-first** with full type safety
- **MCP Compatibility Layer** for AI-assisted development
- **Project Dashboard** with intuitive database and storage management

---

## 🧩 Tech Stack Overview

| Layer | Technology | Description |
|-------|-------------|-------------|
| **Runtime** | Node.js (v20+) | Modern JavaScript runtime with async I/O |
| **Language** | TypeScript | Strict typing and developer ergonomics |
| **Framework** | Fastify | Lightweight, high-performance web framework |
| **Database** | PostgreSQL | Reliable relational DB with JSON support |
| **ORM** | Prisma | Type-safe database access layer |
| **Storage** | MinIO | S3-compatible object storage for uploads |
| **Cache & Events** | Redis | Pub/Sub messaging + background jobs |
| **Auth Provider** | JWT + bcrypt | Simple email/password authentication |
| **Serverless Functions** | Node.js Workers | Execute user-defined code safely |
| **Realtime** | Socket.io | Push DB events and function updates to clients |
| **Containerization** | Docker | Easy local or VPS deployment |

---

## 📂 Project Structure

project-root/
│
├── src/
│ ├── main.ts # Fastify app entrypoint
│ ├── config/ # Environment config (dotenv, keys)
│ ├── modules/
│ │ ├── auth/ # Auth routes, JWT, user model
│ │ ├── db/ # Prisma client, migrations
│ │ ├── storage/ # MinIO client, file uploads
│ │ ├── realtime/ # Socket.io and Redis events
│ │ ├── functions/ # Serverless function runner
│ │ └── mcp/ # MCP compatibility layer
│ └── utils/ # Helpers (logger, error handler)
│
├── prisma/
│ ├── schema.prisma # Database schema
│ └── migrations/ # Auto-generated migrations
│
├── docker/
│ ├── docker-compose.yml # Postgres, MinIO, Redis services
│ └── Dockerfile # App container definition
│
├── .env.example # Example environment variables
├── tsconfig.json # TypeScript configuration
├── package.json
└── README.md

## 🔑 Authentication

Configure your Authentik or Keycloak instance and register your backend as an OIDC client.

The backend uses the OIDC discovery endpoint to verify tokens and manage sessions.

Once connected, users can log in via the /auth/login endpoint using OAuth.

## 📦 Storage (MinIO)

MinIO provides an S3-compatible API for object storage.
The backend connects via environment variables:

MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=app-data

⚡ Realtime Events

Database events trigger Redis Pub/Sub messages.

Connected clients receive updates through Socket.io.

Great for live dashboards and collaborative UIs.

## 🧠 Serverless Functions

Users can upload or define small TypeScript/JavaScript functions.
These are sandboxed and executed using isolated Node.js workers.

Example user function:

export async function handler(event: any) {
  return { message: `Hello ${event.name}!` };
}


Invoke via API:

POST /functions/run
{
  "functionId": "greet",
  "payload": { "name": "Gift" }
}

## 🧩 MCP Compatibility

The mcp module provides:

Standardized endpoints for CRUD, Auth, and File operations

Unified schema for AI-assisted IDEs (like Cursor or Windsurf)

Built-in metadata for model context awareness

AI agents can introspect the backend to generate code, functions, and UI components automatically without hand-writing APIs.

## 🔒 Security

All API requests require JWT or OAuth2 bearer tokens.

Rate limiting and validation middleware built-in.

CORS and HTTPS enforced by default (in production).

### 🚀 Roadmap

 Admin dashboard (Next.js)

 AI-assisted schema generation

 Function marketplace

 GraphQL layer

 MCP schema registry

### 🧑‍💻 Contributing

Fork this repo

Create your feature branch (git checkout -b feature/awesome-feature)

Commit changes (git commit -m "feat: add awesome feature")

Push to the branch (git push origin feature/awesome-feature)

Open a Pull Request 🚀

### 📄 License

MIT License © 2025

### 🌐 Summary

This backend gives you:

Full control like Appwrite/Supabase

Self-hosted OAuth via Authentik

Fast, modern Node.js + TypeScript core

MCP-ready architecture for AI IDEs

Build apps faster. Deploy anywhere. Fully open and hackable.