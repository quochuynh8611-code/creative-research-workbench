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
  findRelatedSessions,
  getSessionRecommendations,
  getTrizNineWindows,
} from '@/lib/api-client'
import type { ProblemFrame, ResearchSession } from '@/lib/types'

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  getSession: jest.fn(),
  getSessionRecommendations: jest.fn(),
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
  findRelatedSessions: jest.fn(),
  getTrizNineWindows: jest.fn(),
}))

const mockedGetSessionRecommendations = getSessionRecommendations as jest.MockedFunction<typeof getSessionRecommendations>


const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedCreateProblemFrame = createProblemFrame as jest.MockedFunction<typeof createProblemFrame>
const mockedSearchKnowledge = searchKnowledge as jest.MockedFunction<typeof searchKnowledge>
const mockedListResearchNotes = listResearchNotes as jest.MockedFunction<typeof listResearchNotes>
const mockedListCandidateSolutions = listCandidateSolutions as jest.MockedFunction<typeof listCandidateSolutions>
const mockedExportSessionMarkdown = exportSessionMarkdown as jest.MockedFunction<typeof exportSessionMarkdown>
const mockedExportSessionJson = exportSessionJson as jest.MockedFunction<typeof exportSessionJson>
const mockedGetTrizParameters = getTrizParameters as jest.MockedFunction<typeof getTrizParameters>
const mockedLookupTrizMatrix = lookupTrizMatrix as jest.MockedFunction<typeof lookupTrizMatrix>
const mockedFindRelatedSessions = findRelatedSessions as jest.MockedFunction<typeof findRelatedSessions>
const mockedGetTrizNineWindows = getTrizNineWindows as jest.MockedFunction<typeof getTrizNineWindows>
const mockedCreateResearchNote = createResearchNote as jest.MockedFunction<typeof createResearchNote>


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

const MOCK_NINE_WINDOWS_SESSION_DATA = {
  lens: 'engineering',
  lens_title: 'Lăng kính Kỹ thuật & Công nghệ',
  grid: [
    {
      level: 'supersystem',
      time: 'past',
      label_vi: 'Hạ tầng kỹ thuật quá khứ',
      label_en: 'Past Supersystem',
      prompt_vi: 'Hệ thống hạ tầng trước đây giới hạn công nghệ thế nào?',
      description_vi: 'Mô tả hạ tầng quá khứ.',
      examples_vi: ['Đường ray xe lửa khổ hẹp'],
    },
    {
      level: 'supersystem',
      time: 'present',
      label_vi: 'Hạ tầng kỹ thuật hiện tại',
      label_en: 'Present Supersystem',
      prompt_vi: 'Mạng lưới viễn thông và lưới điện tương tác ra sao?',
      description_vi: 'Mô tả hạ tầng hiện tại.',
      examples_vi: ['Mạng 5G'],
    },
    {
      level: 'supersystem',
      time: 'future',
      label_vi: 'Hạ tầng kỹ thuật tương lai',
      label_en: 'Future Supersystem',
      prompt_vi: 'Điện toán lượng tử và năng lượng phân tán đòi hỏi gì?',
      description_vi: 'Mô tả hạ tầng tương lai.',
      examples_vi: ['Lưới điện thông minh microgrid'],
    },
    {
      level: 'system',
      time: 'past',
      label_vi: 'Hệ thống kỹ thuật quá khứ',
      label_en: 'Past System',
      prompt_vi: 'Thiết kế ban đầu giải quyết mâu thuẫn bằng cơ chế nào?',
      description_vi: 'Mô tả hệ thống quá khứ.',
      examples_vi: ['Điện thoại thanh'],
    },
    {
      level: 'system',
      time: 'present',
      label_vi: 'Hệ thống kỹ thuật hiện tại',
      label_en: 'Present System',
      prompt_vi: 'Sản phẩm hiện tại gặp mâu thuẫn hiệu năng và chi phí nào?',
      description_vi: 'Mô tả hệ thống hiện tại.',
      examples_vi: ['Điện thoại thông minh'],
    },
    {
      level: 'system',
      time: 'future',
      label_vi: 'Hệ thống kỹ thuật tương lai',
      label_en: 'Future System',
      prompt_vi: 'Hệ thống tự hòa tan chức năng vào môi trường như thế nào?',
      description_vi: 'Mô tả hệ thống tương lai.',
      examples_vi: ['Giao diện não máy'],
    },
    {
      level: 'subsystem',
      time: 'past',
      label_vi: 'Phân hệ linh kiện quá khứ',
      label_en: 'Past Subsystem',
      prompt_vi: 'Linh kiện rời rạc trước đây gồm những gì?',
      description_vi: 'Mô tả phân hệ quá khứ.',
      examples_vi: ['Bóng đèn chân không'],
    },
    {
      level: 'subsystem',
      time: 'present',
      label_vi: 'Phân hệ linh kiện hiện tại',
      label_en: 'Present Subsystem',
      prompt_vi: 'Các cảm biến và chip bán dẫn phối hợp ra sao?',
      description_vi: 'Mô tả phân hệ hiện tại.',
      examples_vi: ['Chip 3nm'],
    },
    {
      level: 'subsystem',
      time: 'future',
      label_vi: 'Phân hệ linh kiện tương lai',
      label_en: 'Future Subsystem',
      prompt_vi: 'Vật liệu tự phục hồi sẽ thay thế linh kiện hiện tại ra sao?',
      description_vi: 'Mô tả phân hệ tương lai.',
      examples_vi: ['Vật liệu tự liền'],
    },
  ],
}

