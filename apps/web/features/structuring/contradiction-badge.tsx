'use client'

import React from 'react'
import { AlertCircle, Zap, CheckCircle2, HelpCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContradictionType } from '@/lib/types'

interface ContradictionBadgeProps {
  type: ContradictionType | string
  improvingParameter?: string | null
  worseningParameter?: string | null
  className?: string
}

export function ContradictionBadge({
  type,
  improvingParameter,
  worseningParameter,
  className,
}: ContradictionBadgeProps) {
  const normalizedType = (type || 'none').toLowerCase()

  const getBadgeConfig = () => {
    switch (normalizedType) {
      case 'technical':
        return {
          label: 'Mâu thuẫn kỹ thuật (Technical Contradiction)',
          badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
          icon: Zap,
        }
      case 'physical':
        return {
          label: 'Mâu thuẫn vật lý (Physical Contradiction)',
          badgeClass: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
          icon: AlertCircle,
        }
      case 'none':
        return {
          label: 'Không có mâu thuẫn (None)',
          badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
          icon: CheckCircle2,
        }
      default:
        return {
          label: 'Chưa xác định mâu thuẫn (Unknown)',
          badgeClass: 'bg-muted text-muted-foreground border-border',
          icon: HelpCircle,
        }
    }
  }

  const { label, badgeClass, icon: Icon } = getBadgeConfig()

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border',
          badgeClass
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>

      {(improvingParameter || worseningParameter) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {improvingParameter && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 mt-0.5">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">
                  Thông số cải thiện (Improving Parameter)
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {improvingParameter}
                </span>
              </div>
            </div>
          )}

          {worseningParameter && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
              <div className="p-1 rounded-md bg-rose-500/10 text-rose-500 mt-0.5">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">
                  Thông số suy giảm (Worsening Parameter)
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {worseningParameter}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
