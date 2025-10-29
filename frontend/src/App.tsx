import { useState, useEffect } from 'react'
import './App.css'

interface User {
  id: number
  username: string
  email: string
  full_name: string | null
  created_at: string
}

function App() {
  const [count, setCount] = useState(0)
  const [backendMessage, setBackendMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', full_name: '' })

  const apiUrl = import.meta.env.VITE_API_URL || 'http://coolify.bobosoftware.co.za:4006'

  const fetchBackendMessage = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}/`)
      const message = await response.text()
      setBackendMessage(message)
    } catch (error) {
      setBackendMessage('Failed to connect to backend')
      console.error('Error fetching from backend:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/users`)
      const data = await response.json()
      if (data.status === 'success') {
        setUsers(data.data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const createUser = async () => {
    if (!newUser.username || !newUser.email) {
      alert('Username and email are required')
      return
    }

    setUsersLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })

      const data = await response.json()
      if (data.status === 'success') {
        setNewUser({ username: '', email: '', full_name: '' })
        fetchUsers()
      } else {
        alert(data.message || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Failed to create user')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    fetchBackendMessage()
    fetchUsers()
  }, [])

  return (
    <>
      <div className="header">
        <h1>🚀 Skaftin Platform</h1>
        <p>Frontend + Backend Integration</p>
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
        <h2>Users List</h2>
        <button onClick={fetchUsers} disabled={usersLoading} style={{ marginBottom: '1rem' }}>
          {usersLoading ? 'Loading...' : 'Refresh Users'}
        </button>

        {usersLoading && users.length === 0 ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found</p>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Username</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Full Name</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>{user.id}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>{user.username}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>{user.email}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>{user.full_name || '-'}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Create New User</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #646cff' }}
          />
          <input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #646cff' }}
          />
          <input
            type="text"
            placeholder="Full Name (optional)"
            value={newUser.full_name}
            onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #646cff' }}
          />
          <button onClick={createUser} disabled={usersLoading} style={{ marginTop: '0.5rem' }}>
            {usersLoading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>

      <div className="info">
        <p>Frontend running on port 3006</p>
        <p>Backend running on port 4006</p>
      </div>
    </>
  )
}

export default App