describe('Phase 5.4 — Problem Intake & Structuring Canvas Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetTrizNineWindows.mockResolvedValue(MOCK_NINE_WINDOWS_SESSION_DATA as any)
    mockedSearchKnowledge.mockResolvedValue({ results: [], latency_ms: 10 })
    mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedListCandidateSolutions.mockResolvedValue({ data: [], meta: { total: 0, session_id: 'ses-456' } })
    mockedGetSessionRecommendations.mockResolvedValue([])
    mockedGetTrizParameters.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedLookupTrizMatrix.mockResolvedValue({
      improving_parameter: { id: 1, code: 'weight_moving', name_vi: 'Trọng lượng', name_en: 'Weight' },
      worsening_parameter: { id: 2, code: 'length_moving', name_vi: 'Chiều dài', name_en: 'Length' },
      is_diagonal: false,
      principles: [],
      principles_count: 0,
    })
    mockedFindRelatedSessions.mockResolvedValue({
      source_session_id: 'ses-456',
      has_problem_frame: false,
      reason: 'no_problem_frame',
      matched_sessions: [],
      total_candidates_analyzed: 0,
      latency_ms: 0,
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

    it('tự động tải recommendations khi vào tab ideation mà không cần bấm next-step', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedGetSessionRecommendations.mockResolvedValue([
        {
          id: 1,
          title: 'Nguyên tắc Phân đoạn (Segmentation)',
          description: 'Chia nhỏ đối tượng thành các thành phần độc lập.',
          principle_id: 1,
        },
      ])

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
      fireEvent.click(ideationTab)

      await waitFor(() => {
        expect(mockedGetSessionRecommendations).toHaveBeenCalledWith('ses-456')
        expect(screen.getByText('Nguyên tắc Phân đoạn (Segmentation)')).toBeInTheDocument()
      })
    })

    it('bấm Áp dụng nguyên tắc sẽ prefill CandidateSolutions draft mà không chuyển sang Notebook', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedGetSessionRecommendations.mockResolvedValue([
        {
          id: 1,
          title: 'Nguyên tắc Phân đoạn',
          description: 'Chia nhỏ đối tượng thành các phần độc lập.',
          principle_id: 1,
        },
      ])
      mockedListCandidateSolutions.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const ideationTab = screen.getByRole('button', { name: /Ý tưởng & Nguyên tắc/i })
      fireEvent.click(ideationTab)

      await waitFor(() => {
        expect(screen.getByText('Nguyên tắc Phân đoạn')).toBeInTheDocument()
      })

      // Bấm nút "Áp dụng nguyên tắc" trên PrincipleSuggestions
      const applyBtn = screen.getByRole('button', { name: /Áp dụng nguyên tắc/i })
      fireEvent.click(applyBtn)

      // Kiểm tra: Vẫn ở tab ideation, KHÔNG chuyển sang notebook
      expect(screen.queryByText('Thêm ghi chú nghiên cứu')).not.toBeInTheDocument()
      expect(screen.getByText('Đề xuất giải pháp mới')).toBeInTheDocument()

      // Kiểm tra: CandidateSolutions form được điền sẵn
      const titleInput = screen.getByPlaceholderText(/nhập tiêu đề giải pháp sáng tạo/i) as HTMLInputElement
      expect(titleInput.value).toContain('Nguyên tắc #1')
      const mechanismInput = screen.getByPlaceholderText(/mô tả cơ chế hoạt động/i) as HTMLTextAreaElement
      expect(mechanismInput.value).toContain('Chia nhỏ đối tượng')
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

    it('chuyển cell từ TRIZ 9-Windows sang Notebook và prefill nội dung', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Mở collapsible 9-Windows
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      // Bấm nút Lưu vào sổ tay của cell đầu tiên
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      expect(saveBtns.length).toBeGreaterThan(0)
      fireEvent.click(saveBtns[0])

      // Kiểm tra chuyển sang tab Notebook và form được điền sẵn nội dung draft
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(textarea.value).toContain('Hạ tầng kỹ thuật quá khứ')
      expect(textarea.value).toContain('Lăng kính Kỹ thuật & Công nghệ')
    })

    it('cho phép Hủy nháp sau khi lưu draft từ TRIZ 9-Windows', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Mở collapsible 9-Windows
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      // Bấm nút Lưu vào sổ tay
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[0])

      // Kiểm tra đã ở tab Notebook và có nút Hủy nháp
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const discardBtn = screen.getByRole('button', { name: /hủy nháp/i })
      fireEvent.click(discardBtn)

      // Sau khi hủy nháp, textarea trở về rỗng và banner biến mất
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(textarea.value).toBe('')
      expect(screen.queryByText(/Đang soạn thảo từ bản nháp gợi ý/i)).not.toBeInTheDocument()
    })
  })

  describe('8.1. Batch C4a — Notebook Draft Preservation and Overwrite Guard', () => {
    it('9. test_saves_nine_windows_insight_to_notebook_draft_when_notebook_is_clean: lưu insight từ 9-Windows prefill vào Notebook khi form chưa dirty', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Mở collapsible 9-Windows
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      // Lưu cell đầu tiên khi notebook chưa có draft / clean
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[0])

      // Không hiển thị confirmation dialog vì chưa dirty
      expect(screen.queryByRole('dialog', { name: /Ghi đè bản nháp chưa lưu/i })).not.toBeInTheDocument()

      // Tự động chuyển tab sang Notebook và textarea có nội dung
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(textarea.value).toContain('Hạ tầng kỹ thuật quá khứ')
    })

    it('10. test_preserves_notebook_edits_when_switching_to_another_tab_and_back: bảo toàn nội dung và noteType người dùng đang soạn khi chuyển tab qua lại', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Chuyển sang tab Notebook
      const notebookTab = screen.getByRole('button', { name: /Ghi chép \(Notebook\)|Ghi chép/i })
      fireEvent.click(notebookTab)
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()

      // Người dùng gõ ghi chú dở dang và đổi noteType sang hypothesis
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Nội dung phân tích cá nhân đang viết dở dang' } })
      const noteTypeSelect = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      fireEvent.change(noteTypeSelect, { target: { value: 'hypothesis' } })

      // Chuyển sang tab Phân tích cấu trúc
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      expect(screen.getByText('Bài toán đã chuẩn hóa (Normalized Problem Statement)')).toBeInTheDocument()

      // Chuyển lại tab Notebook
      fireEvent.click(notebookTab)
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()

      // Cả content lẫn noteType phải được bảo tồn hoàn toàn, không bị xóa do unmount
      const restoredTextarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(restoredTextarea.value).toBe('Nội dung phân tích cá nhân đang viết dở dang')
      const restoredSelect = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      expect(restoredSelect.value).toBe('hypothesis')
    })

    it('11. test_shows_overwrite_confirmation_when_saving_a_new_insight_while_notebook_is_dirty: hiển thị confirmation dialog khi lưu ô mới trong lúc notebook đang dirty (cả khi sửa content lẫn đổi noteType)', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Case 1: Đổi noteType so với draft gốc khiến isDirty = true
      // Mở 9-Windows và nạp cell 0
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[0])
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()

      // Giữ nguyên content, chỉ đổi noteType từ 'insight' sang 'decision'
      const select = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'decision' } })

      // Quay lại Structuring và lưu cell 1
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleBtn = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleBtn)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtnsAgain = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtnsAgain[1])

      // Phải xuất hiện dialog xác nhận ghi đè vì noteType đã thay đổi (isDirty = true)
      const dialog = screen.getByRole('dialog', { name: /Ghi đè bản nháp chưa lưu\?/i })
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(screen.getByText(/Bạn đang có nội dung chưa lưu trong Sổ tay nghiên cứu/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ghi đè' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument()
    })

    it('12. test_does_not_change_tab_while_overwrite_confirmation_is_open: giữ nguyên active tab hiện tại khi confirmation dialog đang mở', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Vào Notebook và gõ dirty
      const notebookTab = screen.getByRole('button', { name: /Ghi chép \(Notebook\)|Ghi chép/i })
      fireEvent.click(notebookTab)
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Nội dung dirty' } })

      // Sang tab Structuring
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[1])

      // Dialog mở, nhưng tab vẫn phải là Structuring, không được chuyển sang Notebook
      expect(screen.getByRole('dialog', { name: /Ghi đè bản nháp chưa lưu\?/i })).toBeInTheDocument()
      expect(screen.getByText('Bài toán đã chuẩn hóa (Normalized Problem Statement)')).toBeInTheDocument()
    })

    it('13. test_replaces_draft_and_switches_to_notebook_after_overwrite_confirmation: khi chọn Ghi đè, thay thế draft, reset isDirty, nạp content/noteType mới và chuyển Notebook', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Tạo dirty draft trong Notebook
      const notebookTab = screen.getByRole('button', { name: /Ghi chép \(Notebook\)|Ghi chép/i })
      fireEvent.click(notebookTab)
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Bản nháp cũ sắp bị ghi đè' } })

      // Sang tab Structuring và click lưu cell 9-Windows thứ 2 ("Hạ tầng kỹ thuật hiện tại")
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[1])

      // Bấm nút "Ghi đè" trong confirmation dialog
      const confirmBtn = screen.getByRole('button', { name: 'Ghi đè' })
      fireEvent.click(confirmBtn)

      // Dialog đóng, chuyển tab sang Notebook và nạp nội dung của cell thứ 2
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const newTextarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(newTextarea.value).toContain('Hạ tầng kỹ thuật hiện tại')

      // isDirty đã được reset về false: quay lại Structuring và lưu cell thứ 3 mà không bị guard
      fireEvent.click(structuringTab)
      const toggleBtnCell3 = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleBtnCell3)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtnsCell3 = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtnsCell3[2])
      expect(screen.queryByRole('dialog', { name: /Ghi đè bản nháp chưa lưu\?/i })).not.toBeInTheDocument()
    })

    it('14. test_preserves_existing_edits_after_cancelling_overwrite_confirmation: khi chọn Hủy (hoặc Escape, click outside), giữ nguyên draft, content, noteType và activeTab', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Tạo dirty draft và noteType hypothesis trong Notebook
      const notebookTab = screen.getByRole('button', { name: /Ghi chép \(Notebook\)|Ghi chép/i })
      fireEvent.click(notebookTab)
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Nội dung giữ nguyên không ghi đè' } })
      const select = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'hypothesis' } })

      // Sang tab Structuring và click lưu
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[1])

      // Bấm nút "Hủy" trong dialog
      const cancelBtn = screen.getByRole('button', { name: 'Hủy' })
      fireEvent.click(cancelBtn)

      // Dialog biến mất, tab vẫn là Structuring
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Bài toán đã chuẩn hóa (Normalized Problem Statement)')).toBeInTheDocument()

      // Khi người dùng chủ động vào lại Notebook, nội dung dirty và noteType vẫn nguyên vẹn
      fireEvent.click(notebookTab)
      const preservedTextarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      expect(preservedTextarea.value).toBe('Nội dung giữ nguyên không ghi đè')
      const preservedSelect = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      expect(preservedSelect.value).toBe('hypothesis')
    })

    it('15. test_clears_draft_content_note_type_and_dirty_state_after_discard: hủy nháp reset draft, content, noteType và isDirty', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Lưu 1 cell 9-Windows vào Notebook
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[0])

      // Đã ở tab Notebook, gõ thêm nội dung và đổi noteType sang question
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Gõ thêm chữ' } })
      const select = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'question' } })

      // Click "Hủy nháp"
      const discardBtn = screen.getByRole('button', { name: /hủy nháp/i })
      fireEvent.click(discardBtn)

      // Textarea rỗng, draft banner biến mất, noteType về insight
      expect(textarea.value).toBe('')
      expect(screen.queryByText(/Đang soạn thảo từ bản nháp gợi ý/i)).not.toBeInTheDocument()
      expect(select.value).toBe('insight')

      // isDirty đã về false: sang Structuring và click lưu cell mới không xuất hiện dialog
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleBtn = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleBtn)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtnsAgain = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtnsAgain[1])
      expect(screen.queryByRole('dialog', { name: /Ghi đè bản nháp chưa lưu\?/i })).not.toBeInTheDocument()
    })

    it('16. test_clears_draft_state_after_successful_note_creation: lưu thành công gọi onNoteCreated, SessionDetail reset toàn bộ draft state (draft, content, noteType, isDirty, pendingDraft)', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
      mockedCreateResearchNote.mockResolvedValueOnce({
        id: 'new-note-id',
        session_id: 'ses-456',
        content: 'Nội dung lưu thành công',
        note_type: 'insight',
        source_chunk_id: null,
        created_at: '2026-11-12T00:00:00Z',
      })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Nạp draft từ 9-Windows vào Notebook
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[0])

      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      expect(screen.getByText(/Đang soạn thảo từ bản nháp gợi ý/i)).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Nội dung lưu thành công' } })

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockedCreateResearchNote).toHaveBeenCalled()
      })

      // Sau khi tạo thành công (qua onNoteCreated), SessionDetail reset toàn bộ draft state:
      // draft = null (banner biến mất)
      expect(screen.queryByText(/Đang soạn thảo từ bản nháp gợi ý/i)).not.toBeInTheDocument()
      // content = ""
      await waitFor(() => {
        expect(textarea.value).toBe('')
      })
      // noteType = "insight"
      const select = screen.getByLabelText(/loại ghi chú/i) as HTMLSelectElement
      expect(select.value).toBe('insight')

      // isDirty = false & pendingDraft = null: sang Structuring lưu cell mới không bị guard
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleBtn = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleBtn)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtnsAgain = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtnsAgain[1])
      expect(screen.queryByRole('dialog', { name: /Ghi đè bản nháp chưa lưu\?/i })).not.toBeInTheDocument()
    })

    it('17. test_does_not_show_overwrite_confirmation_when_the_new_draft_matches_the_existing_untouched_draft: không hiển thị confirmation khi draft chưa hề bị chỉnh sửa hoặc khi gõ rồi xóa về đúng nội dung draft gốc', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })

      renderWithClient(<SessionDetail sessionId="ses-456" />)
      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Lưu cell 9-Windows đầu tiên
      const toggleButton = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })
      const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtns[0])

      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i) as HTMLTextAreaElement
      const originalValue = textarea.value

      // Trường hợp A: Gõ thêm rồi xóa về đúng nội dung draft gốc -> isDirty trở về false
      fireEvent.change(textarea, { target: { value: originalValue + ' chỉnh sửa tạm' } })
      fireEvent.change(textarea, { target: { value: originalValue } })

      // Quay lại tab Structuring
      const structuringTab = screen.getByRole('button', { name: /^Phân tích cấu trúc$/i })
      fireEvent.click(structuringTab)
      const toggleBtn = screen.getByRole('button', {
        name: /Mở rộng góc nhìn hệ thống đa chiều \(TRIZ 9-Windows\)|TRIZ 9-Windows/i,
      })
      fireEvent.click(toggleBtn)
      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(9)
      })

      // Lưu lại cell đó (hoặc cell khác khi isDirty === false)
      const saveBtnsAgain = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
      fireEvent.click(saveBtnsAgain[1])

      // Guard KHÔNG kích hoạt vì isDirty === false
      expect(screen.queryByRole('dialog', { name: /Ghi đè bản nháp chưa lưu\?/i })).not.toBeInTheDocument()
      expect(await screen.findByText('Thêm ghi chú nghiên cứu')).toBeInTheDocument()
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

    it('nút export và menu có thuộc tính accessibility (aria-controls, id, aria-expanded) chính xác', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      expect(exportTrigger).toHaveAttribute('aria-haspopup', 'menu')
      expect(exportTrigger).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()

      fireEvent.click(exportTrigger)
      expect(exportTrigger).toHaveAttribute('aria-expanded', 'true')
      expect(exportTrigger).toHaveAttribute('aria-controls', 'export-menu-dropdown')

      const menu = screen.getByRole('menu')
      expect(menu).toHaveAttribute('id', 'export-menu-dropdown')
    })

    it('nhấn phím Escape đóng dropdown menu xuất dữ liệu', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)
      expect(screen.getByRole('menu')).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('click ra bên ngoài vùng dropdown menu đóng menu xuất dữ liệu', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      const exportTrigger = screen.getByRole('button', { name: /Xuất dữ liệu|Export/i })
      fireEvent.click(exportTrigger)
      expect(screen.getByRole('menu')).toBeInTheDocument()

      fireEvent.mouseDown(document.body)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
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

  describe('Phase 10.2: Cross-Session Discovery Integration', () => {
    it('khi chuyển sang tab Tài liệu & Bằng chứng: render RelatedSessionsPanel cùng EvidencePanel', async () => {
      mockedGetSession.mockResolvedValue(MOCK_SESSION_WITH_FRAME)
      const mockedFindRelated = jest.requireMock('@/lib/api-client').findRelatedSessions as jest.Mock
      mockedFindRelated.mockResolvedValueOnce({
        source_session_id: 'ses-456',
        has_problem_frame: true,
        reason: null,
        matched_sessions: [
          {
            session_id: 'ses-match-999',
            title: 'Nghiên cứu cấu trúc khung hợp kim siêu cứng',
            domain: 'technical',
            status: 'active',
            similarity_score: 0.9,
            match_reasons: ['Trùng thông số cải thiện: Độ bền / Độ cứng'],
            shared_parameters: {
              improving_parameter: 'Độ bền / Độ cứng',
            },
            created_at: '2026-03-16T10:00:00Z',
          },
        ],
        total_candidates_analyzed: 5,
        latency_ms: 12.0,
      })

      renderWithClient(<SessionDetail sessionId="ses-456" />)

      await waitFor(() => {
        expect(screen.getByText('Tối ưu độ bền và trọng lượng cánh tay robot')).toBeInTheDocument()
      })

      // Click tab retrieval
      const retrievalTab = screen.getByRole('button', { name: /Tài liệu & Bằng chứng/i })
      fireEvent.click(retrievalTab)

      // Kiểm tra cả EvidencePanel lẫn RelatedSessionsPanel cùng hiện diện
      expect(await screen.findByText('Bằng chứng & Tài liệu trích dẫn (Evidence Panel)')).toBeInTheDocument()
      expect(await screen.findByText('Phiên nghiên cứu liên quan (Cross-Session Knowledge Discovery)')).toBeInTheDocument()
      expect(await screen.findByText('Nghiên cứu cấu trúc khung hợp kim siêu cứng')).toBeInTheDocument()
      expect(screen.getByText(/90%/)).toBeInTheDocument()
    })
  })
})
