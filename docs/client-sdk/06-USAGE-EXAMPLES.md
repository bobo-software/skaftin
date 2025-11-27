# Client SDK - Usage Examples

## ⭐ NEW: Unified Client Approach

**Recommended:** Use the unified `SkaftinClient` for direct API calls:

```typescript
import { skaftinClient } from './backend';

// Simple and direct
const response = await skaftinClient.get('/app-api/database/tables/associations/select');
const associations = response.data;
```

**Alternative:** Use service classes for more structured code (examples below).

Both approaches work - choose what fits your project!

---

## ⭐ NEW: App User Authentication Examples

See detailed examples in `07-APP-USER-AUTHENTICATION.md` including:
- User registration and login
- Role-based access control
- Custom user fields
- Email verification
- Session management

## ⭐ NEW: WebSocket Real-Time Updates

See `08-WEBSOCKET-INTEGRATION.md` for complete WebSocket setup, or check examples below.

---

# Data Management Examples

## Complete React Component Examples

### Example 1: List View with CRUD (Using Unified Client)

```typescript
// components/AssociationsList.tsx
import { useState, useEffect } from 'react';
import { skaftinClient } from '../backend';
// Or use service: import AssociationService from '../backend/services/AssociationService';

export function AssociationsList() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    loadAssociations();
  }, []);

  const loadAssociations = async () => {
    try {
      setLoading(true);
      const data = await AssociationService.findAll();
      setAssociations(data);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: CreateAssociationDto) => {
    try {
      await AssociationService.createAssociation(data);
      loadAssociations(); // Refresh list
    } catch (error) {
      console.error('Create failed:', error);
    }
  };

  const handleUpdate = async (id: number, name: string) => {
    try {
      await AssociationService.updateAssociation(id, { name });
      loadAssociations();
      setEditing(null);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this association?')) return;
    
    try {
      await AssociationService.delete(id);
      loadAssociations();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Taxi Associations</h1>
      <ul>
        {associations.map((assoc) => (
          <li key={assoc.id}>
            {editing === assoc.id ? (
              <input
                defaultValue={assoc.name}
                onBlur={(e) => handleUpdate(assoc.id, e.target.value)}
              />
            ) : (
              <>
                <strong>{assoc.name}</strong> - {assoc.location}
                <button onClick={() => setEditing(assoc.id)}>Edit</button>
                <button onClick={() => handleDelete(assoc.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 2: Master-Detail View

```typescript
// components/VehicleDetails.tsx
import { useState, useEffect } from 'react';
import VehicleService from '../backend/services/VehicleService';
import DriverService from '../backend/services/DriverService';
import { Vehicle } from '../backend/schemas/Vehicle.schema';
import { Driver } from '../backend/schemas/Driver.schema';

interface VehicleWithDriver extends Vehicle {
  driver?: Driver;
}

export function VehicleDetails({ vehicleId }: { vehicleId: number }) {
  const [vehicle, setVehicle] = useState<VehicleWithDriver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const loadVehicle = async () => {
    try {
      setLoading(true);
      const vehicleData = await VehicleService.findById(vehicleId);
      
      if (vehicleData && vehicleData.driver_id) {
        const driverData = await DriverService.findById(vehicleData.driver_id);
        setVehicle({ ...vehicleData, driver: driverData || undefined });
      } else {
        setVehicle(vehicleData);
      }
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!vehicle) return <div>Vehicle not found</div>;

  return (
    <div>
      <h2>Vehicle: {vehicle.registration_number}</h2>
      <p>Status: {vehicle.status}</p>
      {vehicle.driver && (
        <p>Driver: {vehicle.driver.license_number}</p>
      )}
    </div>
  );
}
```

### Example 3: Filtered List

```typescript
// components/ActiveVehiclesList.tsx
import { useState, useEffect } from 'react';
import VehicleService from '../backend/services/VehicleService';
import { Vehicle } from '../backend/schemas/Vehicle.schema';

export function ActiveVehiclesList({ associationId }: { associationId: number }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    loadVehicles();
  }, [associationId]);

  const loadVehicles = async () => {
    const allVehicles = await VehicleService.findByAssociation(associationId);
    const activeOnly = allVehicles.filter(v => v.status === 'active');
    setVehicles(activeOnly);
  };

  return (
    <div>
      <h3>Active Vehicles ({vehicles.length})</h3>
      {vehicles.map((vehicle) => (
        <div key={vehicle.id}>
          {vehicle.registration_number}
        </div>
      ))}
    </div>
  );
}
```

### Example 4: Create Form

```typescript
// components/CreateAssociationForm.tsx
import { useState } from 'react';
import AssociationService from '../backend/services/AssociationService';
import { CreateAssociationDto } from '../backend/schemas/Association.schema';

