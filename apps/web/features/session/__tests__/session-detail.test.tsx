/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionDetail } from '../session-detail'
import { IntakeForm } from '@/features/intake/intake-form'
import { NormalizedView } from '@/features/structuring/normalized-view'
import { ContradictionBadge } from '@/features/structuring/contradiction-badge'
import {
  getSession,
  createProblemFrame,
  searchKnowledge,
  listResearchNotes,
  createResearchNote,
  deleteResearchNote,
  exportSessionMarkdown,
} from '@/lib/api-client'
import type { ProblemFrame, ResearchSession } from '@/lib/types'

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  getSession: jest.fn(),
  createProblemFrame: jest.fn(),
  nextStep: jest.fn(),
  searchKnowledge: jest.fn(),
  listResearchNotes: jest.fn(),
  createResearchNote: jest.fn(),
  deleteResearchNote: jest.fn(),
  exportSessionMarkdown: jest.fn(),
}))

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedCreateProblemFrame = createProblemFrame as jest.MockedFunction<typeof createProblemFrame>
const mockedSearchKnowledge = searchKnowledge as jest.MockedFunction<typeof searchKnowledge>
const mockedListResearchNotes = listResearchNotes as jest.MockedFunction<typeof listResearchNotes>
const mockedExportSessionMarkdown = exportSessionMarkdown as jest.MockedFunction<typeof exportSessionMarkdown>

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderWithClient(ui: React.ReactElement, queryClient = createTestQueryClient()) {
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
}

const MOCK_SESSION_WITH_FRAME: ResearchSession = {
  id: 'ses-456',
  title: 'Tối ưu độ bền và trọng lượng cánh tay robot',
  description: 'Nghiên cứu vật liệu composite cho robot công nghiệp',
  domain: 'technical',
  status: 'active',
  workflow_state: 'structuring',
  tags: ['robotics', 'triz', 'materials'],
  created_at: '2026-03-15T08:30:00Z',
  updated_at: '2026-03-15T09:15:00Z',
  problem_frame: {
    id: 'frame-789',
    session_id: 'ses-456',
    raw_statement: 'Cánh tay robot cần nhẹ để tăng tốc độ nhưng phải cứng để chịu tải',
    normalized_statement: 'Tăng độ cứng vững của cấu trúc trong khi duy trì hoặc giảm khối lượng tổng thể',
    contradiction_type: 'technical',
    improving_parameter: 'Độ bền / Độ cứng',
    worsening_parameter: 'Trọng lượng vật thể',
    domain: 'technical',
    created_at: '2026-03-15T09:00:00Z',
  },
}

const MOCK_SESSION_NEW: ResearchSession = {
  id: 'ses-123',
  title: 'Giảm tiêu hao năng lượng hệ thống làm mát',
  description: 'Tối ưu hiệu suất điều hòa trung tâm',
  domain: 'research',
  status: 'draft',
  workflow_state: 'intake',
  tags: ['hvac', 'energy'],
  created_at: '2026-03-10T10:00:00Z',
  updated_at: '2026-03-10T10:00:00Z',
  problem_frame: null,
}

