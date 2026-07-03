import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SessionListPage() {
  const navigate = useNavigate()
  const [sessions] = useState([])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Creative Research Workbench</h1>
          <p className="text-gray-500 mt-1">Research sessions của bạn</p>
        </div>
        <button
          className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition"
          onClick={() => alert('TODO: create session modal')}
        >
          + Tạo session mới
        </button>
      </header>

      {sessions.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">Chưa có research session nào.</p>
          <p className="mt-2 text-sm">Tạo session đầu tiên để bắt đầu nghiên cứu.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* session cards */}
        </div>
      )}
    </div>
  )
}
