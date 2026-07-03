'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Brain } from 'lucide-react'
import { STAGE_LABELS, WORKFLOW_STAGES } from '@/lib/utils'
import { IntakeForm } from '@/features/intake/intake-form'

const TABS = [
  { id: 'intake', label: 'Nhập vấn đề' },
  { id: 'structuring', label: 'Phân tích' },
  { id: 'retrieval', label: 'Tài liệu' },
  { id: 'ideation', label: 'Ý tưởng' },
  { id: 'notebook', label: 'Notebook' },
]

interface Props {
  sessionId: string
}

export function SessionDetail({ sessionId }: Props) {
  const [activeTab, setActiveTab] = useState('intake')
  const currentStage = 'intake'

  const stageIndex = WORKFLOW_STAGES.indexOf(currentStage as any)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách
      </Link>

      {/* Session header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tối ưu thời gian giao hàng thiết bị y tế</h1>
        <p className="text-sm text-muted-foreground mt-1">Session #{sessionId} · Kinh doanh</p>
      </div>

      {/* Workflow progress */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {WORKFLOW_STAGES.map((stage, idx) => (
          <div key={stage} className="flex items-center gap-2 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                idx < stageIndex
                  ? 'bg-primary text-primary-foreground'
                  : idx === stageIndex
                  ? 'bg-accent text-accent-foreground border border-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span>{idx + 1}</span>
              <span>{STAGE_LABELS[stage]}</span>
            </div>
            {idx < WORKFLOW_STAGES.length - 1 && (
              <div className={`h-px w-4 shrink-0 ${idx < stageIndex ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'intake' && <IntakeForm sessionId={sessionId} />}
        {activeTab === 'structuring' && (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Hoàn thành Problem Intake trước để phân tích cấu trúc</p>
          </div>
        )}
        {activeTab === 'retrieval' && (
          <div className="text-center py-16 text-muted-foreground">
            <p>Knowledge Retrieval — coming in Phase 2</p>
          </div>
        )}
        {activeTab === 'ideation' && (
          <div className="text-center py-16 text-muted-foreground">
            <p>Idea Studio — coming in Phase 4</p>
          </div>
        )}
        {activeTab === 'notebook' && (
          <div className="text-center py-16 text-muted-foreground">
            <p>Research Notebook — coming in Phase 5</p>
          </div>
        )}
      </div>
    </div>
  )
}
