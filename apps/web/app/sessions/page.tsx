import { SessionList } from '@/features/session/session-list'

export default function SessionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <SessionList />
      </div>
    </div>
  )
}
