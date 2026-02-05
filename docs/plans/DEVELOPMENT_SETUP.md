# 🚀 Development Setup - Skaftin Platform

## 📋 Quick Start Guide

This guide will help you set up the Skaftin platform for development with separate frontend and backend servers.

## 🎯 Prerequisites

- **Node.js** 20+ 
- **PostgreSQL** 15+
- **MinIO** server
- **Git**

## 🏗️ Project Structure

```
skaftin/
├── src/backend/           # Backend server (Port 4005)
├── frontend/             # React frontend (Port 3005)
├── .env                  # Environment configuration
├── package.json          # Backend dependencies
└── README.md
```

## ⚙️ Environment Configuration

Your `.env` file is already configured with:
- **Frontend**: Port 3005
- **Backend**: Port 4005
- **Database**: PostgreSQL connection
- **MinIO**: Local MinIO server

## 🚀 Development Commands

### Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies (when frontend is created)
cd frontend && npm install
```

### Development Scripts

#### Backend Only
```bash
npm run dev:backend
# Starts backend server on port 4005
```

#### Frontend Only
```bash
npm run dev:frontend
# Starts React frontend on port 3005
```

#### Both Servers
```bash
npm run dev:all
# Starts both backend and frontend concurrently
```

#### Setup Everything
```bash
npm run setup
# Installs all dependencies for both backend and frontend
```

## 🔧 Backend Configuration

### Server Setup
The backend server is configured to:
- Run on port **4005** (from your .env)
- Accept CORS requests from frontend on port **3005**
- Use PostgreSQL database
- Connect to MinIO for file storage

### Key Files
- `src/Server.ts` - Main server entry point
- `src/backend/config/environment.ts` - Configuration management
- `.env` - Environment variables

### Database Setup
```bash
# Create database (if not exists)
sudo -u postgres createdb skaftin_db

# Create user (if not exists)
sudo -u postgres psql -c "CREATE USER skaftin_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE skaftin_db TO skaftin_user;"
```

### MinIO Setup
```bash
# Start MinIO server
./minio server /data --console-address ":9001"
# Access MinIO console at http://localhost:9001
```

## 🎨 Frontend Configuration

### React App Setup
```bash
# Create React frontend (when ready)
npx create-react-app frontend --template typescript
cd frontend
npm install axios react-router-dom
```

### Frontend Environment
Create `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:4005
REACT_APP_FRONTEND_PORT=3005
```

## 🔄 Development Workflow

### 1. Start Backend
```bash
npm run dev:backend
```
- Backend runs on http://localhost:4005
- API endpoints available
- Database connection established
- MinIO connection ready

### 2. Start Frontend
```bash
npm run dev:frontend
```
- Frontend runs on http://localhost:3005
- Proxy configured to backend
- Hot reload enabled

### 3. Development URLs
- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:4005
- **MinIO Console**: http://localhost:9001 (if using local MinIO)

## 🔧 CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:3005`
- `http://127.0.0.1:3005`

This allows the frontend to make API calls to the backend without CORS issues.

## 📊 API Endpoints

### Current Endpoints
- `GET /` - Health check
- `GET /api/health` - Server status

### Planned Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id/tables` - List project tables
- `POST /api/projects/:id/query` - Execute SQL queries

## 🐛 Troubleshooting

### Port Conflicts
If ports 3005 or 4005 are in use:
```bash
# Check what's using the ports
lsof -i :3005
lsof -i :4005

# Kill processes if needed
kill -9 <PID>
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d postgres
```

### MinIO Connection Issues
```bash
# Check MinIO status
curl http://localhost:9000/minio/health/live

# Test with mc client
mc alias set local http://localhost:9000 minioadmin minioadmin
mc ls local
```

## 🚀 Production Deployment

### Build Commands
```bash
# Build backend
npm run build

# Build frontend
npm run build:all
```

### Environment Variables
Ensure production environment variables are set:
- `NODE_ENV=production`
- `JWT_SECRET` (strong secret key)
- Database credentials
- MinIO credentials

## 📝 Development Notes

### Hot Reload
- Backend: Uses nodemon for automatic restarts
- Frontend: React's built-in hot reload

### TypeScript
- Backend: Full TypeScript support
- Frontend: TypeScript template used

### Database Migrations
- Migrations will be handled by Drizzle ORM
- Schema changes tracked in version control

### File Storage
- MinIO provides S3-compatible storage
- Bucket-per-project isolation
- File upload/download APIs

## 🔄 Next Steps

1. **Create Frontend**: Set up React application
2. **Authentication**: Implement login/register
3. **Project Management**: Create project CRUD
4. **Database Tools**: SQL editor and table management
5. **Storage Interface**: File upload/download
6. **MCP Integration**: AI development tools

---

*This setup guide will be updated as we implement new features.*
