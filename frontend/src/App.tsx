import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectsOverviewPage from './pages/user/projects/ProjectsOverviewPage';
import ProjectDashboardPage from './pages/user/dashboard/ProjectDashboardPage';
import { useAppStore } from './stores/StoresIndex';
import { initSuperTokensFrontend, Session } from './config/supertokens';
import './App.css';

// Initialize SuperTokens
initSuperTokensFrontend();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, isLoading } = useAppStore();
  
  console.log('🛡️ [PROTECTED ROUTE] Checking access:', {
    isLoading,
    hasUser: !!user,
    userId: user?.id || 'none',
    userEmail: user?.email || 'none',
  });
  
  // Wait for session check to complete before redirecting
  if (isLoading) {
    console.log('⏳ [PROTECTED ROUTE] Still loading session, showing loader...');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }
  
  if (!user) {
    console.log('❌ [PROTECTED ROUTE] No user found - redirecting to /login');
    console.log('   This means either:');
    console.log('   1. Session check failed');
    console.log('   2. No session exists');
    console.log('   3. /api/users/me returned error');
    return <Navigate to="/login" replace />;
  }
  
  console.log('✅ [PROTECTED ROUTE] User authenticated, allowing access');
  return children;
};

function App() {
  const { setUser, setLoading } = useAppStore();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      console.log('\n🔐 [SESSION CHECK] Starting session verification on page load/refresh...');
      console.log('==================================================================');
      
      // Log current cookies
      console.log('🍪 [SESSION CHECK] Current cookies in browser:');
      const cookies = document.cookie.split(';').map(c => c.trim());
      if (cookies.length === 0 || (cookies.length === 1 && cookies[0] === '')) {
        console.log('   ❌ No cookies found!');
      } else {
        cookies.forEach(cookie => {
          const [name] = cookie.split('=');
          const isSuperTokensCookie = name.startsWith('s') && 
            (name.includes('Access') || name.includes('Refresh') || name.includes('Front'));
          console.log(`   ${isSuperTokensCookie ? '✓' : ' '} ${name}`);
        });
      }
      
      try {
        setLoading(true);
        console.log('⏳ [SESSION CHECK] Setting loading state to true');
        
        // Step 1: Check if SuperTokens session exists
        console.log('📋 [SESSION CHECK] Step 1: Checking if SuperTokens session exists...');
        const sessionExists = await Session.doesSessionExist();
        console.log(`📋 [SESSION CHECK] SuperTokens session exists: ${sessionExists}`);
        
        if (sessionExists) {
          console.log('✅ [SESSION CHECK] Session found! Fetching user data from /api/users/me...');
          
          // Step 2: Fetch user data
          console.log('📡 [SESSION CHECK] Step 2: Making request to /api/users/me');
          const response = await fetch('/api/users/me', {
            credentials: 'include',
          });
          
          console.log('📡 [SESSION CHECK] Response received:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText,
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('📦 [SESSION CHECK] Response data:', data);
            
            if (data.success && data.data) {
              console.log('✅ [SESSION CHECK] User data valid, setting user in store:', {
                id: data.data.user.id,
                email: data.data.user.email,
                name: data.data.user.name,
              });
              setUser(data.data.user);
              console.log('✅ [SESSION CHECK] User set successfully! User should stay logged in.');
            } else {
              console.log('❌ [SESSION CHECK] Response missing user data:', {
                success: data.success,
                hasData: !!data.data,
              });
              console.log('   → User will NOT be set, will redirect to login');
            }
          } else {
            console.log(`❌ [SESSION CHECK] /api/users/me failed with status ${response.status}`);
            console.log('   → User will NOT be set, will redirect to login');
            
            // Try to get error details
            try {
              const errorData = await response.json();
              console.log('   Error details:', errorData);
            } catch (e) {
              console.log('   Could not parse error response');
            }
          }
        } else {
          console.log('❌ [SESSION CHECK] No SuperTokens session found');
          console.log('   This means:');
          console.log('   1. User never logged in, OR');
          console.log('   2. Session expired, OR');
          console.log('   3. Cookies were cleared');
          console.log('   → User will redirect to login');
        }
      } catch (error) {
        console.error('💥 [SESSION CHECK] Error during session check:', error);
        console.error('   → User will redirect to login due to error');
      } finally {
        setLoading(false);
        console.log('⏳ [SESSION CHECK] Setting loading state to false');
        console.log('==================================================================');
        console.log('🔐 [SESSION CHECK] Session check complete\n');
      }
    };

    checkSession();
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/projects" 
          element={
            <ProtectedRoute>
              <ProjectsOverviewPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:projectId/*" 
          element={
            <ProtectedRoute>
              <ProjectDashboardPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
