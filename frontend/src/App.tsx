import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [backendMessage, setBackendMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [stats, setStats] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  const fetchBackendMessage = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:4006/')
      const message = await response.text()
      setBackendMessage(message)
    } catch (error) {
      setBackendMessage('Failed to connect to backend')
      console.error('Error fetching from backend:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('http://localhost:4006/health')
      const data = await response.json()
      setHealthStatus(data)
    } catch (error) {
      setHealthStatus({ status: 'unhealthy', database: 'disconnected' })
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:4006/api/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:4006/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  useEffect(() => {
    fetchBackendMessage()
    fetchHealthStatus()
    fetchStats()
    fetchUsers()
  }, [])

  return (
    <>
      <div className="header">
        <h1>🚀 Skaftin Platform</h1>
        <p>Full-Stack Application with PostgreSQL Database</p>
      </div>
      
      <div className="card">
        <h2>Frontend Counter</h2>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>

      <div className="card">
        <h2>Backend Connection</h2>
        <button onClick={fetchBackendMessage} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch from Backend'}
        </button>
        <p className="backend-message">
          <strong>Backend Response:</strong> {backendMessage}
        </p>
      </div>

      <div className="card">
        <h2>Database Health Status</h2>
        <button onClick={fetchHealthStatus}>
          Check Database Health
        </button>
        {healthStatus && (
          <div className={`health-status ${healthStatus.status}`}>
            <p><strong>Status:</strong> {healthStatus.status}</p>
            <p><strong>Database:</strong> {healthStatus.database}</p>
            {healthStatus.timestamp && (
              <p><strong>Timestamp:</strong> {new Date(healthStatus.timestamp).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Platform Statistics</h2>
        <button onClick={fetchStats}>
          Refresh Stats
        </button>
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-item">
              <h3>{stat.metric_name}</h3>
              <p>{stat.metric_value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Users</h2>
        <button onClick={fetchUsers}>
          Refresh Users
        </button>
        <div className="users-list">
          {users.map((user) => (
            <div key={user.id} className="user-item">
              <p><strong>{user.username}</strong> - {user.email}</p>
              <small>Joined: {new Date(user.created_at).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="info">
        <p>Frontend running on port 3006</p>
        <p>Backend running on port 4006</p>
        <p>PostgreSQL running on port 5450</p>
      </div>
    </>
  )
}

export default App
