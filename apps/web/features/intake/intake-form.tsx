'use client'

import { useState } from 'react'
import { Plus, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProblemFrameDraft {
  goal: string
  constraints: string[]
  affected_entities: string[]
  failure_signals: string[]
  success_criteria: string[]
}

function TagInput({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string
  items: string[]
  onAdd: (val: string) => void
  onRemove: (idx: number) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input.trim())
      setInput('')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full"
            >
              {item}
              <button onClick={() => onRemove(idx)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  sessionId: string
}

export function IntakeForm({ sessionId }: Props) {
  const [form, setForm] = useState<ProblemFrameDraft>({
    goal: '',
    constraints: [],
    affected_entities: [],
    failure_signals: [],
    success_criteria: [],
  })
  const [saved, setSaved] = useState(false)

  const addItem = (field: keyof Omit<ProblemFrameDraft, 'goal'>) => (val: string) =>
    setForm((f) => ({ ...f, [field]: [...f[field], val] }))

  const removeItem = (field: keyof Omit<ProblemFrameDraft, 'goal'>) => (idx: number) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))

  const handleSubmit = () => {
    // TODO: call API POST /sessions/{id}/problem-frame
    console.log('ProblemFrame draft:', { session_id: sessionId, ...form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isValid = form.goal.trim().length > 10

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Problem Intake</h2>
        <p className="text-sm text-muted-foreground">
          Mô tả vấn đề theo cấu trúc để hệ thống có thể phân tích chính xác hơn.
        </p>
      </div>

      {/* Goal */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Mục tiêu <span className="text-destructive">*</span>
        </label>
        <textarea
          value={form.goal}
          onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
          placeholder="Bạn muốn đạt được điều gì? Ví dụ: Giảm thời gian giao hàng xuống 30% trong Q3..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">{form.goal.length} ký tự</p>
      </div>

      <TagInput
        label="Ràng buộc"
        items={form.constraints}
        onAdd={addItem('constraints')}
        onRemove={removeItem('constraints')}
        placeholder="Ví dụ: Ngân sách tối đa 50 triệu"
      />

      <TagInput
        label="Đối tượng bị tác động"
        items={form.affected_entities}
        onAdd={addItem('affected_entities')}
        onRemove={removeItem('affected_entities')}
        placeholder="Ví dụ: Đội kho hàng, khách hàng bệnh viện"
      />

      <TagInput
        label="Tín hiệu thất bại"
        items={form.failure_signals}
        onAdd={addItem('failure_signals')}
        onRemove={removeItem('failure_signals')}
        placeholder="Ví dụ: Khiếu nại giao hàng trễ tăng 20%"
      />

      <TagInput
        label="Tiêu chí thành công"
        items={form.success_criteria}
        onAdd={addItem('success_criteria')}
        onRemove={removeItem('success_criteria')}
        placeholder="Ví dụ: Lead time < 48 giờ"
      />

      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className={cn(
          'inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all',
          isValid
            ? 'bg-primary text-primary-foreground hover:opacity-90'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {saved ? '✓ Đã lưu!' : 'Lưu và chuyển sang Phân tích cấu trúc'}
        {!saved && <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  )
}
