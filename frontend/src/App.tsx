import { Routes, Route } from 'react-router-dom'
import SessionListPage from './pages/SessionListPage'
import SessionWorkspacePage from './pages/SessionWorkspacePage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/sessions/:sessionId" element={<SessionWorkspacePage />} />
      </Routes>
    </div>
  )
}
