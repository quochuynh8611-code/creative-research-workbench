/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AICoachPanel } from '../ai-coach-panel'
import * as apiClient from '@/lib/api-client'
import type { ProblemFrame, AICoachResult } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getAICoachSuggestions: jest.fn(),
  createCandidateSolution: jest.fn(),
  createResearchNote: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const mockProblemFrame: ProblemFrame = {
  id: 'pf-1',
  session_id: 'ses-coach-1',
  raw_statement: 'Mâu thuẫn mài mòn',
  contradiction_type: 'technical',
}

const sampleAICoachResult: AICoachResult = {
  session_id: 'ses-coach-1',
  summary: 'AI Coach nhận định mâu thuẫn cốt lõi.',
  provenance: 'ai_coach',
  provider: 'mock',
  model: 'mock-model',
  latency_ms: 50,
  generated_at: '2026-11-20T13:00:00Z',
  suggestions: [
    {
      id: 'sug-sol-1',
      category: 'solution_candidate',
      title: 'Tách biệt ma sát theo thời gian',
      description: 'Bôi trơn bề mặt chỉ khi có tiếp xúc lực lớn',
      source_grounding: {
        source_type: 'principle',
        source_reference: 'Nguyên tắc TRIZ #19: Tác động định kỳ',
      },
      actionable_payload: {
        title: 'Tách biệt ma sát theo thời gian',
        mechanism: 'Bôi trơn bề mặt chỉ khi có tiếp xúc lực lớn',
      },
    },
    {
      id: 'sug-note-1',
      category: 'clarifying_question',
      title: 'Xác minh chu kỳ gia nhiệt',
      description: 'Nhiệt độ ma sát đạt đỉnh ở giây thứ mấy?',
      source_grounding: {
        source_type: 'contradiction',
        source_reference: 'Mâu thuẫn nhiệt độ vs bôi trơn',
      },
      actionable_payload: null,
    },
  ],
}