export function CreateAssociationForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState<CreateAssociationDto>({
    name: '',
    location: '',
    province: '',
    user_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      await AssociationService.createAssociation(formData);
      onSuccess();
      // Reset form
      setFormData({ name: '', location: '', province: '', user_id: '' });
    } catch (error: any) {
      alert('Failed to create: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Association Name"
        required
      />
      <input
        value={formData.location}
        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        placeholder="Location"
        required
      />
      <input
        value={formData.province}
        onChange={(e) => setFormData({ ...formData, province: e.target.value })}
        placeholder="Province"
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create Association'}
      </button>
    </form>
  );
}
```

### Example 5: Dashboard with Stats

```typescript
// components/Dashboard.tsx
import { useState, useEffect } from 'react';
import AssociationService from '../backend/services/AssociationService';
import VehicleService from '../backend/services/VehicleService';
import DriverService from '../backend/services/DriverService';

interface DashboardStats {
  totalAssociations: number;
  totalVehicles: number;
  activeVehicles: number;
  totalDrivers: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      const [associations, vehicles, drivers] = await Promise.all([
        AssociationService.findAll(),
        VehicleService.findAll(),
        DriverService.findAll(),
      ]);

      setStats({
        totalAssociations: associations.length,
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter(v => v.status === 'active').length,
        totalDrivers: drivers.length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="dashboard">
      <h1>Taxi Management Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Associations</h3>
          <p>{stats?.totalAssociations}</p>
        </div>
        <div className="stat-card">
          <h3>Vehicles</h3>
          <p>{stats?.totalVehicles}</p>
        </div>
        <div className="stat-card">
          <h3>Active Vehicles</h3>
          <p>{stats?.activeVehicles}</p>
        </div>
        <div className="stat-card">
          <h3>Drivers</h3>
          <p>{stats?.totalDrivers}</p>
        </div>
      </div>
    </div>
  );
}
```

### Example 6: GraphQL Complex Query

```typescript
// Using GraphQL for related data in one request
import GraphQLService from '../backend/services/GraphQLService';

async function getAssociationWithVehiclesAndDrivers(associationId: number) {
  const query = `
    query GetAssociationDetails($projectId: Int!, $associationId: Int!) {
      association: selectData(
        projectId: $projectId
        tableName: "associations"
        where: {id: $associationId}
      ) {
        rows
      }
      vehicles: selectData(
        projectId: $projectId
        tableName: "vehicles"
        where: {association_id: $associationId}
      ) {
        rows
      }
      drivers: selectData(
        projectId: $projectId
        tableName: "drivers"
        where: {association_id: $associationId}
      ) {
        rows
      }
    }
  `;

  const result = await GraphQLService.query(query, {
    projectId: 1,
    associationId,
  });

  return {
    association: result.association.rows[0],
    vehicles: result.vehicles.rows,
    drivers: result.drivers.rows,
  };
}

// Usage in component
const [data, setData] = useState<any>(null);

useEffect(() => {
  getAssociationWithVehiclesAndDrivers(1).then(setData);
}, []);
```

## Error Handling Pattern

```typescript
// utils/errorHandler.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: any): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  return error.message || 'An unexpected error occurred';
}

// Usage in component
try {
  await VehicleService.create(data);
} catch (error) {
  const message = handleApiError(error);
  toast.error(message);
}
```

## Complete App Structure Example

```
my-taxi-app/
├── src/
│   ├── backend/                    ← Generated by Skaftin
│   │   ├── config/
│   │   │   └── skaftin.config.ts
│   │   ├── schemas/
│   │   │   ├── index.ts
│   │   │   ├── Association.schema.ts
│   │   │   ├── Vehicle.schema.ts
│   │   │   └── Driver.schema.ts
│   │   ├── services/
│   │   │   ├── index.ts
│   │   │   ├── TableService.ts
│   │   │   ├── GraphQLService.ts
│   │   │   ├── AssociationService.ts
│   │   │   ├── VehicleService.ts
│   │   │   └── DriverService.ts
│   │   ├── types/
│   │   │   └── api.types.ts
│   │   └── utils/
│   │       ├── auth.ts
│   │       ├── request.ts
│   │       └── errorHandler.ts
│   ├── components/                 ← Your components
│   │   ├── AssociationsList.tsx
│   │   ├── VehicleDetails.tsx
│   │   └── Dashboard.tsx
│   ├── pages/                      ← Your pages
│   │   ├── HomePage.tsx
│   │   └── AssociationsPage.tsx
│   ├── App.tsx
│   └── main.tsx
├── .env                            ← Your credentials
├── .env.example                    ← Template for others
└── package.json
```

## Testing Your Integration

Create `src/backend/test.ts`:

```typescript
import AssociationService from './backend/services/AssociationService';
import VehicleService from './backend/services/VehicleService';

async function testIntegration() {
  console.log('🧪 Testing Skaftin integration...\n');

  try {
    // Test 1: List associations
    console.log('1️⃣ Testing: List associations');
    const associations = await AssociationService.findAll();
    console.log(`✅ Found ${associations.length} associations`);
    console.log('   Sample:', associations[0]?.name);

    // Test 2: Get vehicle by ID
    console.log('\n2️⃣ Testing: Get vehicle by ID');
    const vehicle = await VehicleService.findById(1);
    console.log('✅ Vehicle:', vehicle?.registration_number);

    // Test 3: Filter by status
    console.log('\n3️⃣ Testing: Filter active vehicles');
    const activeVehicles = await VehicleService.findActive();
    console.log(`✅ Found ${activeVehicles.length} active vehicles`);

    // Test 4: Count records
    console.log('\n4️⃣ Testing: Count vehicles');
    const count = await VehicleService.count();
    console.log(`✅ Total vehicles: ${count}`);

    console.log('\n🎉 All tests passed!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testIntegration();
```

Run with:
```bash
npx ts-node src/backend/test.ts
```

## Common Patterns

### Loading States

```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await Service.findAll();
    setState(data);
  } finally {
    setLoading(false);
  }
};
```

### Error States

```typescript
const [error, setError] = useState<string | null>(null);

const fetchData = async () => {
  try {
    setError(null);
    const data = await Service.findAll();
    setState(data);
  } catch (err: any) {
    setError(err.message);
  }
};

// In render
{error && <div className="error">{error}</div>}
```

### Optimistic Updates

```typescript
const handleUpdate = async (id: number, data: UpdateDto) => {
  // Update UI immediately
  setItems(items.map(item => 
    item.id === id ? { ...item, ...data } : item
  ));
  
  try {
    // Send to server
    await Service.update(id, data);
  } catch (error) {
    // Revert on error
    loadItems();
    alert('Update failed');
  }
};
```

### Pagination

```typescript
const [page, setPage] = useState(0);
const limit = 20;

const loadPage = async () => {
  const data = await Service.findAll({
    limit,
    offset: page * limit,
  });
  setItems(data);
};

// Buttons
<button onClick={() => setPage(p => p - 1)} disabled={page === 0}>
  Previous
</button>
<button onClick={() => setPage(p => p + 1)}>
  Next
</button>
```

## ⭐ NEW: Real-Time Updates with WebSocket

### Example 7: Real-Time List with Auto-Refresh

```typescript
// components/AssociationsList.tsx
import { useState, useEffect } from 'react';
import AssociationService from '../backend/services/AssociationService';
import { useAutoRefresh } from '../backend/hooks/useWebSocket';
import { Association } from '../backend/schemas/Association.schema';

export function AssociationsList() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get project ID from your config or context
  const projectId = 'your-project-id'; // Or from config/context

  const loadAssociations = async () => {
    try {
      setLoading(true);
      const data = await AssociationService.findAll();
      setAssociations(data);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssociations();
  }, []);

  // Auto-refresh when associations table changes
  useAutoRefresh(projectId, 'associations', loadAssociations);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Taxi Associations</h1>
      <ul>
        {associations.map((assoc) => (
          <li key={assoc.id}>
            <strong>{assoc.name}</strong> - {assoc.location}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 8: Manual Event Handling with Optimistic Updates

```typescript
// components/VehiclesList.tsx
import { useState, useEffect } from 'react';
import VehicleService from '../backend/services/VehicleService';
import { useDatabaseEvents } from '../backend/hooks/useWebSocket';
import { DatabaseEvent } from '../backend/services/WebSocketService';
import { Vehicle } from '../backend/schemas/Vehicle.schema';

export function VehiclesList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastEvent, setLastEvent] = useState<DatabaseEvent | null>(null);
  const projectId = 'your-project-id';

  const loadVehicles = async () => {
    const data = await VehicleService.findAll();
    setVehicles(data);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // Listen to vehicle table changes
  useDatabaseEvents(projectId, 'vehicles', (event) => {
    setLastEvent(event);
    
    // Handle different event types
    switch (event.type) {
      case 'insert':
        // Add new vehicle to list
        if (event.data) {
          setVehicles(prev => [...prev, event.data]);
        }
        break;
      
      case 'update':
        // Update vehicle in list
        if (event.data) {
          setVehicles(prev =>
            prev.map(v => v.id === event.data.id ? event.data : v)
          );
        }
        break;
      
      case 'delete':
        // Remove vehicle from list
        if (event.data?.id) {
          setVehicles(prev => prev.filter(v => v.id !== event.data.id));
        }
        break;
      
      default:
        // Refresh all data for other events
        loadVehicles();
    }
  });

  return (
    <div>
      <h1>Vehicles</h1>
      {lastEvent && (
        <div className="notification">
          Last update: {lastEvent.type} at {new Date(lastEvent.timestamp).toLocaleTimeString()}
        </div>
      )}
      <ul>
        {vehicles.map((vehicle) => (
          <li key={vehicle.id}>
            {vehicle.registration_number} - {vehicle.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 9: Connection Status Indicator

```typescript
// components/ConnectionStatus.tsx
import { useWebSocket } from '../backend/hooks/useWebSocket';

export function ConnectionStatus() {
  const { isConnected, reconnectAttempts, reconnect } = useWebSocket();

  if (isConnected) {
    return (
      <div className="connection-status connected">
        <span className="dot"></span>
        Connected
      </div>
    );
  }

  return (
    <div className="connection-status disconnected">
      <span className="dot"></span>
      Disconnected
      {reconnectAttempts > 0 && (
        <span> (Reconnecting... {reconnectAttempts})</span>
      )}
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

**See `08-WEBSOCKET-INTEGRATION.md` for complete WebSocket setup guide.**

## Next Steps

Your client app is now ready to use Skaftin as a backend! 🎉

For more advanced features:
- Read `01-OVERVIEW.md` again for architecture
- Review `02-AUTHENTICATION.md` for security
- Check `03-TYPE-GENERATION.md` for type updates
- See `04-SERVICE-GENERATION.md` for service patterns
- Explore `05-GRAPHQL-INTEGRATION.md` for GraphQL
- Integrate `08-WEBSOCKET-INTEGRATION.md` for real-time updates ⭐ NEW

