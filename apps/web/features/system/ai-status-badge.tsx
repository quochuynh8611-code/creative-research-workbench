'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Bot, AlertTriangle, Loader2 } from 'lucide-react'
import { getAIStatus } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { AIStatusData } from '@/lib/types'

export interface AIStatusBadgeProps {
  className?: string
  retry?: number | boolean
}

export function AIStatusBadge({ className, retry }: AIStatusBadgeProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-status'],
    queryFn: typeof getAIStatus === 'function'
      ? getAIStatus
      : async () => ({
          data: {
            status: 'mock' as const,
            status_label: 'Mock mode',
            llm: { provider: 'mock', model: 'mock-model', is_real: false, healthy: true },
            embedding: { provider: 'mock', model: 'mock-embedding', is_real: false, healthy: true },
            fallback_active: false,
          },
        }),
    staleTime: 60_000,
    retry: retry !== undefined ? retry : (process.env.NODE_ENV === 'test' ? false : 1),
  })

  const aiData: AIStatusData | undefined = data?.data

  if (isLoading) {
    return (
      <div
        data-testid="ai-status-badge-loading"
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-muted/60 text-muted-foreground border-border/50 animate-pulse',
          className
        )}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Kiểm tra AI...</span>
      </div>
    )
  }

  const status = isError || !aiData ? 'unavailable' : aiData.status

  let label = 'AI tạm thời không khả dụng'
  let colorClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
  let IconComponent = AlertTriangle

  if (status === 'ready') {
    label = 'AI thực tế'
    colorClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    IconComponent = Sparkles
  } else if (status === 'mock') {
    label = 'Mock mode'
    colorClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
    IconComponent = Bot
  }

  const tooltipText = aiData
    ? `LLM: ${aiData.llm.provider} (${aiData.llm.model}) | Embedding: ${aiData.embedding.provider} (${aiData.embedding.model})`
    : 'Không kết nối được dịch vụ AI status'

  return (
    <div
      data-testid="ai-status-badge"
      title={tooltipText}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-help select-none',
        colorClasses,
        className
      )}
    >
      <IconComponent className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </div>
  )
}
