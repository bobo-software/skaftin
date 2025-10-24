# 🚀 Skaftin Platform - Development Plan

## 📋 Project Overview
Building a self-hosted Supabase/Appwrite alternative with Node.js, TypeScript, PostgreSQL, MinIO, and React frontend.

## 🎯 Core Objectives
- **V1 Goal**: Basic authentication, project creation, database management, and file storage
- **Architecture**: Modular backend with MCP compatibility for AI-assisted development
- **UI/UX**: Retro-modern design with green accent theme
- **Database**: PostgreSQL with schema-per-project isolation

## 🏗️ Architecture Overview

### Backend Stack
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js (upgrade to Fastify later)
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: MinIO (S3-compatible)
- **Auth**: Basic email/password (JWT tokens)
- **Realtime**: Socket.io + Redis (future)
- **MCP**: Custom tools for database and storage operations

### Frontend Stack
- **Framework**: React + TypeScript
- **Styling**: CSS Modules + Retro-modern theme
- **State**: Context API (upgrade to Zustand later)
- **HTTP**: Axios for API calls

## 📊 Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Backend project structure setup
- [ ] Database schema design (users, projects, schemas)
- [ ] Basic authentication system
- [ ] MinIO integration
- [ ] Project creation API
- [ ] Frontend project setup
- [ ] Basic routing and authentication flow

### Phase 2: Core Features (Week 3-4)
- [ ] Project dashboard UI
- [ ] Database table management
- [ ] SQL editor implementation
- [ ] File storage interface
- [ ] MCP tools development
- [ ] GraphQL layer (basic)

### Phase 3: Polish & Advanced (Week 5-6)
- [ ] Real-time updates
- [ ] Advanced database features
- [ ] Performance optimization
- [ ] Testing suite
- [ ] Documentation

## 🗂️ Project Structure

```
skaftin/
├── src/
│   ├── backend/
│   │   ├── config/          # Environment & database config
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, validation, etc.
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── db/              # Database schemas & migrations
│   │   ├── utils/           # Helpers
│   │   └── mcp/             # MCP tools
│   └── frontend/
│       ├── src/
│       │   ├── components/  # Reusable UI components
│       │   ├── pages/       # Page components
│       │   ├── hooks/       # Custom React hooks
│       │   ├── services/    # API services
│       │   ├── styles/      # CSS modules
│       │   └── types/       # TypeScript definitions
│       └── public/
├── docker/
│   ├── docker-compose.yml   # PostgreSQL, MinIO, Redis
│   └── Dockerfile
└── docs/                    # Documentation
```

## 🔐 Authentication Flow
1. **Login**: Email/password → JWT token
2. **Project Creation**: User creates project → Schema + MinIO bucket created
3. **Dashboard Access**: Token-based access to project resources

## 🗄️ Database Design

### Core Schemas
- **public.users**: User accounts and settings
- **public.projects**: Project metadata
- **public.project_schemas**: Schema isolation per project
- **{project_schema}**: User-defined tables

### Key Features
- Schema-per-project isolation
- Dynamic table creation
- SQL editor with execution
- GraphQL auto-generation
- Migration management

## 🎨 UI/UX Design System

### Theme: Retro-Modern
- **Light Mode**: White background, #32A956 accents
- **Dark Mode**: Black background, green accents
- **Typography**: Modern sans-serif with retro touches
- **Components**: Clean, minimal with subtle animations

### Key Pages
1. **Login**: Simple email/password form
2. **Project Creation**: Loading animation during provisioning
3. **Dashboard**: Sidebar navigation with sections
4. **Database**: Table management and SQL editor
5. **Storage**: File browser interface

## 🛠️ MCP Tools Specification

### Database Tools
- `search_docs`: Documentation search
- `list_tables`: Show project tables
- `list_extensions`: PostgreSQL extensions
- `list_migrations`: Migration history
- `apply_migration`: Execute migrations
- `execute_sql`: Run SQL queries
- `get_logs`: Database logs
- `get_advisors`: Performance/security advice
- `generate_typescript_types`: Auto-generate types
- `create_schema`: New schema creation
- `delete_schema`: Schema removal

### Storage Tools
- `search_bucket`: File search in MinIO
- `upload_file`: File upload
- `download_file`: File download
- `list_buckets`: Available buckets
- `create_bucket`: New bucket creation

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- MinIO server
- Docker (optional)

### Quick Start
1. Clone repository
2. Install dependencies: `npm install`
3. Setup environment variables
4. Start services: `docker-compose up -d`
5. Run migrations
6. Start development: `npm run dev`

## 📈 Success Metrics
- **Performance**: <200ms API response times
- **Reliability**: 99.9% uptime
- **Usability**: Intuitive project creation flow
- **Developer Experience**: Easy MCP integration

## 🔄 Next Steps
1. Review and approve this plan
2. Setup development environment
3. Begin Phase 1 implementation
4. Regular progress reviews and adjustments

---

*This plan will be updated as we progress through development phases.*
