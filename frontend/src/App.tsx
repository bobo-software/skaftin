import { useState, useEffect } from 'react'
import './App.css'

interface User {
  id: number
  username: string
  email: string
  full_name: string | null
  created_at: string
}

interface FileItem {
  name: string
  size: number
  lastModified: string
}

function App() {
  const [count, setCount] = useState(0)
  const [backendMessage, setBackendMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', email: '', full_name: '' })
  const [files, setFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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

  const fetchFiles = async () => {
    setFilesLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/files`)
      const data = await response.json()
      if (data.status === 'success') {
        setFiles(data.data)
      }
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setFilesLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (!uploadFile) {
      alert('Please select a file')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      const response = await fetch(`${apiUrl}/api/files/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.status === 'success') {
        setUploadFile(null)
        fetchFiles()
        alert('File uploaded successfully!')
      } else {
        alert(data.message || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleFileDelete = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
      return
    }

    setFilesLoading(true)
    try {
      const response = await fetch(`${apiUrl}/api/files/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.status === 'success') {
        fetchFiles()
      } else {
        alert(data.message || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file')
    } finally {
      setFilesLoading(false)
    }
  }

  const handleFileDownload = (fileName: string) => {
    window.open(`${apiUrl}/api/files/${encodeURIComponent(fileName)}`, '_blank')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  useEffect(() => {
    fetchBackendMessage()
    fetchUsers()
    fetchFiles()
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

      <div className="card">
        <h2>File Storage (MinIO)</h2>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              style={{ padding: '0.5rem' }}
            />
            <button onClick={handleFileUpload} disabled={uploading || !uploadFile}>
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          <button onClick={fetchFiles} disabled={filesLoading} style={{ marginBottom: '1rem' }}>
            {filesLoading ? 'Loading...' : 'Refresh Files'}
          </button>

          {filesLoading && files.length === 0 ? (
            <p>Loading files...</p>
          ) : files.length === 0 ? (
            <p>No files found</p>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>File Name</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Size</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Last Modified</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #646cff' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.name}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>{file.name}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>{formatFileSize(file.size)}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                        {new Date(file.lastModified).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                        <button
                          onClick={() => handleFileDownload(file.name)}
                          style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleFileDelete(file.name)}
                          style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ff4444' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
