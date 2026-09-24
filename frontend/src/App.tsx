import { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('Connecting to Laravel...')

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/test')
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Failed to connect to Laravel'))
  }, [])

  return (
    <div>
      <h1>CHIS-SF</h1>
      <p>{message}</p>
    </div>
  )
}

export default App