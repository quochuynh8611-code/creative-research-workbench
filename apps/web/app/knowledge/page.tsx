import React from 'react'
import { KnowledgeView } from '@/features/knowledge/knowledge-view'

export const metadata = {
  title: 'Cơ sở Tri thức | Creative Research Workbench',
  description: 'Quản lý tài liệu nguồn, tài liệu chuẩn tắc và phân rã chunks trong Creative Research Workbench',
}

export default function KnowledgePage(): React.ReactElement {
  return <KnowledgeView />
}
