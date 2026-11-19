/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionDetail } from '../session-detail'
import * as apiClient from '@/lib/api-client'
import type { ResearchSession, SessionExportSnapshot } from '@/lib/types'

// Mock client layer to ensure pure isolated integration without real backend network calls
jest.mock('@/lib/api-client', () => ({
  getSession: jest.fn(),
  getSessionRecommendations: jest.fn(),
  exportSessionMarkdown: jest.fn(),
  exportSessionJson: jest.fn(),
  generateAIResearchReport: jest.fn(),
  runSessionWorkflow: jest.fn(),
  listResearchNotes: jest.fn(),
  listCandidateSolutions: jest.fn(),
  getWorkflowProfiles: jest.fn(),
  getEmbeddingStatus: jest.fn(),
}))

const mockedGetSession = apiClient.getSession as jest.MockedFunction<typeof apiClient.getSession>
const mockedGetSessionRecommendations = apiClient.getSessionRecommendations as jest.MockedFunction<typeof apiClient.getSessionRecommendations>
const mockedExportSessionMarkdown = apiClient.exportSessionMarkdown as jest.MockedFunction<typeof apiClient.exportSessionMarkdown>
const mockedExportSessionJson = apiClient.exportSessionJson as jest.MockedFunction<typeof apiClient.exportSessionJson>
const mockedListResearchNotes = apiClient.listResearchNotes as jest.MockedFunction<typeof apiClient.listResearchNotes>
const mockedListCandidateSolutions = apiClient.listCandidateSolutions as jest.MockedFunction<typeof apiClient.listCandidateSolutions>
const mockedGetWorkflowProfiles = apiClient.getWorkflowProfiles as jest.MockedFunction<typeof apiClient.getWorkflowProfiles>
const mockedGetEmbeddingStatus = apiClient.getEmbeddingStatus as jest.MockedFunction<typeof apiClient.getEmbeddingStatus>

const MOCK_SESSION: ResearchSession = {
  id: 'session-c36-e2e',
  title: 'Hệ thống năng lượng sinh học vi tảo',
  description: 'Tối ưu hóa khả năng quang hợp và thu hồi sinh khối',
  domain: 'sustainability',
  status: 'active',
  workflow_state: 'ideation',
  tags: ['microalgae', 'bio-energy', 'sustainability'],
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T09:30:00Z',
  problem_frame: {
    id: 'frame-1',
    session_id: 'session-c36-e2e',
    raw_statement: 'Tăng diện tích chiếu sáng mà không làm tăng kích thước bể nuôi cấy',
    contradiction_type: 'technical',
    improving_parameter: 'Hiệu suất quang hợp',
    worsening_parameter: 'Kích thước hệ thống',
    domain: 'sustainability',
  },
}

const MOCK_EXPORT_SNAPSHOT = {
  session: {
    id: 'session-c36-e2e',
    title: 'Hệ thống năng lượng sinh học vi tảo',
    description: 'Tối ưu hóa khả năng quang hợp và thu hồi sinh khối',
    domain: 'sustainability',
    status: 'active',
    workflow_state: 'ideation',
    tags: ['microalgae', 'bio-energy', 'sustainability'],
    created_at: '2026-11-19T08:00:00Z',
    updated_at: '2026-11-19T09:30:00Z',
  },
  problem_frame: {
    id: 'frame-1',
    session_id: 'session-c36-e2e',
    raw_statement: 'Tăng diện tích chiếu sáng mà không làm tăng kích thước bể nuôi cấy',
    contradiction_type: 'technical',
    improving_parameter: 'Hiệu suất quang hợp',
    worsening_parameter: 'Kích thước hệ thống',
  },
  recommended_methods: [],
  research_notes: [
    {
      id: 'note-1',
      session_id: 'session-c36-e2e',
      content: 'Phân tích vùng xung đột bề mặt quang sinh',
      note_type: 'insight' as const,
      source_context: {
        source_type: 'triz_ariz' as const,
        step_id: 2,
        step_title: 'Phân tích vùng xung đột',
      },
      created_at: '2026-11-19T08:30:00Z',
    },
  ],
  candidate_solutions: [],
} as unknown as SessionExportSnapshot

