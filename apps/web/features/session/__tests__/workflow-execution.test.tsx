/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionDetail } from '../session-detail'
import * as apiClient from '@/lib/api-client'
import type { ResearchSession } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getSession: jest.fn(),
  listSessions: jest.fn(),
  getTrizParameters: jest.fn(),
  lookupTrizMatrix: jest.fn(),
  createProblemFrame: jest.fn(),
  nextStep: jest.fn(),
  runSessionWorkflow: jest.fn(),
  getEmbeddingStatus: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

const MOCK_SESSION: ResearchSession = {
  id: 'ses-workflow-123',
  title: 'Tối ưu hóa hệ thống pin xe điện',
  description: 'Tăng dung lượng pin nhưng không làm tăng trọng lượng xe',
  domain: 'technical',
  status: 'active',
  workflow_state: 'structuring',
  tags: ['battery', 'ev', 'triz'],
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
  problem_frame: {
    id: 'frame-123',
    session_id: 'ses-workflow-123',
    raw_statement: 'Tăng dung lượng pin nhưng không làm tăng trọng lượng xe',
    normalized_statement: 'Cải thiện công suất trong khi hạn chế trọng lượng',
    contradiction_type: 'technical',
    improving_parameter: 'Độ bền / Độ cứng',
    worsening_parameter: 'Trọng lượng vật thể',
    domain: 'technical',
    created_at: '2026-03-20T10:05:00Z',
  },
}

const MOCK_WORKFLOW_RESPONSE = {
  session_id: 'ses-workflow-123',
  status: 'success',
  total_duration_ms: 125,
  steps: [
    { step: 'ingest', status: 'completed', duration_ms: 20, details: { documents_count: 10 } },
    { step: 'embed', status: 'completed', duration_ms: 35, details: { model: 'ollama', dimension: 1536 } },
    { step: 'retrieve', status: 'completed', duration_ms: 40, details: { results_count: 5 } },
    { step: 'recommend_principles', status: 'completed', duration_ms: 30, details: { principles_count: 3 } },
  ],
  principles: [
    {
      id: 1,
      principle_id: 1,
      title: 'Phân đoạn (Segmentation)',
      name_vi: 'Phân đoạn',
      name_en: 'Segmentation',
      description: 'Chia nhỏ đối tượng thành các phần độc lập.',
      explanation: 'Tạo cấu trúc pin dạng mô-đun phân tán.',
    },
    {
      id: 35,
      principle_id: 35,
      title: 'Chuyển đổi thông số (Parameter changes)',
      name_vi: 'Chuyển đổi thông số',
      name_en: 'Parameter changes',
      description: 'Thay đổi trạng thái vật lý, nồng độ hoặc độ dẻo.',
      explanation: 'Sử dụng điện giải thể rắn.',
    },
  ],
}

describe('Session Workflow Execution (Batch C21)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    jest.clearAllMocks()
    ;(apiClient.getSession as jest.Mock).mockResolvedValue(MOCK_SESSION)
    ;(apiClient.getTrizParameters as jest.Mock).mockResolvedValue({ data: [] })
    ;(apiClient.runSessionWorkflow as jest.Mock).mockResolvedValue(MOCK_WORKFLOW_RESPONSE)
    ;(apiClient.getEmbeddingStatus as jest.Mock).mockResolvedValue({
      total_documents: 10,
      embedded_documents: 10,
      model: 'ollama',
      provider: 'ollama',
      progress_text: '10/10 documents embedded',
    })
  })

  test('GIVEN session WHEN user clicks "Run Full Workflow" THEN executes pipeline and shows step progress and recommended principles', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SessionDetail sessionId="ses-workflow-123" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa hệ thống pin xe điện')).toBeInTheDocument()
    })

    // Find and click the "Run Full Workflow" button
    const runWorkflowBtn = await screen.findByRole('button', { name: /run full workflow|chạy toàn bộ quy trình/i })
    expect(runWorkflowBtn).toBeInTheDocument()
    fireEvent.click(runWorkflowBtn)

    // Verify runSessionWorkflow is called
    await waitFor(() => {
      expect(apiClient.runSessionWorkflow).toHaveBeenCalledWith('ses-workflow-123')
    })

    // Verify step progress is shown in UI
    await waitFor(() => {
      expect(screen.getByTestId('workflow-step-ingest')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-step-embed')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-step-retrieve')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-step-recommend_principles')).toBeInTheDocument()
    })

    // Verify recommended TRIZ principles are displayed in final output
    await waitFor(() => {
      expect(screen.getByText(/Phân đoạn/i)).toBeInTheDocument()
      expect(screen.getByText(/Chuyển đổi thông số/i)).toBeInTheDocument()
    })
  })
})
