import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = { status: string }

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<HealthResponse>
      })
      .then((data) => {
        if (!cancelled) setHealth(data)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Request failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Transcript App</h1>
        <p className="tagline">Speaker-attributed transcripts from audio</p>
      </header>

      <section className="panel" aria-live="polite">
        <h2>API status</h2>
        {health && (
          <p>
            Backend: <code className="ok">{health.status}</code>
          </p>
        )}
        {error && (
          <p className="err" role="alert">
            Cannot reach API ({error}). Start the backend:{' '}
            <code>cd backend && uv run uvicorn app.main:app --reload</code>
          </p>
        )}
        {!health && !error && <p className="muted">Checking…</p>}
        <p className="muted">
          <a href="/api/health" target="_blank" rel="noreferrer">
            /api/health
          </a>
          {' · '}
          <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
            OpenAPI docs
          </a>
        </p>
      </section>
    </div>
  )
}

export default App
