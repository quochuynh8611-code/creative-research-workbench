import React from 'react'
import { AnalyticsDashboard } from '@/features/analytics/analytics-dashboard'

export default function AnalyticsPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <AnalyticsDashboard />
    </div>
  )
}
