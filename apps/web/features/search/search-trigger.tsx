'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchTriggerProps {
  onClick?: () => void
  className?: string
}

export function SearchTrigger({ onClick, className }: SearchTriggerProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      // Trigger Cmd+K synthetic event if no custom click handler provided
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        })
      )
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-input bg-background/80 text-muted-foreground text-xs hover:text-foreground hover:border-primary/40 hover:bg-accent/40 transition-all shadow-sm',
        className
      )}
    >
      <Search className="w-3.5 h-3.5" />
      <span>Tìm kiếm tri thức...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-muted-foreground border border-border">
        ⌘K
      </kbd>
    </button>
  )
}
