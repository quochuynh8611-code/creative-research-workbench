'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Brain, Clock } from 'lucide-react'
import type { ResearchSession } from '@/lib/types'
import { DOMAIN_LABELS, STATUS_LABELS, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Mock data — replace with useQuery when API is ready
const MOCK_SESSIONS: ResearchSession[] = [
  {
    id: '1',
    title: 'Tối ưu thời gian giao hàng thiết bị y tế',
    problem_statement: 'Thời gian giao hàng quá dài do quy trình kho chưa tối ưu.',
    domain: 'business',
    status: 'active',
    current_stage: 'structuring',
    tags: ['logistics', 'medical'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-accent text-accent-foreground',
  archived: 'bg-secondary text-secondary-foreground',
}

export function SessionList() {
  const [search, setSearch] = useState('')

  const filtered = MOCK_SESSIONS.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Research Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {MOCK_SESSIONS.length} sessions
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Tạo session mới
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm session theo tên..."
          className="w-full pl-9 pr-4 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Chưa có session nào</p>
          <p className="text-sm mt-1">Tạo session đầu tiên để bắt đầu nghiên cứu</p>
        </div>
      )}

      {/* Session cards */}
      <div className="space-y-3">
        {filtered.map((session) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="block bg-card border border-border rounded-lg p-5 hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{session.title}</h3>
                {session.problem_statement && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {session.problem_statement}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[session.status])}>
                    {STATUS_LABELS[session.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {DOMAIN_LABELS[session.domain]}
                  </span>
                  {session.tags.map((tag) => (
                    <span key={tag} className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                {formatDate(session.updated_at)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
