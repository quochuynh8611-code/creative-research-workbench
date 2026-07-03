import { useParams } from 'react-router-dom'

const STAGES = ['intake', 'structuring', 'retrieval', 'ideation', 'evaluation', 'synthesis']

export default function SessionWorkspacePage() {
  const { sessionId } = useParams()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar — stages */}
      <aside className="w-52 border-r bg-white flex flex-col py-6 px-3 gap-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Workflow</p>
        {STAGES.map((stage) => (
          <button
            key={stage}
            className="text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-700 transition capitalize"
          >
            {stage}
          </button>
        ))}
      </aside>

      {/* Center canvas */}
      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Session: {sessionId}</h2>
        <p className="text-gray-500">TODO: problem framing canvas — Phase 5</p>
      </main>

      {/* Right evidence panel */}
      <aside className="w-72 border-l bg-white overflow-y-auto p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Nguồn tài liệu</p>
        <p className="text-sm text-gray-400">Chưa có kết quả retrieval.</p>
      </aside>
    </div>
  )
}
