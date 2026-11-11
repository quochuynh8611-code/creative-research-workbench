'use client'

import React from 'react'
import { TrizLensMetadataSection } from '@/features/triz/triz-lens-metadata-section'
import type { TrizPrinciple } from '@/lib/types'

export interface EverydayMetadataSectionProps {
  everydayTitle?: string | null
  dailyApplication?: string | null
  dailyExamples?: string[] | null
  actionPrompt?: string | null
  technicalTitle: string
  technicalDescription: string
  explanation?: string | null
  className?: string
  principleId: number | string
}

/**
 * EverydayMetadataSection — Thin adapter bao bọc TrizLensMetadataSection
 * với lăng kính 'everyday', bảo toàn tương thích ngược 100% cho luồng Ideation.
 */
export function EverydayMetadataSection({
  everydayTitle,
  dailyApplication,
  dailyExamples,
  actionPrompt,
  technicalTitle,
  technicalDescription,
  explanation,
  className,
  principleId,
}: EverydayMetadataSectionProps) {
  const pId = typeof principleId === 'number' ? principleId : Number(principleId) || 0

  const principle: TrizPrinciple = {
    id: pId,
    principle_id: pId,
    name_vi: technicalTitle,
    name_en: '',
    description: technicalDescription,
    explanation: explanation || undefined,
    everyday_title: everydayTitle || undefined,
    daily_application: dailyApplication || undefined,
    daily_examples: dailyExamples || undefined,
    action_prompt: actionPrompt || undefined,
  }

  return (
    <TrizLensMetadataSection
      lens="everyday"
      principle={principle}
      principleId={principleId}
      className={className}
    />
  )
}
