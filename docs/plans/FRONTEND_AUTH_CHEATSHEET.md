# Frontend Authentication Cheat Sheet 🚀

Quick reference for implementing authentication in Skaftin frontend.

## 🔑 The Golden Rule

**Always use `credentials: 'include'` in every fetch request!**

```typescript
fetch('/api/endpoint', {
  credentials: 'include' // 🔥 CRITICAL
});
```

---

## 📋 Quick Examples

### Login

```typescript
import AuthService from '@/services/AuthService';

const result = await AuthService.login('user@example.com', 'password123');

if (result.success) {
  navigate('/dashboard');
} else {
  setError(result.error);
}
```

### Register

```typescript
const result = await AuthService.register(
  'user@example.com',
  'SecurePass123!',
  'John Doe' // optional
);

if (result.success) {
  navigate('/dashboard');
}
```

### Logout

```typescript
await AuthService.logout();
navigate('/login');
```

### Check if Authenticated

```typescript
if (AuthService.isAuthenticated()) {
  // User is logged in (UX only)
}
```

---

## 🌐 API Requests

### Using RequestUtils (Recommended)

```typescript
import RequestUtils from '@/utils/RequestUtils';

// GET
const data = await RequestUtils.get<Project[]>('/api/projects');

// POST
const created = await RequestUtils.post<Project>(
  '/api/projects',
  null, // No token needed
  { name: 'My Project' }
);

// PUT
const updated = await RequestUtils.put<Project>(
  `/api/projects/${id}`,
  null,
  { name: 'Updated' }
);

// DELETE
await RequestUtils.delete(`/api/projects/${id}`);
```

### Using Fetch Directly

```typescript
const response = await fetch('/api/projects', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include' // 🔥 DON'T FORGET!
});

const data = await response.json();
```

---

## 🛡️ Protected Routes

```typescript
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

---

## 📡 API Endpoints

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | `{ email, password, full_name? }` | Register new user |
| `/api/auth/login` | POST | `{ email, password }` | Login |
| `/api/auth/logout` | POST | - | Logout |
| `/api/auth/verify` | POST | - | Verify session |

---

## 🎯 Common Patterns

### Login Form

```typescript
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await AuthService.login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}
```

### Logout Button

```typescript
function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await AuthService.logout();
    navigate('/login');
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

### Fetch Data

```typescript
function MyComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await RequestUtils.get('/api/projects');
        setData(result);
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return <div>{/* Render data */}</div>;
}
```

### Handle 401 Errors

```typescript
try {
  const data = await RequestUtils.get('/api/projects');
} catch (error: any) {
  if (error.status === 401) {
    AuthService.removeToken();
    navigate('/login');
  }
}
```

---

## ✅ DO's

✅ Use `credentials: 'include'` in all requests  
✅ Use `AuthService` for login/register/logout  
✅ Use `RequestUtils` or service classes for API calls  
✅ Handle errors gracefully  
✅ Clear localStorage on logout  
✅ Protect routes with `ProtectedRoute`  

---

## ❌ DON'Ts

❌ Don't send `Authorization` headers  
❌ Don't manually refresh tokens  
❌ Don't store passwords in localStorage  
❌ Don't trust localStorage for security  
❌ Don't forget `credentials: 'include'`  

---

## 🐛 Common Issues

### "Unauthorized" errors after login
**Fix:** Add `credentials: 'include'` to all fetch requests

### CORS errors
**Fix:** Use Vite proxy (already configured) or check backend CORS

### Session expired after refresh
**Fix:** Clear browser cookies and login again

### Multiple session cookies error
**Fix:** Clear all cookies for the domain

---

## 🔧 Imports You'll Need

```typescript
// Authentication
import AuthService from '@/services/AuthService';

// API Utilities
import RequestUtils from '@/utils/RequestUtils';

// Services
import ProjectsService from '@/services/ProjectsService';
import DatabaseService from '@/services/DatabaseService';

// Navigation
import { useNavigate } from 'react-router-dom';
```

---

## 📚 Full Documentation

For complete details, see:
- [Frontend Authentication Guide](./FRONTEND_AUTHENTICATION_GUIDE.md)
- [Auth System Implementation](./AUTH_SYSTEM_IMPLEMENTATION.md)
- [SuperTokens Integration](./SUPERTOKENS_INTEGRATION.md)

---

**Remember:** Authentication is cookie-based, not token-based!  
**The "token" in localStorage is just for UX, not security.**

🔥 **Always use `credentials: 'include'`!** 🔥

