import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [backendMessage, setBackendMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [stats, setStats] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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
      setHealthStatus({ status: 'unhealthy', database: 'disconnected', minio: 'disconnected' })
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

  const fetchFiles = async () => {
    try {
      const response = await fetch('http://localhost:4006/api/files')
      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error('Error fetching files:', error)
    }
  }

  const handleFileUpload = async () => {
    if (!uploadFile) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', uploadFile)

    try {
      const response = await fetch('http://localhost:4006/api/upload', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.success) {
        alert(`File uploaded successfully: ${result.originalName}`)
        setUploadFile(null)
        fetchFiles() // Refresh file list
      } else {
        alert('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  useEffect(() => {
    fetchBackendMessage()
    fetchHealthStatus()
    fetchStats()
    fetchUsers()
    fetchFiles()
  }, [])

  return (
    <>
      <div className="header">
        <h1>🚀 Skaftin Platform</h1>
        <p>Full-Stack Application with PostgreSQL Database & MinIO File Storage</p>
      </div>

      <div className="card">
        <h2>Frontend Counter updated</h2>
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
        <h2>System Health Status</h2>
        <button onClick={fetchHealthStatus}>
          Check System Health
        </button>
        {healthStatus && (
          <div className={`health-status ${healthStatus.status}`}>
            <p><strong>Status:</strong> {healthStatus.status}</p>
            <p><strong>Database:</strong> {healthStatus.database}</p>
            <p><strong>MinIO:</strong> {healthStatus.minio}</p>
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

      <div className="card">
        <h2>File Storage (MinIO)</h2>
        <div className="file-upload">
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="file-input"
          />
          <button
            onClick={handleFileUpload}
            disabled={!uploadFile || uploading}
            className="upload-button"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        <div className="files-section">
          <button onClick={fetchFiles}>
            Refresh Files
          </button>
          <div className="files-list">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <p><strong>{file.name}</strong></p>
                  <p>Size: {formatFileSize(file.size)}</p>
                  <p>Modified: {new Date(file.lastModified).toLocaleString()}</p>
                </div>
                <div className="file-actions">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="download-link">
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="info">
        <p>Frontend running on port 3006</p>
        <p>Backend running on port 4006</p>
        <p>PostgreSQL running on port 5450</p>
        <p>MinIO API running on port 9000</p>
        <p>MinIO Console running on port 9001</p>
      </div>
    </>
  )
}

export default App
