/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeForm } from '@/features/intake/intake-form'
import { CandidateSolutions } from '@/features/ideation/candidate-solutions'
import { ResearchNotebook } from '@/features/notebook/research-notebook'
import { SessionList } from '@/features/session/session-list'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  createProblemFrame: jest.fn(),
  createResearchNote: jest.fn(),
  createCandidateSolution: jest.fn(),
  listResearchNotes: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  listCandidateSolutions: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  listSessions: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  createSession: jest.fn(),
  getSessionTemplates: jest.fn().mockResolvedValue({ templates: [], total: 0 }),
  getEmbeddingStatus: jest.fn().mockResolvedValue({ status: 'ready', provider: 'mock' }),
  getAIStatus: jest.fn().mockResolvedValue({ status: 'ready', provider: 'mock' }),
}))

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

describe('C38-GAP-04: Browser Network Failure Simulation & Draft Preservation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestClient()
    jest.clearAllMocks()
  })

  describe('1. IntakeForm Network Failure & HTTP 500 Simulation', () => {
    it('1.1 Khi gửi Problem Frame gặp network failure (TypeError: Failed to fetch), draft được bảo toàn và hiển thị role="alert"', async () => {
      ;(apiClient.createProblemFrame as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      render(
        <QueryClientProvider client={queryClient}>
          <IntakeForm sessionId="ses-net-1" />
        </QueryClientProvider>
      )

      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được/i)
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng/i)

      fireEvent.change(wantInput, { target: { value: 'Tối ưu tản nhiệt pack pin xe điện' } })
      fireEvent.change(obstacleInput, { target: { value: 'Không làm tăng thể tích và khối lượng' } })

      const submitBtn = screen.getByRole('button', { name: /Lưu và chuyển sang Phân tích cấu trúc/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        expect(alert).toHaveTextContent(/Không thể|Failed to fetch|kết nối|thử lại/i)
      })

      // Draft KHÔNG bị xóa
      expect(wantInput).toHaveValue('Tối ưu tản nhiệt pack pin xe điện')
      expect(obstacleInput).toHaveValue('Không làm tăng thể tích và khối lượng')
    })

    it('1.2 Khi gửi Problem Frame gặp HTTP 500 Internal Server Error, draft được bảo toàn', async () => {
      const http500Error = new Error('HTTP 500 Internal Server Error')
      ;(http500Error as any).response = { status: 500, data: { detail: 'Database connection failed' } }
      ;(apiClient.createProblemFrame as jest.Mock).mockRejectedValueOnce(http500Error)

      render(
        <QueryClientProvider client={queryClient}>
          <IntakeForm sessionId="ses-net-1" />
        </QueryClientProvider>
      )

      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được/i)
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng/i)

      fireEvent.change(wantInput, { target: { value: 'Tăng độ bền kết cấu vỏ nhôm' } })
      fireEvent.change(obstacleInput, { target: { value: 'Không thể tăng độ dày thành vỏ' } })

      const submitBtn = screen.getByRole('button', { name: /Lưu và chuyển sang Phân tích cấu trúc/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })

      // Draft KHÔNG bị xóa
      expect(wantInput).toHaveValue('Tăng độ bền kết cấu vỏ nhôm')
      expect(obstacleInput).toHaveValue('Không thể tăng độ dày thành vỏ')
    })
  })

  describe('2. CandidateSolutions Network Failure & HTTP 500 Simulation', () => {
    it('2.1 Khi lưu Candidate Solution gặp network failure (TypeError: Failed to fetch), draft được bảo toàn và hiển thị role="alert"', async () => {
      ;(apiClient.createCandidateSolution as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      render(
        <QueryClientProvider client={queryClient}>
          <CandidateSolutions sessionId="ses-net-2" />
        </QueryClientProvider>
      )

      const titleInput = screen.getByLabelText(/Tiêu đề giải pháp/i)
      const mechanismTextarea = screen.getByLabelText(/Cơ chế hoạt động/i)

      fireEvent.change(titleInput, { target: { value: 'Vật liệu cách nhiệt aerogel đa lớp' } })
      fireEvent.change(mechanismTextarea, { target: { value: 'Chèn aerogel xốp nano giữa các cell pin lithium' } })

      const submitBtn = screen.getByRole('button', { name: /Lưu giải pháp/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        expect(alert).toHaveTextContent(/Không thể|Failed to fetch|kết nối|thử lại/i)
      })

      // Draft vẫn còn nguyên
      expect(titleInput).toHaveValue('Vật liệu cách nhiệt aerogel đa lớp')
      expect(mechanismTextarea).toHaveValue('Chèn aerogel xốp nano giữa các cell pin lithium')
    })

    it('2.2 Khi lưu Candidate Solution gặp HTTP 500, draft không bị xóa', async () => {
      const http500Error = new Error('HTTP 500 Internal Server Error')
      ;(http500Error as any).response = { status: 500, data: { detail: 'Internal server error' } }
      ;(apiClient.createCandidateSolution as jest.Mock).mockRejectedValueOnce(http500Error)

      render(
        <QueryClientProvider client={queryClient}>
          <CandidateSolutions sessionId="ses-net-2" />
        </QueryClientProvider>
      )

      const titleInput = screen.getByLabelText(/Tiêu đề giải pháp/i)
      const mechanismTextarea = screen.getByLabelText(/Cơ chế hoạt động/i)

      fireEvent.change(titleInput, { target: { value: 'Ống dẫn nhiệt vi mao dẫn' } })
      fireEvent.change(mechanismTextarea, { target: { value: 'Dẫn nhiệt nhanh ra tấm đế tản nhiệt' } })

      const submitBtn = screen.getByRole('button', { name: /Lưu giải pháp/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })

      expect(titleInput).toHaveValue('Ống dẫn nhiệt vi mao dẫn')
      expect(mechanismTextarea).toHaveValue('Dẫn nhiệt nhanh ra tấm đế tản nhiệt')
    })
  })

  describe('3. ResearchNotebook Network Failure & HTTP 500 Simulation', () => {
    it('3.1 Khi lưu ghi chú gặp network failure (TypeError: Failed to fetch), draft không bị xóa', async () => {
      ;(apiClient.createResearchNote as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      let noteContent = 'Ý tưởng phân tách trong không gian theo TRIZ #1'
      const onContentChange = jest.fn((val) => { noteContent = val })
      const onClearDraft = jest.fn()
      const onNoteCreated = jest.fn()

      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            sessionId="ses-net-3"
            initialDraft={null}
            content={noteContent}
            noteType="insight"
            onContentChange={onContentChange}
            onNoteTypeChange={jest.fn()}
            onClearDraft={onClearDraft}
            onNoteCreated={onNoteCreated}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /Lưu ghi chú/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })

      // Callbacks dọn dẹp KHÔNG được gọi
      expect(onClearDraft).not.toHaveBeenCalled()
      expect(onNoteCreated).not.toHaveBeenCalled()

      // Textarea vẫn giữ nguyên nội dung
      const textarea = screen.getByLabelText(/Nội dung ghi chú/i)
      expect(textarea).toHaveValue('Ý tưởng phân tách trong không gian theo TRIZ #1')
    })

    it('3.2 Khi lưu ghi chú gặp HTTP 500, draft không bị dọn dẹp', async () => {
      const http500Error = new Error('HTTP 500 Internal Server Error')
      ;(http500Error as any).response = { status: 500, data: { detail: 'Server error' } }
      ;(apiClient.createResearchNote as jest.Mock).mockRejectedValueOnce(http500Error)

      let noteContent = 'Giả thuyết về hiệu ứng Joule-Thomson'
      const onClearDraft = jest.fn()
      const onNoteCreated = jest.fn()

      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            sessionId="ses-net-3"
            initialDraft={null}
            content={noteContent}
            noteType="hypothesis"
            onContentChange={jest.fn()}
            onNoteTypeChange={jest.fn()}
            onClearDraft={onClearDraft}
            onNoteCreated={onNoteCreated}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /Lưu ghi chú/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })

      expect(onClearDraft).not.toHaveBeenCalled()
      expect(onNoteCreated).not.toHaveBeenCalled()

      const textarea = screen.getByLabelText(/Nội dung ghi chú/i)
      expect(textarea).toHaveValue('Giả thuyết về hiệu ứng Joule-Thomson')
    })
  })

  describe('4. SessionList Form Network Failure Simulation', () => {
    it('4.1 Khi tạo session mới gặp network failure, form không bị reset', async () => {
      ;(apiClient.createSession as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      render(
        <QueryClientProvider client={queryClient}>
          <SessionList />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Tạo session mới/i })).toBeInTheDocument()
      })

      // Mở form tạo session
      const openFormBtn = screen.getByRole('button', { name: /Tạo session mới/i })
      fireEvent.click(openFormBtn)

      const titleInput = screen.getByRole('textbox', { name: /Tiêu đề session|Tiêu đề/i })
      const descInput = screen.getByRole('textbox', { name: /Mô tả/i })

      fireEvent.change(titleInput, { target: { value: 'Nghiên cứu cấu trúc vật liệu tổ ong' } })
      fireEvent.change(descInput, { target: { value: 'Mô tả chi tiết bài toán nghiên cứu' } })

      const submitBtn = screen.getByRole('button', { name: /Tạo session/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })

      // Form giữ nguyên vẹn
      expect(titleInput).toHaveValue('Nghiên cứu cấu trúc vật liệu tổ ong')
      expect(descInput).toHaveValue('Mô tả chi tiết bài toán nghiên cứu')
    })
  })
})
