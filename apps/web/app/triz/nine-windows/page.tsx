import React from 'react'
import type { Metadata } from 'next'
import { TrizNineWindows } from '@/features/triz/triz-nine-windows'

export const metadata: Metadata = {
  title: 'Sơ đồ 9 Màn hình TRIZ | Creative Research Workbench',
  description: 'Khung tư duy đa chiều TRIZ 9-Windows System Operator',
}

export default function TrizNineWindowsPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <TrizNineWindows />
      </div>
    </main>
  )
}