describe('Phase 5.4 — Problem Intake & Structuring Canvas Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSearchKnowledge.mockResolvedValue({ results: [], latency_ms: 10 })
    mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
  })

  describe('1. SessionDetail Component', () => {
    it('hiển thị trạng thái loading khi đang fetch session', () => {
      mockedGetSession.mockReturnValue(new Promise(() => {}))
      renderWithClient(<SessionDetail sessionId="ses-123" />)
      expect(screen.getByText(/Đang tải thông tin phiên nghiên cứu/i)).toBeInTheDocument()
    })

    it('hiển thị thông báo lỗi khi fetch session thất bại', async () => {
      mockedGetSession.mockRejectedValue(new Error('Không tìm thấy session'))
      renderWithClient(<SessionDetail sessionId="ses-non-existent" />)

      await waitFor(() => {
        expect(screen.getByText(/Không thể tải dữ liệu phiên nghiên cứu/i)).toBeInTheDocument()
      })
    })

    it('hiển thị dữ liệu thực từ backend (title, domain, status, workflow stepper)', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      expect(screen.getByText('Kỹ thuật')).toBeInTheDocument()
      expect(screen.getByText(/robotics/i)).toBeInTheDocument()
    })

    it('tự động khởi tạo active tab là structuring khi session có problem_frame và workflow_state là structuring', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Hiển thị trực tiếp Problem Canvas (NormalizedView)
      expect(screen.getByText(/Bài toán đã chuẩn hóa/i)).toBeInTheDocument()
      expect(screen.getByText(MOCK_SESSION_WITH_FRAME.problem_frame!.normalized_statement!)).toBeInTheDocument()
    })

    it('tự động khởi tạo active tab là retrieval khi session có problem_frame và workflow_state là retrieval', async () => {
      const mockSessionRetrieval: ResearchSession = {
        ...MOCK_SESSION_WITH_FRAME,
        workflow_state: 'retrieval',
      }
      mockedGetSession.mockResolvedValue(mockSessionRetrieval)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText(/Bằng chứng & Tài liệu trích dẫn/i)).toBeInTheDocument()
      })
    })

    it('tự động khởi tạo active tab là intake khi session mới chưa có problem_frame', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_NEW)
      renderWithClient(<SessionDetail sessionId="ses-123" />)

      await waitFor(() => {
        expect(screen.getByText('Giảm tiêu hao năng lượng hệ thống làm mát')).toBeInTheDocument()
      })

      // Active tab là intake form
      expect(screen.getByRole('button', { name: /Lưu và chuyển sang Phân tích cấu trúc/i })).toBeInTheDocument()
    })

    it('hiển thị empty state thân thiện khi ở tab structuring nhưng chưa có problem_frame và cho phép quay về intake', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_NEW)
      renderWithClient(<SessionDetail sessionId="ses-123" />)

      await waitFor(() => {
        expect(screen.getByText('Giảm tiêu hao năng lượng hệ thống làm mát')).toBeInTheDocument()
      })

      // Click sang tab Phân tích cấu trúc
      const structuringBtns = screen.getAllByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringBtns[0])

      // Kiểm tra empty state
      expect(screen.getByText(/Chưa có phân tích cấu trúc bài toán/i)).toBeInTheDocument()

      // Bấm nút CTA "Nhập vấn đề ngay"
      const ctaBtn = screen.getByRole('button', { name: /Nhập vấn đề ngay/i })
      fireEvent.click(ctaBtn)

      // Chuyển lại tab Intake
      expect(screen.getByRole('button', { name: /Lưu và chuyển sang Phân tích cấu trúc/i })).toBeInTheDocument()
    })

    it('cho phép điều hướng từ Problem Canvas sang Retrieval bằng nút Tiến hành tra cứu', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText(/Bài toán đã chuẩn hóa/i)).toBeInTheDocument()
      })

      const proceedBtn = screen.getByRole('button', { name: /Tiến hành tra cứu tài liệu & nguyên tắc/i })
      fireEvent.click(proceedBtn)

      expect(await screen.findByText(/Bằng chứng & Tài liệu trích dẫn/i)).toBeInTheDocument()
    })
  })

  describe('2. IntakeForm Component Mutation Flow', () => {
    it('gửi API createProblemFrame khi người dùng submit bài toán hợp lệ', async () => {
      const mockCreatedFrame: ProblemFrame = {
        id: 'frame-999',
        session_id: 'ses-123',
        raw_statement: 'Cần tăng tốc độ xử lý đơn hàng nhưng không được tăng thêm nhân sự',
        normalized_statement: 'Tăng thông lượng xử lý đơn hàng với nguồn lực nhân sự cố định',
        contradiction_type: 'technical',
        improving_parameter: 'Năng suất',
        worsening_parameter: 'Độ phức tạp quản lý',
        domain: 'business',
      }

      mockedCreateProblemFrame.mockResolvedValue(mockCreatedFrame)
      const onCreatedMock = jest.fn()

      renderWithClient(
        <IntakeForm sessionId="ses-123" onProblemFrameCreated={onCreatedMock} />
      )

      const goalInput = screen.getByPlaceholderText(/Bạn muốn đạt được điều gì/i)
      fireEvent.change(goalInput, {
        target: { value: 'Cần tăng tốc độ xử lý đơn hàng nhưng không được tăng thêm nhân sự' },
      })

      const submitButton = screen.getByRole('button', { name: /Lưu và chuyển sang Phân tích cấu trúc/i })
      expect(submitButton).not.toBeDisabled()

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockedCreateProblemFrame).toHaveBeenCalledWith('ses-123', {
          raw_statement: 'Cần tăng tốc độ xử lý đơn hàng nhưng không được tăng thêm nhân sự',
        })
      })

      await waitFor(() => {
        expect(onCreatedMock).toHaveBeenCalledWith(mockCreatedFrame)
      })
    })
  })

  describe('3. ContradictionBadge Component', () => {
    it('render chính xác badge cho mâu thuẫn kỹ thuật (technical)', () => {
      render(
        <ContradictionBadge
          type="technical"
          improvingParameter="Độ bền"
          worseningParameter="Trọng lượng"
        />
      )

      expect(screen.getByText(/Mâu thuẫn kỹ thuật/i)).toBeInTheDocument()
      expect(screen.getByText(/Độ bền/i)).toBeInTheDocument()
      expect(screen.getByText(/Trọng lượng/i)).toBeInTheDocument()
    })

    it('render chính xác badge cho mâu thuẫn vật lý (physical)', () => {
      render(
        <ContradictionBadge
          type="physical"
          improvingParameter="Nhiệt độ cao"
          worseningParameter="Nhiệt độ thấp"
        />
      )

      expect(screen.getByText(/Mâu thuẫn vật lý/i)).toBeInTheDocument()
    })
  })

  describe('4. NormalizedView Component', () => {
    it('render đầy đủ thông tin chuẩn hóa và tham số mâu thuẫn', () => {
      const onEditMock = jest.fn()
      render(
        <NormalizedView
          problemFrame={MOCK_SESSION_WITH_FRAME.problem_frame!}
          onEditIntake={onEditMock}
        />
      )

      expect(screen.getByText(/Bài toán đã chuẩn hóa/i)).toBeInTheDocument()
      expect(screen.getByText(MOCK_SESSION_WITH_FRAME.problem_frame!.normalized_statement!)).toBeInTheDocument()
      expect(screen.getByText(/Mâu thuẫn kỹ thuật/i)).toBeInTheDocument()
      expect(screen.getByText(/Độ bền \/ Độ cứng/i)).toBeInTheDocument()
      expect(screen.getByText(/Trọng lượng vật thể/i)).toBeInTheDocument()

      const editBtn = screen.getByRole('button', { name: /Chỉnh sửa bài toán/i })
      fireEvent.click(editBtn)
      expect(onEditMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('5. SessionDetail Workflow Stepper Integration', () => {
    it('chuyển tab hiển thị khi tương tác với WorkflowStepper', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Click vào step Nhập vấn đề trên stepper
      const intakeBtns = screen.getAllByRole('button', { name: /Nhập vấn đề/i })
      fireEvent.click(intakeBtns[0])

      // Tab Nhập vấn đề active
      expect(screen.getByRole('button', { name: /Lưu và chuyển sang Phân tích cấu trúc/i })).toBeInTheDocument()
    })
  })

  describe('6. Retrieval & Evidence Panel Integration in SessionDetail', () => {
    it('hiển thị Evidence Panel khi người dùng chọn tab Tài liệu & Bằng chứng', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const retrievalTab = screen.getByRole('button', { name: /Tài liệu & Bằng chứng/i })
      fireEvent.click(retrievalTab)

      expect(screen.getByText(/Bằng chứng & Tài liệu trích dẫn/i)).toBeInTheDocument()
    })
  })

  describe('7. Ideation & Principle Suggestions Integration in SessionDetail', () => {
    it('hiển thị Principle Suggestions khi người dùng chọn tab Ý tưởng & Nguyên tắc', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
      fireEvent.click(ideationTab)

      expect(screen.getByText(/Chưa có gợi ý nguyên tắc sáng chế/i)).toBeInTheDocument()
    })
  })

  describe('8. Save as Research Note Cross-Tab Flow', () => {
    it('chuyển trích dẫn từ Retrieval sang Notebook và prefill nội dung', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedSearchKnowledge.mockResolvedValueOnce({
        results: [
          {
            chunk_id: 'chk-101',
            source_ref: 'docs/ADR-001-architecture.md',
            excerpt: 'Kiến trúc Workflow Engine cho phép chuyển tiếp trạng thái',
            score: 0.92,
            metadata: { topic: 'architecture' },
          },
        ],
        latency_ms: 25,
      })
      mockedListResearchNotes.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Mở tab Retrieval
      const retrievalTab = screen.getByRole('button', { name: /Tài liệu & Bằng chứng/i })
      fireEvent.click(retrievalTab)

      await screen.findByText('docs/ADR-001-architecture.md')

      // Bấm nút Lưu vào sổ tay
      const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay|lưu thành ghi chú/i })
      fireEvent.click(saveBtn)

      // Kiểm tra chuyển sang tab Notebook và form được điền sẵn trích dẫn
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(textarea.value).toContain('Kiến trúc Workflow Engine cho phép chuyển tiếp trạng thái')
    })
  })

  describe('9. Session Markdown & PDF Export Actions', () => {
    beforeEach(() => {
      window.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-blob')
      window.URL.revokeObjectURL = jest.fn()
      window.print = jest.fn()
    })

    it('render đầy đủ nút Xuất Markdown và In / Lưu PDF khi session load thành công', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Xuất Markdown/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /In \/ Lưu PDF/i })).toBeInTheDocument()
    })

    it('click nút In / Lưu PDF gọi window.print()', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const printBtn = screen.getByRole('button', { name: /In \/ Lưu PDF/i })
      fireEvent.click(printBtn)

      expect(window.print).toHaveBeenCalledTimes(1)
    })

    it('click nút export gọi đúng api client và trigger download', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      const mockBlob = new Blob(['# Markdown content'], { type: 'text/markdown' })
      mockedExportSessionMarkdown.mockResolvedValueOnce(mockBlob)

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportBtn = screen.getByRole('button', { name: /Xuất Markdown/i })
      fireEvent.click(exportBtn)

      await waitFor(() => {
        expect(mockedExportSessionMarkdown).toHaveBeenCalledWith('ses-456')
      })
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
    })

    it('hiển thị trạng thái disabled/loading và ngăn chặn double-click trong lúc export', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      let resolveExport: (blob: Blob) => void = () => {}
      const exportPromise = new Promise<Blob>((resolve) => {
        resolveExport = resolve
      })
      mockedExportSessionMarkdown.mockReturnValueOnce(exportPromise)

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportBtn = screen.getByRole('button', { name: /Xuất Markdown/i })
      fireEvent.click(exportBtn)

      // Double-click attempt
      fireEvent.click(exportBtn)
      expect(mockedExportSessionMarkdown).toHaveBeenCalledTimes(1)

      // Trong lúc pending
      expect(screen.getByRole('button', { name: /Đang xuất/i })).toBeDisabled()

      // Hoàn thành export
      resolveExport(new Blob(['# Content']))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Xuất Markdown/i })).not.toBeDisabled()
      })
    })

    it('hiển thị lỗi khi export thất bại và không thay đổi active tab', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedExportSessionMarkdown.mockRejectedValueOnce(new Error('Lỗi kết nối máy chủ khi xuất Markdown'))

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Chọn tab Tài liệu & Bằng chứng trước
      const retrievalTab = screen.getByRole('button', { name: /Tài liệu & Bằng chứng/i })
      fireEvent.click(retrievalTab)
      expect(screen.getByText(/Bằng chứng & Tài liệu trích dẫn/i)).toBeInTheDocument()

      const exportBtn = screen.getByRole('button', { name: /Xuất Markdown/i })
      fireEvent.click(exportBtn)

      await waitFor(() => {
        expect(screen.getByText(/Lỗi kết nối máy chủ khi xuất Markdown/i)).toBeInTheDocument()
      })

      // Active tab vẫn là Tài liệu & Bằng chứng
      expect(screen.getByText(/Bằng chứng & Tài liệu trích dẫn/i)).toBeInTheDocument()
    })
  })
})
