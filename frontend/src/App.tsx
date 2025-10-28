import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [backendMessage, setBackendMessage] = useState('')
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    fetchBackendMessage()
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

      <div className="info">
        <p>Frontend running on port 3006</p>
        <p>Backend running on port 4006</p>
      </div>
    </>
  )
}

export default App