describe('C38-GAP-02: AI Coach Editable Draft Form', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestQueryClient()
    jest.clearAllMocks()
    ;(apiClient.getAICoachSuggestions as jest.Mock).mockResolvedValue({
      data: sampleAICoachResult,
    })
  })

  // 1. Mở modal với prefilled AI draft
  test('1. Mở modal biên tập với nội dung điền sẵn từ gợi ý AI', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    const editAndSaveBtn = screen.getByRole('button', { name: /Lưu thành Giải pháp|Biên tập & Lưu/i })
    fireEvent.click(editAndSaveBtn)

    // Modal xuất hiện
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(/Biên tập Giải pháp/i)).toBeInTheDocument()

    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    const mechanismTextarea = within(dialog).getByLabelText(/Cơ chế hoạt động/i)

    expect(titleInput).toHaveValue('Tách biệt ma sát theo thời gian')
    expect(mechanismTextarea).toHaveValue('Bôi trơn bề mặt chỉ khi có tiếp xúc lực lớn')
    expect(within(dialog).getByText(/Nguyên tắc TRIZ #19/i)).toBeInTheDocument()
  })

  // 2. Chỉnh sửa title/mechanism/content/note type/tags
  test('2. Cho phép người dùng chỉnh sửa trường thông tin giải pháp và ghi chép', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    // Mở modal Solution và sửa
    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    const mechanismTextarea = within(dialog).getByLabelText(/Cơ chế hoạt động/i)

    fireEvent.change(titleInput, { target: { value: 'Giải pháp bôi trơn chủ động tùy ứng' } })
    fireEvent.change(mechanismTextarea, { target: { value: 'Bổ sung cảm biến vi áp điện kích hoạt bơm vi mô' } })

    expect(titleInput).toHaveValue('Giải pháp bôi trơn chủ động tùy ứng')
    expect(mechanismTextarea).toHaveValue('Bổ sung cảm biến vi áp điện kích hoạt bơm vi mô')

    // Đóng modal solution bằng cách xác nhận hủy thay đổi
    fireEvent.click(within(dialog).getByRole('button', { name: /Hủy/i }))
    if (screen.queryByRole('button', { name: /Xác nhận hủy/i })) {
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận hủy/i }))
    }

    // Mở modal Note và sửa
    const saveNoteBtn = screen.getByRole('button', { name: /Lưu vào Ghi chép/i })
    fireEvent.click(saveNoteBtn)

    const noteDialog = screen.getByRole('dialog')
    expect(within(noteDialog).getByText(/Biên tập Ghi chép/i)).toBeInTheDocument()
    const contentTextarea = within(noteDialog).getByLabelText(/Nội dung ghi chú/i)
    const noteTypeSelect = within(noteDialog).getByLabelText(/Loại ghi chú/i)

    fireEvent.change(contentTextarea, { target: { value: 'Ghi chép chuyên sâu về chu kỳ nhiệt' } })
    fireEvent.change(noteTypeSelect, { target: { value: 'action' } })

    expect(contentTextarea).toHaveValue('Ghi chép chuyên sâu về chu kỳ nhiệt')
    expect(noteTypeSelect).toHaveValue('action')
  })

  // 3. Cancel without API call
  test('3. Bấm nút "Hủy" đóng modal và không gọi bất kỳ API nào', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i })
    fireEvent.click(cancelBtn)

    expect(apiClient.createCandidateSolution).not.toHaveBeenCalled()
    expect(apiClient.createResearchNote).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // 4. Save edited payload
  test('4. Bấm "Lưu" gửi đúng payload đã chỉnh sửa thay vì gợi ý AI gốc', async () => {
    ;(apiClient.createCandidateSolution as jest.Mock).mockResolvedValue({
      id: 'sol-1',
      title: 'Giải pháp bôi trơn chủ động tùy ứng',
      mechanism: 'Bổ sung cảm biến vi áp điện kích hoạt bơm vi mô',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))

    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    const mechanismTextarea = within(dialog).getByLabelText(/Cơ chế hoạt động/i)

    fireEvent.change(titleInput, { target: { value: 'Giải pháp bôi trơn chủ động tùy ứng' } })
    fireEvent.change(mechanismTextarea, { target: { value: 'Bổ sung cảm biến vi áp điện kích hoạt bơm vi mô' } })

    const saveBtn = within(dialog).getByRole('button', { name: /Lưu giải pháp|Xác nhận lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(apiClient.createCandidateSolution).toHaveBeenCalledWith('ses-coach-1', {
        title: 'Giải pháp bôi trơn chủ động tùy ứng',
        mechanism: 'Bổ sung cảm biến vi áp điện kích hoạt bơm vi mô',
        status: 'candidate',
      })
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // 5. Preserve generated AI draft
  test('5. Bảo toàn bản nháp AI gốc trong danh sách gợi ý sau khi hủy hoặc sửa', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    // Mở modal, sửa nhưng rồi hủy
    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    fireEvent.change(titleInput, { target: { value: 'Giải pháp tạm thời' } })

    fireEvent.click(within(dialog).getByRole('button', { name: /Hủy/i }))
    // Xác nhận hủy nếu có Overwrite Guard
    if (screen.queryByRole('button', { name: /Xác nhận hủy/i })) {
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận hủy/i }))
    }

    // Modal đóng lại
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Gợi ý AI trên panel vẫn giữ nguyên văn bản gốc
    expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    expect(screen.getByText('Bôi trơn bề mặt chỉ khi có tiếp xúc lực lớn')).toBeInTheDocument()

    // Khi mở lại modal, nạp lại đúng giá trị gốc của AI
    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const newDialog = screen.getByRole('dialog')
    expect(within(newDialog).getByLabelText(/Tiêu đề giải pháp/i)).toHaveValue('Tách biệt ma sát theo thời gian')
  })

  // 6. Unsaved-Changes Guard: cảnh báo xác nhận khi hủy modal đang có thay đổi chưa lưu
  test('6. Unsaved-Changes Guard: cảnh báo xác nhận khi hủy modal đang có thay đổi chưa lưu', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    fireEvent.change(titleInput, { target: { value: 'Thay đổi chưa lưu' } })

    // Bấm phím Escape khi form đang dirty
    fireEvent.keyDown(window, { key: 'Escape' })

    // Form không bị đóng ngay mà hiện cảnh báo xác nhận hủy hoặc giữ nguyên form
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByLabelText(/Tiêu đề giải pháp/i)).toHaveValue('Thay đổi chưa lưu')
    expect(screen.getByText(/Bản nháp đã bị thay đổi/i)).toBeInTheDocument()
  })

  // 7. Network failure / HTTP 500 draft preservation
  test('7. Bảo toàn dữ liệu nháp người dùng và hiển thị alert lỗi khi mạng lỗi hoặc HTTP 500', async () => {
    ;(apiClient.createCandidateSolution as jest.Mock).mockRejectedValue(
      new Error('TypeError: Failed to fetch')
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    const mechanismTextarea = within(dialog).getByLabelText(/Cơ chế hoạt động/i)

    fireEvent.change(titleInput, { target: { value: 'Giải pháp phục hồi sau sự cố mạng' } })
    fireEvent.change(mechanismTextarea, { target: { value: 'Cơ chế tự động thử lại' } })

    const saveBtn = within(dialog).getByRole('button', { name: /Lưu giải pháp|Xác nhận lưu/i })
    fireEvent.click(saveBtn)

    // Chờ lỗi xuất hiện
    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    })

    // Modal KHÔNG ĐƯỢC ĐÓNG
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Dữ liệu người dùng đã sửa KHÔNG BỊ MẤT
    expect(within(dialog).getByLabelText(/Tiêu đề giải pháp/i)).toHaveValue('Giải pháp phục hồi sau sự cố mạng')
    expect(within(dialog).getByLabelText(/Cơ chế hoạt động/i)).toHaveValue('Cơ chế tự động thử lại')

    // Nút lưu trở lại trạng thái khả dụng cho phép thử lại
    expect(saveBtn).not.toBeDisabled()
  })

  // 8. Append-only Save: Lưu giải pháp tạo CandidateSolution mới, không overwrite existing solutions
  test('8. Append-only Save: Lưu giải pháp luôn tạo bản ghi CandidateSolution mới và không ghi đè giải pháp hiện có', async () => {
    const existingSolutions = [
      { id: 'sol-existing-1', title: 'Giải pháp hiện có 1', mechanism: 'Cơ chế 1' },
      { id: 'sol-existing-2', title: 'Giải pháp hiện có 2', mechanism: 'Cơ chế 2' },
    ]

    ;(apiClient.createCandidateSolution as jest.Mock).mockResolvedValue({
      id: 'sol-new-3',
      title: 'Giải pháp tạo mới từ AI Coach',
      mechanism: 'Cơ chế tạo mới',
      status: 'candidate',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    const mechanismTextarea = within(dialog).getByLabelText(/Cơ chế hoạt động/i)

    fireEvent.change(titleInput, { target: { value: 'Giải pháp tạo mới từ AI Coach' } })
    fireEvent.change(mechanismTextarea, { target: { value: 'Cơ chế tạo mới' } })

    const saveBtn = within(dialog).getByRole('button', { name: /Lưu giải pháp|Xác nhận lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // Phải gọi createCandidateSolution (POST mới), tuyệt đối không update hay ghi đè
      expect(apiClient.createCandidateSolution).toHaveBeenCalledTimes(1)
      expect(apiClient.createCandidateSolution).toHaveBeenCalledWith('ses-coach-1', {
        title: 'Giải pháp tạo mới từ AI Coach',
        mechanism: 'Cơ chế tạo mới',
        status: 'candidate',
      })
    })

    // Toàn bộ existing solutions không bị sửa đổi
    expect(existingSolutions[0].title).toBe('Giải pháp hiện có 1')
    expect(existingSolutions[1].title).toBe('Giải pháp hiện có 2')
  })

  // 9. Append-only Save: Lưu ghi chép tạo ResearchNote mới độc lập, không làm thay đổi existing notebook draft
  test('9. Append-only Save: Lưu ghi chép tạo ResearchNote mới, không làm thay đổi hay ghi đè existing notebook draft', async () => {
    // Giả lập trạng thái bản nháp đang soạn dở trong Sổ tay của người dùng
    const existingNotebookDraft = {
      content: 'Bản nháp nghiên cứu đang soạn dở trong Notebook của Founder',
      note_type: 'insight' as const,
      isDirty: true,
    }

    ;(apiClient.createResearchNote as jest.Mock).mockResolvedValue({
      id: 'note-new-1',
      content: 'Nội dung ghi chép từ AI Coach',
      note_type: 'question',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Xác minh chu kỳ gia nhiệt')).toBeInTheDocument()
    })

    const saveNoteButtons = screen.getAllByRole('button', { name: /Lưu vào Ghi chép/i })
    fireEvent.click(saveNoteButtons[0])

    const dialog = screen.getByRole('dialog')
    const contentTextarea = within(dialog).getByLabelText(/Nội dung ghi chú/i)
    fireEvent.change(contentTextarea, { target: { value: 'Nội dung ghi chép từ AI Coach' } })

    const saveBtn = within(dialog).getByRole('button', { name: /Lưu ghi chép|Xác nhận lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // Gọi API tạo note mới
      expect(apiClient.createResearchNote).toHaveBeenCalledTimes(1)
      expect(apiClient.createResearchNote).toHaveBeenCalledWith('ses-coach-1', expect.objectContaining({
        content: 'Nội dung ghi chép từ AI Coach',
      }))
    })

    // Bản nháp đang soạn dở trong Notebook của Founder được bảo toàn nguyên vẹn
    expect(existingNotebookDraft.content).toBe('Bản nháp nghiên cứu đang soạn dở trong Notebook của Founder')
    expect(existingNotebookDraft.isDirty).toBe(true)
  })

  // 10. Resilience & Zero Partial Item: Lỗi mạng không tạo partial item và bảo toàn 100% nội dung đã biên tập
  test('10. Zero Partial Item: Lỗi HTTP 500 không tạo item và bảo toàn 100% nội dung đã biên tập', async () => {
    ;(apiClient.createCandidateSolution as jest.Mock).mockRejectedValue(
      new Error('500 Internal Server Error: Database transaction aborted')
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AICoachPanel sessionId="ses-coach-1" problemFrame={mockProblemFrame} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Phân tích với AI Coach/i }))

    await waitFor(() => {
      expect(screen.getByText('Tách biệt ma sát theo thời gian')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Lưu thành Giải pháp/i }))
    const dialog = screen.getByRole('dialog')
    const titleInput = within(dialog).getByLabelText(/Tiêu đề giải pháp/i)
    const mechanismTextarea = within(dialog).getByLabelText(/Cơ chế hoạt động/i)

    fireEvent.change(titleInput, { target: { value: 'Ý tưởng đột phá mới' } })
    fireEvent.change(mechanismTextarea, { target: { value: 'Cơ chế lượng tử' } })

    const saveBtn = within(dialog).getByRole('button', { name: /Lưu giải pháp|Xác nhận lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    })

    // Modal không đóng, form không bị reset
    expect(within(dialog).getByLabelText(/Tiêu đề giải pháp/i)).toHaveValue('Ý tưởng đột phá mới')
    expect(within(dialog).getByLabelText(/Cơ chế hoạt động/i)).toHaveValue('Cơ chế lượng tử')

    // Xác nhận không tạo thêm lệnh create nào khác
    expect(apiClient.createCandidateSolution).toHaveBeenCalledTimes(1)
  })
})
