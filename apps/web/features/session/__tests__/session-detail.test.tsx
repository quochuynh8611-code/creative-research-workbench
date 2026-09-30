/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionDetail } from '../session-detail'
import { IntakeForm } from '@/features/intake/intake-form'
import { NormalizedView } from '@/features/structuring/normalized-view'
import { ContradictionBadge } from '@/features/structuring/contradiction-badge'
import { getSession, createProblemFrame } from '@/lib/api-client'
import type { ProblemFrame, ResearchSession } from '@/lib/types'

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  getSession: jest.fn(),
  createProblemFrame: jest.fn(),
  nextStep: jest.fn(),
}))

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedCreateProblemFrame = createProblemFrame as jest.MockedFunction<typeof createProblemFrame>

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

      expect(screen.getByText(/Kỹ thuật/i)).toBeInTheDocument()
      expect(screen.getByText(/robotics/i)).toBeInTheDocument()
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
})
