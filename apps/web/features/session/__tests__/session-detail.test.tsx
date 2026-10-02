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
  listCandidateSolutions,
  createCandidateSolution,
  updateCandidateSolution,
  deleteCandidateSolution,
  exportSessionMarkdown,
  exportSessionJson,
  getTrizParameters,
  lookupTrizMatrix,
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
  listCandidateSolutions: jest.fn(),
  createCandidateSolution: jest.fn(),
  updateCandidateSolution: jest.fn(),
  deleteCandidateSolution: jest.fn(),
  exportSessionMarkdown: jest.fn(),
  exportSessionJson: jest.fn(),
  generateAIResearchReport: jest.fn(),
  getTrizParameters: jest.fn(),
  lookupTrizMatrix: jest.fn(),
}))

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedCreateProblemFrame = createProblemFrame as jest.MockedFunction<typeof createProblemFrame>
const mockedSearchKnowledge = searchKnowledge as jest.MockedFunction<typeof searchKnowledge>
const mockedListResearchNotes = listResearchNotes as jest.MockedFunction<typeof listResearchNotes>
const mockedListCandidateSolutions = listCandidateSolutions as jest.MockedFunction<typeof listCandidateSolutions>
const mockedExportSessionMarkdown = exportSessionMarkdown as jest.MockedFunction<typeof exportSessionMarkdown>
const mockedExportSessionJson = exportSessionJson as jest.MockedFunction<typeof exportSessionJson>
const mockedGetTrizParameters = getTrizParameters as jest.MockedFunction<typeof getTrizParameters>
const mockedLookupTrizMatrix = lookupTrizMatrix as jest.MockedFunction<typeof lookupTrizMatrix>

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
    mockedListCandidateSolutions.mockResolvedValue({ data: [], meta: { total: 0, session_id: 'ses-456' } })
    mockedGetTrizParameters.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedLookupTrizMatrix.mockResolvedValue({
      improving_parameter: { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng', name_en: 'Weight' },
      worsening_parameter: { id: 2, code: 'length_moving', name_vi: 'Chiều dài', name_en: 'Length' },
      is_diagonal: false,
      principles: [],
      principles_count: 0,
    })
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
    it('hiển thị Principle Suggestions và Candidate Solutions khi người dùng chọn tab Ý tưởng & Nguyên tắc', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
      fireEvent.click(ideationTab)

      expect(screen.getByText(/Chưa có gợi ý nguyên tắc sáng chế/i)).toBeInTheDocument()
      expect(screen.getByText(/Giải pháp sáng tạo ứng viên/i)).toBeInTheDocument()
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

    it('chuyển nguyên tắc từ TrizMatrixLookup sang Notebook và prefill nội dung', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedGetTrizParameters.mockResolvedValue({
        data: [
          { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature' },
          { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
        ],
        meta: { total: 2 },
      })
      mockedLookupTrizMatrix.mockResolvedValue({
        improving_parameter: { id: 17, code: 'temperature', name_vi: 'Nhiệt độ', name_en: 'Temperature' },
        worsening_parameter: { id: 14, code: 'strength', name_vi: 'Độ bền / Độ cứng', name_en: 'Strength' },
        is_diagonal: false,
        principles: [
          {
            id: 35,
            principle_id: 35,
            name_vi: 'Nguyên tắc Chuyển đổi thông số',
            name_en: 'Parameter changes',
            description: 'Thay đổi trạng thái vật lý, nồng độ hoặc độ dẻo.',
          },
        ],
        principles_count: 1,
      })
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Mở tab Ý tưởng & Nguyên tắc
      const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
      fireEvent.click(ideationTab)

      await waitFor(() => {
        expect(screen.getByText(/Tra cứu Ma trận Mâu thuẫn TRIZ/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getAllByText(/#17. Nhiệt độ/i)[0]).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/Thông số cần cải thiện/i), { target: { value: '17' } })
      fireEvent.change(screen.getByLabelText(/Thông số bị suy giảm/i), { target: { value: '14' } })
      fireEvent.click(screen.getByRole('button', { name: /tra cứu ma trận/i }))

      await waitFor(() => {
        expect(screen.getByText(/Nguyên tắc Chuyển đổi thông số/i)).toBeInTheDocument()
      })

      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay|lưu thành ghi chú/i })
      fireEvent.click(saveBtns[0])

      // Kiểm tra chuyển sang tab Notebook và form được điền sẵn nguyên tắc TRIZ
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(textarea.value).toContain('Parameter changes')
    })

    it('chuyển giải pháp từ CandidateSolutions sang Notebook và prefill nội dung', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListCandidateSolutions.mockResolvedValue({
        data: [
          {
            id: 'sol-101',
            session_id: 'ses-456',
            title: 'Hợp kim titan siêu nhẹ',
            mechanism: 'Cấu trúc mạng tổ ong rỗng chịu lực phân tán.',
            status: 'accepted',
            novelty_score: 0.9,
            feasibility_score: 0.85,
            risk_notes: 'Giá thành cao',
            created_at: '2026-10-01T08:00:00Z',
          },
        ],
        meta: { total: 1, session_id: 'ses-456' },
      })
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Mở tab Ý tưởng & Nguyên tắc
      const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
      fireEvent.click(ideationTab)

      await screen.findByText('Hợp kim titan siêu nhẹ')

      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay|lưu thành ghi chú/i })
      fireEvent.click(saveBtns[0])

      // Kiểm tra chuyển sang tab Notebook và form được điền sẵn giải pháp
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(textarea.value).toContain('Hợp kim titan siêu nhẹ')
    })
  })

  describe('9. Unified Export Dropdown & Format Picker Flow (Phase 9B)', () => {
    let anchorClickSpy: jest.SpyInstance

    beforeEach(() => {
      window.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-blob')
      window.URL.revokeObjectURL = jest.fn()
      window.print = jest.fn()
      anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    })

    afterEach(() => {
      anchorClickSpy.mockRestore()
    })

    it('render nút Xuất dữ liệu (dropdown trigger) tại header thao tác', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })).toBeInTheDocument()
    })

    it('click nút Xuất dữ liệu mở dropdown menu với đủ 3 format: Markdown, JSON, PDF', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)

      // Kiểm tra 3 options xuất hiện
      expect(await screen.findByRole('menuitem', { name: /Xuất Markdown|Markdown/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /Xuất JSON|JSON Snapshot/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /In \/ Lưu PDF|PDF/i })).toBeInTheDocument()
    })

    it('chọn In / Lưu PDF gọi window.print()', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)

      const printItem = await screen.findByRole('menuitem', { name: /In \/ Lưu PDF|PDF/i })
      fireEvent.click(printItem)

      expect(window.print).toHaveBeenCalledTimes(1)
    })

    it('chọn Xuất Markdown (.md) gọi exportSessionMarkdown và trigger download', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      const mockBlob = new Blob(['# Markdown content'], { type: 'text/markdown' })
      mockedExportSessionMarkdown.mockResolvedValueOnce(mockBlob)

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)

      const mdItem = await screen.findByRole('menuitem', { name: /Xuất Markdown|Markdown/i })
      fireEvent.click(mdItem)

      await waitFor(() => {
        expect(mockedExportSessionMarkdown).toHaveBeenCalledWith('ses-456')
      })
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    })

    it('chọn Xuất JSON (.json) gọi exportSessionJson và trigger download file json', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      const mockSnapshot = {
        session: { id: 'ses-456', title: 'Tối ưu cánh tay robot' },
        problem_frame: null,
        recommended_methods: [],
        research_notes: [],
        candidate_solutions: [],
      }
      mockedExportSessionJson.mockResolvedValueOnce(mockSnapshot as any)

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)

      const jsonItem = await screen.findByRole('menuitem', { name: /Xuất JSON|JSON Snapshot/i })
      fireEvent.click(jsonItem)

      await waitFor(() => {
        expect(mockedExportSessionJson).toHaveBeenCalledWith('ses-456')
      })
      expect(window.URL.createObjectURL).toHaveBeenCalled()
      expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    })

    it('hiển thị trạng thái loading/disabled khi export đang diễn ra', async () => {
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

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)

      const mdItem = await screen.findByRole('menuitem', { name: /Xuất Markdown|Markdown/i })
      fireEvent.click(mdItem)

      // Trong lúc pending
      expect(screen.getByRole('button', { name: /Đang xuất/i })).toBeDisabled()

      // Hoàn thành export
      resolveExport(new Blob(['# Content']))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })).not.toBeDisabled()
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

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)

      const mdItem = await screen.findByRole('menuitem', { name: /Xuất Markdown|Markdown/i })
      fireEvent.click(mdItem)

      await waitFor(() => {
        expect(screen.getByText(/Lỗi kết nối máy chủ khi xuất Markdown/i)).toBeInTheDocument()
      })

      // Active tab vẫn là Tài liệu & Bằng chứng
      expect(screen.getByText(/Bằng chứng & Tài liệu trích dẫn/i)).toBeInTheDocument()
    })
  })

  describe('10. Synthesis Tab & AI Research Report Generator UI Flow (Phase 9A)', () => {
    it('render tab Tổng hợp & Báo cáo (Synthesis) trên thanh điều hướng tab', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Nút tab Synthesis phải xuất hiện
      expect(screen.getAllByRole('button', { name: /Tổng hợp & Báo cáo|Synthesis/i })[0]).toBeInTheDocument()
    })

    it('cho phép mở tab Synthesis và hiển thị nút Tạo Báo cáo AI', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const synthesisBtns = screen.getAllByRole('button', { name: /Tổng hợp & Báo cáo|Synthesis/i })
      fireEvent.click(synthesisBtns[0])

      // Nút CTA tạo báo cáo AI
      expect(await screen.findByRole('button', { name: /Tạo Báo cáo AI|Sinh Báo cáo/i })).toBeInTheDocument()
    })

    it('khi click Tạo Báo cáo AI: hiển thị loading state, sau đó render report preview và controls sao chép/tải về', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      const mockReportData = {
        session_id: 'ses-456',
        report_title: 'Báo cáo Nghiên cứu: Cánh tay Robot',
        executive_summary: 'Tóm tắt giải pháp tối ưu độ bền và trọng lượng.',
        problem_background: 'Phân tích mâu thuẫn kỹ thuật...',
        evidence_synthesis: 'Tổng hợp tri thức và bằng chứng...',
        solution_assessment: 'Đánh giá các giải pháp composite...',
        action_plan: ['Thử nghiệm sợi carbon', 'Thiết kế CAD'],
        markdown_content: '# BÁO CÁO CHIẾN LƯỢC\n\nNội dung chi tiết...',
        provenance: 'ai_synthesis' as const,
        provider: 'openai',
        model: 'gpt-4o-mini',
      }

      const mockedGenerate = jest.requireMock('@/lib/api-client').generateAIResearchReport as jest.Mock
      mockedGenerate.mockResolvedValueOnce(mockReportData)

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Chuyển sang tab Synthesis
      const synthesisBtns = screen.getAllByRole('button', { name: /Tổng hợp & Báo cáo|Synthesis/i })
      fireEvent.click(synthesisBtns[0])

      const generateBtn = await screen.findByRole('button', { name: /Tạo Báo cáo AI|Sinh Báo cáo/i })
      fireEvent.click(generateBtn)

      // Kiểm tra gọi đúng API client
      await waitFor(() => {
        expect(mockedGenerate).toHaveBeenCalledWith('ses-456')
      })

      // Kiểm tra preview hiển thị nội dung báo cáo
      expect(await screen.findByText('Báo cáo Nghiên cứu: Cánh tay Robot')).toBeInTheDocument()
      expect(screen.getByText(/Tóm tắt giải pháp tối ưu độ bền/i)).toBeInTheDocument()

      // Kiểm tra các controls thao tác báo cáo
      expect(screen.getByRole('button', { name: /Sao chép|Copy/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Tải file \.md|Tải Báo cáo/i })).toBeInTheDocument()
    })
  })
})
