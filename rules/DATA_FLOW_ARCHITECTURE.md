# 🔄 Data Flow Architecture Rules

## Overview

This document defines the standard data flow architecture for the Skaftin platform. We separate concerns between AI-assisted features (MCP tools) and standard CRUD operations (traditional REST API).

## 🎯 Core Principles

### 1. MCP Tools are for AI-Assisted Features ONLY
**MCP tools** should be reserved for:
- AI-assisted code generation
- Complex schema introspection
- AI-powered data analysis
- Developer tools and utilities
- Administrative operations requiring AI assistance

### 2. Standard CRUD uses Traditional REST API
**Traditional REST API** should be used for:
- Basic CRUD operations (Create, Read, Update, Delete)
- User authentication and authorization
- Project management
- File uploads and downloads
- All standard application features

## 📊 Data Flow Architecture

### Frontend → Backend Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User Action / Component                                    │
│           ↓                                                     │
│  2. Zustand Store (stores/data/* or stores/state/*)           │
│           ↓                                                     │
│  3. RequestUtils.{get|post|put|delete}()                      │
│           ↓                                                     │
│  4. ApiRoutes.{CATEGORY}.{ENDPOINT}                           │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                        │ HTTP Request
                        │
┌────────────────────────┴────────────────────────────────────────┐
│                         BACKEND                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Express App (Server.ts)                                    │
│           ↓                                                     │
│  2. Router (routers/{Entity}Router.ts)                         │
│           ↓                                                     │
│  3. Controller (controllers/{Entity}Controller.ts)             │
│           ↓                                                     │
│  4. Drizzle ORM (db/schemas/{Entity}Schema.ts)                │
│           ↓                                                     │
│  5. PostgreSQL Database                                        │
│           ↓                                                     │
│  6. Response via ResponseUtils                                 │
│           ↓                                                     │
│  7. WebSocket Event Emission (if applicable)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Frontend Structure

### Store Organization

```
frontend/src/stores/
├── data/               # Data-related stores (entities, CRUD)
│   ├── useProjectStore.ts
│   ├── useDatabaseStore.ts
│   ├── useFileStore.ts
│   └── useAuthStore.ts
├── state/              # UI state stores (non-data)
│   ├── useAppStore.ts
│   ├── useUIStore.ts
│   └── useModalStore.ts
└── realtime/           # Real-time/WebSocket stores
    └── useRealtimeStore.ts
```

### Store Rules

#### Data Stores (`stores/data/`)
**Purpose**: Manage entity data and CRUD operations

**Pattern**:
```typescript
import { create } from 'zustand';
import RequestUtils from '@/utils/RequestUtils';
import ApiRoutes from '@/constants/ApiRoutes';

interface Entity {
  id: string;
  name: string;
  // ... other fields
}

interface EntityStoreType {
  // State
  entities: Entity[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchEntities: () => Promise<void>;
  createEntity: (data: Partial<Entity>) => Promise<Entity | null>;
  updateEntity: (id: string, data: Partial<Entity>) => Promise<Entity | null>;
  deleteEntity: (id: string) => Promise<boolean>;
  clearError: () => void;
}

const useEntityStore = create<EntityStoreType>((set, get) => ({
  // Initial state
  entities: [],
  loading: false,
  error: null,
  
  // Fetch all entities
  fetchEntities: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(ApiRoutes.ENTITIES.LIST, token);
      
      if (response.success) {
        set({ entities: response.data, loading: false });
      } else {
        set({ error: response.message, loading: false });
      }
    } catch (error) {
      set({ error: 'Failed to fetch entities', loading: false });
    }
  },
  
  // Create entity
  createEntity: async (data) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.post(
        ApiRoutes.ENTITIES.CREATE,
        token,
        data
      );
      
      if (response.success) {
        set(state => ({
          entities: [...state.entities, response.data],
          loading: false
        }));
        return response.data;
      } else {
        set({ error: response.message, loading: false });
        return null;
      }
    } catch (error) {
      set({ error: 'Failed to create entity', loading: false });
      return null;
    }
  },
  
  // Update entity
  updateEntity: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.put(
        ApiRoutes.ENTITIES.UPDATE(id),
        token,
        data
      );
      
      if (response.success) {
        set(state => ({
          entities: state.entities.map(e => 
            e.id === id ? { ...e, ...response.data } : e
          ),
          loading: false
        }));
        return response.data;
      } else {
        set({ error: response.message, loading: false });
        return null;
      }
    } catch (error) {
      set({ error: 'Failed to update entity', loading: false });
      return null;
    }
  },
  
  // Delete entity
  deleteEntity: async (id) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.delete(
        ApiRoutes.ENTITIES.DELETE(id),
        token,
        {}
      );
      
      if (response.success) {
        set(state => ({
          entities: state.entities.filter(e => e.id !== id),
          loading: false
        }));
        return true;
      } else {
        set({ error: response.message, loading: false });
        return false;
      }
    } catch (error) {
      set({ error: 'Failed to delete entity', loading: false });
      return false;
    }
  },
  
  clearError: () => set({ error: null }),
}));

export default useEntityStore;
```

#### State Stores (`stores/state/`)
**Purpose**: Manage UI state, not entity data

**Examples**:
- Theme settings
- Sidebar open/closed
- Current user
- Modal states
- Loading indicators

## 📁 Backend Structure

### Directory Organization

```
src/
├── controllers/          # Business logic handlers
│   ├── ProjectsController.ts
│   ├── FilesController.ts
│   ├── AuthController.ts
│   └── UsersController.ts
├── routers/             # Route definitions
│   ├── ProjectsRouter.ts
│   ├── FilesRouter.ts
│   ├── AuthRouter.ts
│   └── UsersRouter.ts
├── db/
│   ├── drizzle.config.ts    # Drizzle connection
│   └── schemas/              # Database schemas
│       ├── UsersSchema.ts
│       ├── ProjectsSchema.ts
│       ├── FilesSchema.ts
│       └── ChurchesSchema.ts
├── utils/               # Utility functions
│   ├── ResponseUtils.ts
│   ├── CommonUtils.ts
│   └── websocketEmitter.ts
├── services/            # External services
│   └── WebSocketService.ts
└── mcp/                 # MCP tools (AI-assisted only)
    ├── MCPServer.ts
    └── tools/
        ├── databaseTools.ts
        ├── projectTools.ts
        └── storageTools.ts
```

### Router Pattern

```typescript
// src/routers/EntityRouter.ts
import express from 'express';
import EntityController from '../controllers/EntityController';

const router = express.Router();

// GET routes
router.get('/list', EntityController.getAll);
router.get('/:id', EntityController.getById);

// POST routes
router.post('/create', EntityController.create);

// PUT routes
router.put('/update/:id', EntityController.update);

// DELETE routes
router.delete('/delete/:id', EntityController.delete);

export { router };
```

### Controller Pattern

```typescript
// src/controllers/EntityController.ts
import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import { entities } from '../db/schemas/EntitySchema';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';
import { emitDatabaseChange } from '../utils/websocketEmitter';

class EntityController {
  // Get all entities
  static async getAll(req: Request, res: Response) {
    // Authentication
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const results = await db
        .select()
        .from(entities)
        .where(eq(entities.userId, decodedToken.userId));

      ResponseUtils.success(res, 'Entities fetched successfully', results);
    } catch (error) {
      console.error('Error fetching entities:', error);
      ResponseUtils.error(res, 'Failed to fetch entities', error);
    }
  }

  // Get by ID
  static async getById(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const result = await db
        .select()
        .from(entities)
        .where(eq(entities.id, parseInt(id)));

      if (result.length === 0) {
        return ResponseUtils.error(res, 'Entity not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Entity fetched successfully', result[0]);
    } catch (error) {
      console.error('Error fetching entity:', error);
      ResponseUtils.error(res, 'Failed to fetch entity', error);
    }
  }

  // Create
  static async create(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { name, description } = req.body;

      // Validation
      if (!name) {
        return ResponseUtils.error(res, 'Name is required', null, null, 400);
      }

      const result = await db
        .insert(entities)
        .values({
          name,
          description,
          userId: decodedToken.userId,
        })
        .returning();

      // Emit WebSocket event
      emitDatabaseChange(
        result[0].projectId,
        'entities',
        'insert',
        result[0]
      );

      ResponseUtils.success(res, 'Entity created successfully', result[0], 201);
    } catch (error) {
      console.error('Error creating entity:', error);
      ResponseUtils.error(res, 'Failed to create entity', error);
    }
  }

  // Update
  static async update(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const updates = req.body;

      const result = await db
        .update(entities)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(entities.id, parseInt(id)))
        .returning();

      if (result.length === 0) {
        return ResponseUtils.error(res, 'Entity not found', null, null, 404);
      }

      // Emit WebSocket event
      emitDatabaseChange(
        result[0].projectId,
        'entities',
        'update',
        result[0]
      );

      ResponseUtils.success(res, 'Entity updated successfully', result[0]);
    } catch (error) {
      console.error('Error updating entity:', error);
      ResponseUtils.error(res, 'Failed to update entity', error);
    }
  }

  // Delete
  static async delete(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;

      const result = await db
        .delete(entities)
        .where(eq(entities.id, parseInt(id)))
        .returning();

      if (result.length === 0) {
        return ResponseUtils.error(res, 'Entity not found', null, null, 404);
      }

      // Emit WebSocket event
      emitDatabaseChange(
        result[0].projectId,
        'entities',
        'delete',
        { id: result[0].id }
      );

      ResponseUtils.success(res, 'Entity deleted successfully');
    } catch (error) {
      console.error('Error deleting entity:', error);
      ResponseUtils.error(res, 'Failed to delete entity', error);
    }
  }
}

export default EntityController;
```

### Schema Pattern (Drizzle ORM)

```typescript
// src/db/schemas/EntitySchema.ts
import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  integer, 
  timestamp, 
  boolean 
} from 'drizzle-orm/pg-core';

export const entities = pgTable('entities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  userId: integer('user_id').notNull(),
  projectId: integer('project_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
```

## 🔒 Authentication Pattern

### Backend Authentication Middleware

All protected routes should use the authentication pattern:

```typescript
const decodedToken = CommonUtils.handleAuthHeader(req);
if (decodedToken instanceof Response) {
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

// Now you have access to:
// - decodedToken.userId
// - decodedToken.email
```

### Frontend Token Management

```typescript
// Store token on login
localStorage.setItem('skaftin-token', token);

// Use token in requests
const token = localStorage.getItem('skaftin-token') || '';
const response = await RequestUtils.get(ApiRoutes.ENTITIES.LIST, token);

// Remove token on logout
localStorage.removeItem('skaftin-token');
```

## 📡 Real-Time Updates (WebSocket)

### When to Emit WebSocket Events

Emit WebSocket events for:
- ✅ Create operations (insert)
- ✅ Update operations
- ✅ Delete operations
- ❌ Read operations (no need)

### Pattern

```typescript
import { emitDatabaseChange } from '../utils/websocketEmitter';

// After successful database operation
emitDatabaseChange(
  projectId,      // Project ID for room targeting
  'tableName',    // Table/entity name
  'insert',       // Operation type
  data            // Changed data
);
```

## 📝 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Entity created successfully",
  "data": {
    "id": 1,
    "name": "Example",
    "createdAt": "2025-11-01T12:00:00.000Z"
  },
  "timestamp": "2025-11-01T12:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Failed to create entity",
  "error": "Validation error: Name is required"
}
```

## ✅ Checklist for New Features

### Frontend Checklist
- [ ] Create/update Zustand store in appropriate directory
- [ ] Use RequestUtils for all API calls
- [ ] Add routes to ApiRoutes.ts
- [ ] Handle loading and error states
- [ ] Update UI on success/error
- [ ] Listen for WebSocket events if needed

### Backend Checklist
- [ ] Create Drizzle schema in `db/schemas/`
- [ ] Create controller in `controllers/`
- [ ] Create router in `routers/`
- [ ] Register router in Server.ts
- [ ] Use ResponseUtils for all responses
- [ ] Implement authentication where needed
- [ ] Emit WebSocket events for mutations
- [ ] Add proper error handling
- [ ] Add validation for inputs

## 🚫 Anti-Patterns to Avoid

### ❌ Don't Mix MCP Tools with CRUD
```typescript
// BAD: Using MCP tools for basic CRUD
const result = await McpService.createProject(userId, name);

// GOOD: Use traditional REST API
const result = await RequestUtils.post(
  ApiRoutes.PROJECTS.CREATE,
  token,
  { name, description }
);
```

### ❌ Don't Put Business Logic in Components
```typescript
// BAD: Direct API call in component
const handleCreate = async () => {
  const response = await fetch('/api/entities', { ... });
};

// GOOD: Use store action
const { createEntity } = useEntityStore();
const handleCreate = async () => {
  await createEntity({ name, description });
};
```

### ❌ Don't Skip Error Handling
```typescript
// BAD: No error handling
const entities = await RequestUtils.get(ApiRoutes.ENTITIES.LIST, token);
setEntities(entities.data);

// GOOD: Proper error handling
try {
  const response = await RequestUtils.get(ApiRoutes.ENTITIES.LIST, token);
  if (response.success) {
    setEntities(response.data);
  } else {
    setError(response.message);
  }
} catch (error) {
  setError('Network error');
}
```

## 📚 Summary

1. **MCP Tools**: AI-assisted features only
2. **REST API**: Standard CRUD operations
3. **Data Flow**: Component → Store → RequestUtils → ApiRoutes → Router → Controller → Drizzle → DB
4. **Store Organization**: `data/` for entities, `state/` for UI state
5. **Authentication**: JWT tokens, CommonUtils.handleAuthHeader()
6. **Responses**: ResponseUtils.success() and ResponseUtils.error()
7. **Real-Time**: WebSocket events for create/update/delete operations
8. **Validation**: Validate inputs in controllers
9. **Error Handling**: Comprehensive try-catch blocks
10. **TypeScript**: Proper typing throughout the stack