describe('Batch C36 PR 3 — Frontend E2E Export Roundtrip Integration', () => {
  let queryClient: QueryClient
  let originalCreateObjectURL: typeof window.URL.createObjectURL
  let originalRevokeObjectURL: typeof window.URL.revokeObjectURL
  let mockClick: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    // Setup base mocks
    mockedGetSession.mockResolvedValue(MOCK_SESSION)
    mockedGetSessionRecommendations.mockResolvedValue([])
    mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedListCandidateSolutions.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedGetWorkflowProfiles.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedGetEmbeddingStatus.mockResolvedValue({
      total_documents: 1,
      embedded_documents: 1,
      total_chunks: 10,
      embedded_chunks: 10,
      provider: 'mock',
      model: 'mock',
      progress_text: 'Sẵn sàng',
    })

    // Mock URL object methods
    originalCreateObjectURL = window.URL.createObjectURL
    originalRevokeObjectURL = window.URL.revokeObjectURL
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url-c36')
    window.URL.revokeObjectURL = jest.fn()

    // Spy on anchor click
    mockClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
    mockClick.mockRestore()
  })

  function renderComponent() {
    return render(
      <QueryClientProvider client={queryClient}>
        <SessionDetail sessionId="session-c36-e2e" />
      </QueryClientProvider>
    )
  }

  it('1. test_export_markdown_triggers_blob_download: gọi exportSessionMarkdown và trigger tải file .md', async () => {
    const mockBlob = new Blob(['# Tối ưu hóa vi tảo\nLĩnh vực: sustainability'], { type: 'text/markdown' })
    mockedExportSessionMarkdown.mockResolvedValue(mockBlob)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Hệ thống năng lượng sinh học vi tảo')).toBeInTheDocument()
    })

    // Mở menu Xuất dữ liệu
    const exportMenuBtn = screen.getByRole('button', { name: /xuất dữ liệu/i })
    fireEvent.click(exportMenuBtn)

    // Click Xuất Markdown (.md)
    const exportMdBtn = screen.getByText(/xuất markdown \(\.md\)/i)
    fireEvent.click(exportMdBtn)

    await waitFor(() => {
      expect(mockedExportSessionMarkdown).toHaveBeenCalledWith('session-c36-e2e')
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockClick).toHaveBeenCalled()
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-c36')
    })
  })

  it('2. test_export_json_triggers_blob_download: gọi exportSessionJson và trigger tải file .json', async () => {
    mockedExportSessionJson.mockResolvedValue(MOCK_EXPORT_SNAPSHOT)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Hệ thống năng lượng sinh học vi tảo')).toBeInTheDocument()
    })

    // Mở menu Xuất dữ liệu
    const exportMenuBtn = screen.getByRole('button', { name: /xuất dữ liệu/i })
    fireEvent.click(exportMenuBtn)

    // Click Xuất JSON (.json)
    const exportJsonBtn = screen.getByText(/xuất json \(\.json\)/i)
    fireEvent.click(exportJsonBtn)

    await waitFor(() => {
      expect(mockedExportSessionJson).toHaveBeenCalledWith('session-c36-e2e')
      expect(window.URL.createObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-c36')
    })
  })

  it('3. test_export_markdown_error_resilience: hiển thị thông báo lỗi khi export markdown thất bại', async () => {
    mockedExportSessionMarkdown.mockRejectedValue(new Error('Mạng bị gián đoạn khi kết xuất Markdown'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Hệ thống năng lượng sinh học vi tảo')).toBeInTheDocument()
    })

    // Mở menu và click xuất Markdown
    const exportMenuBtn = screen.getByRole('button', { name: /xuất dữ liệu/i })
    fireEvent.click(exportMenuBtn)
    const exportMdBtn = screen.getByText(/xuất markdown \(\.md\)/i)
    fireEvent.click(exportMdBtn)

    await waitFor(() => {
      expect(screen.getByText('Mạng bị gián đoạn khi kết xuất Markdown')).toBeInTheDocument()
    })

    // Giao diện chính không bị sập (resilience check)
    expect(screen.getByText('Hệ thống năng lượng sinh học vi tảo')).toBeInTheDocument()
  })

  it('4. test_export_json_error_resilience: hiển thị thông báo lỗi khi export json thất bại', async () => {
    mockedExportSessionJson.mockRejectedValue(new Error('Lỗi máy chủ khi sao lưu JSON snapshot'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Hệ thống năng lượng sinh học vi tảo')).toBeInTheDocument()
    })

    // Mở menu và click xuất JSON
    const exportMenuBtn = screen.getByRole('button', { name: /xuất dữ liệu/i })
    fireEvent.click(exportMenuBtn)
    const exportJsonBtn = screen.getByText(/xuất json \(\.json\)/i)
    fireEvent.click(exportJsonBtn)

    await waitFor(() => {
      expect(screen.getByText('Lỗi máy chủ khi sao lưu JSON snapshot')).toBeInTheDocument()
    })

    // Giao diện chính không bị sập (resilience check)
    expect(screen.getByText('Hệ thống năng lượng sinh học vi tảo')).toBeInTheDocument()
  })
})
