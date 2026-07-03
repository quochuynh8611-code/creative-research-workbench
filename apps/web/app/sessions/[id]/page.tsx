import { SessionDetail } from '@/features/session/session-detail'

interface Props {
  params: { id: string }
}

export default function SessionDetailPage({ params }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <SessionDetail sessionId={params.id} />
    </div>
  )
}
