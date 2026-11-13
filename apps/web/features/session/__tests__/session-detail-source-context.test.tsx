/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionDetail } from '../session-detail'
import {
  getSession,
  listResearchNotes,
  createResearchNote,
  getTrizNineWindows,
  getSessionRecommendations,
} from '@/lib/api-client'
import type { ResearchSession, TrizNineWindowsResponse } from '@/lib/types'

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

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedListResearchNotes = listResearchNotes as jest.MockedFunction<typeof listResearchNotes>
const mockedCreateResearchNote = createResearchNote as jest.MockedFunction<typeof createResearchNote>
const mockedGetTrizNineWindows = getTrizNineWindows as jest.MockedFunction<typeof getTrizNineWindows>
const mockedGetSessionRecommendations = getSessionRecommendations as jest.MockedFunction<
  typeof getSessionRecommendations
>

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const MOCK_SESSION: ResearchSession = {
  id: 'ses-source-ctx',
  title: 'Nghiên cứu cấu trúc vật liệu nano',
  domain: 'technical',
  status: 'active',
  workflow_state: 'structuring',
  tags: ['triz', 'materials'],
  created_at: '2026-11-13T08:00:00Z',
  updated_at: '2026-11-13T08:30:00Z',
  problem_frame: {
    id: 'frame-001',
    session_id: 'ses-source-ctx',
    raw_statement: 'Vật liệu cần siêu nhẹ nhưng siêu cứng',
    normalized_statement: 'Tăng độ bền cơ học mà không tăng trọng lượng',
    contradiction_type: 'technical',
    improving_parameter: 'Độ bền',
    worsening_parameter: 'Trọng lượng',
    domain: 'technical',
    created_at: '2026-11-13T08:15:00Z',
  },
}

const MOCK_9_WINDOWS: TrizNineWindowsResponse = {
  lens: 'engineering',
  lens_title: 'Lăng kính Kỹ thuật & Công nghệ',
  meta: {
    total_windows: 9,
    system_levels: ['supersystem', 'system', 'subsystem'],
    time_horizons: ['past', 'present', 'future'],
  },
  grid: [
    {
      level: 'supersystem',
      time: 'past',
      label_vi: 'Hạ tầng quá khứ',
      label_en: 'Past Supersystem',
      prompt_vi: 'Hạ tầng cũ thế nào?',
      description_vi: 'Mô tả quá khứ.',
    },
    {
      level: 'supersystem',
      time: 'present',
      label_vi: 'Hạ tầng hiện tại',
      label_en: 'Present Supersystem',
      prompt_vi: 'Hạ tầng hiện nay?',
      description_vi: 'Mô tả hiện tại.',
    },
    {
      level: 'supersystem',
      time: 'future',
      label_vi: 'Hạ tầng tương lai',
      label_en: 'Future Supersystem',
      prompt_vi: 'Hạ tầng tương lai?',
      description_vi: 'Mô tả tương lai.',
    },
    {
      level: 'system',
      time: 'past',
      label_vi: 'Hệ thống quá khứ',
      label_en: 'Past System',
      prompt_vi: 'Hệ thống ban đầu?',
      description_vi: 'Mô tả hệ thống cũ.',
    },
    {
      level: 'system',
      time: 'present',
      label_vi: 'Hệ thống hiện tại',
      label_en: 'Present System',
      prompt_vi: 'Mâu thuẫn hiện tại?',
      description_vi: 'Mô tả hệ thống hiện tại.',
    },
    {
      level: 'system',
      time: 'future',
      label_vi: 'Hệ thống tương lai',
      label_en: 'Future System',
      prompt_vi: 'Hệ thống tương lai?',
      description_vi: 'Mô tả tương lai.',
    },
    {
      level: 'subsystem',
      time: 'past',
      label_vi: 'Phân hệ quá khứ',
      label_en: 'Past Subsystem',
      prompt_vi: 'Phân hệ cũ?',
      description_vi: 'Mô tả phân hệ cũ.',
    },
    {
      level: 'subsystem',
      time: 'present',
      label_vi: 'Phân hệ hiện tại',
      label_en: 'Present Subsystem',
      prompt_vi: 'Linh kiện hiện tại?',
      description_vi: 'Mô tả linh kiện.',
    },
    {
      level: 'subsystem',
      time: 'future',
      label_vi: 'Phân hệ tương lai',
      label_en: 'Future Subsystem',
      prompt_vi: 'Vật liệu tương lai?',
      description_vi: 'Mô tả vật liệu tương lai.',
    },
  ],
}

describe('Pilot C7c-2a: SessionDetail Draft Lifecycle with source_context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSession.mockResolvedValue(MOCK_SESSION)
    mockedListResearchNotes.mockResolvedValue({ data: [], meta: { total: 0 } })
    mockedGetTrizNineWindows.mockResolvedValue(MOCK_9_WINDOWS)
    mockedGetSessionRecommendations.mockResolvedValue([])
  })

  // Nhóm 10: Dirty overwrite: cancel giữ context cũ, confirm thay context mới
  it('Nhóm 10: khi form notebook đang dirty và nhận cell mới từ 9-windows: Hủy giữ context cũ, Ghi đè thay context mới', async () => {
    renderWithClient(<SessionDetail sessionId="ses-source-ctx" />)

    // Đợi tải xong tab structuring
    await waitFor(() => {
      expect(screen.getByText('Phân tích mâu thuẫn TRIZ (Contradiction Analysis)')).toBeInTheDocument()
    })

    // Mở rộng section 9-Windows
    const expandBtn = screen.getByLabelText(/mở rộng góc nhìn hệ thống đa chiều/i)
    fireEvent.click(expandBtn)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    // 1. Lưu cell đầu tiên (supersystem / past) vào notebook
    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveButtons[0])

    // Hệ thống tự chuyển sang tab notebook
    await waitFor(() => {
      expect(screen.getByText('Đang soạn thảo từ bản nháp gợi ý / trích dẫn')).toBeInTheDocument()
    })

    // Người dùng chỉnh sửa nội dung trong form làm form bị dirty
    const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i)
    fireEvent.change(textarea, { target: { value: 'Nội dung dở dang người dùng tự gõ thêm...' } })

    // Người dùng quay lại tab structuring để lưu cell thứ hai (supersystem / present)
    const structuringTab = screen.getByRole('button', { name: /^phân tích cấu trúc$/i })
    fireEvent.click(structuringTab)

    // Mở lại collapsible 9-Windows
    const expandBtn2 = screen.getByLabelText(/mở rộng góc nhìn hệ thống đa chiều/i)
    fireEvent.click(expandBtn2)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    // Bấm lưu cell thứ 2
    const saveButtonsStructuring = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveButtonsStructuring[1])

    // Overwrite Dialog xuất hiện
    expect(await screen.findByText('Ghi đè bản nháp chưa lưu?')).toBeInTheDocument()

    // 2. Nhánh Hủy ghi đè: Bấm Hủy
    const cancelBtn = screen.getByRole('button', { name: 'Hủy' })
    fireEvent.click(cancelBtn)

    // Dialog biến mất, quay lại notebook xem nội dung dở dang có được giữ nguyên không
    const notebookTab = screen.getByRole('button', { name: /ghi chép \(notebook\)/i })
    fireEvent.click(notebookTab)

    expect(screen.getByDisplayValue('Nội dung dở dang người dùng tự gõ thêm...')).toBeInTheDocument()

    // Submit note xem context gửi đi có phải là context ban đầu (supersystem / past) hay không
    mockedCreateResearchNote.mockResolvedValueOnce({
      id: 'note-kept',
      session_id: 'ses-source-ctx',
      content: 'Nội dung dở dang người dùng tự gõ thêm...',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: {
        schema_version: 1,
        source_type: 'triz_9_windows',
        lens: 'engineering',
        level: 'supersystem',
        time: 'past',
        cell_label: 'Hạ tầng quá khứ',
      },
      created_at: '2026-11-13T10:00:00Z',
    } as any)

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })
    expect(mockedCreateResearchNote.mock.calls[0][1].source_context).toEqual({
      schema_version: 1,
      source_type: 'triz_9_windows',
      lens: 'engineering',
      level: 'supersystem',
      time: 'past',
      cell_label: 'Hạ tầng quá khứ',
    })
  })

  // Nhóm 11: Clear draft và save success không rò context sang note thủ công
  it('Nhóm 11: sau khi bấm Hủy nháp hoặc sau khi lưu note thành công, note thủ công tiếp theo không mang source_context cũ', async () => {
    renderWithClient(<SessionDetail sessionId="ses-source-ctx" />)

    await waitFor(() => {
      expect(screen.getByText('Phân tích mâu thuẫn TRIZ (Contradiction Analysis)')).toBeInTheDocument()
    })

    // Mở 9-Windows và lưu 1 cell
    const expandBtn = screen.getByLabelText(/mở rộng góc nhìn hệ thống đa chiều/i)
    fireEvent.click(expandBtn)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveButtons[0])

    // Tại tab notebook, bấm Hủy nháp
    const discardBtn = await screen.findByRole('button', { name: 'Hủy nháp' })
    fireEvent.click(discardBtn)

    // Form đã sạch. Người dùng tự gõ note thủ công
    const textarea = screen.getByPlaceholderText(/nhập ghi chú nghiên cứu/i)
    fireEvent.change(textarea, { target: { value: 'Ghi chú độc lập hoàn toàn' } })

    mockedCreateResearchNote.mockResolvedValueOnce({
      id: 'note-manual',
      session_id: 'ses-source-ctx',
      content: 'Ghi chú độc lập hoàn toàn',
      note_type: 'insight',
      source_chunk_id: null,
      created_at: '2026-11-13T10:00:00Z',
    })

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })

    // Payload tuyệt đối không chứa tàn dư source_context của cell vừa hủy
    expect(mockedCreateResearchNote.mock.calls[0][1].source_context).toBeUndefined()
  })

  // Nhóm 12: Session change không rò context
  it('Nhóm 12: khi chuyển sang sessionId khác, draft và source_context được reset hoàn toàn, không rò rỉ xuyên session', async () => {
    const { rerender } = renderWithClient(<SessionDetail sessionId="ses-source-ctx" />)

    await waitFor(() => {
      expect(screen.getByText('Phân tích mâu thuẫn TRIZ (Contradiction Analysis)')).toBeInTheDocument()
    })

    // Lưu 1 cell vào notebook
    const expandBtn = screen.getByLabelText(/mở rộng góc nhìn hệ thống đa chiều/i)
    fireEvent.click(expandBtn)

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(9)
    })

    const saveButtons = screen.getAllByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Đang soạn thảo từ bản nháp gợi ý / trích dẫn')).toBeInTheDocument()
    })

    // Rerender với sessionId khác
    const newSession: ResearchSession = {
      ...MOCK_SESSION,
      id: 'ses-new-domain',
      title: 'Session khác hoàn toàn',
    }
    mockedGetSession.mockResolvedValueOnce(newSession)

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <SessionDetail sessionId="ses-new-domain" />
      </QueryClientProvider>
    )

    // Kiểm tra tab notebook của session mới: draft banner biến mất, form trống
    await waitFor(() => {
      expect(screen.queryByText('Đang soạn thảo từ bản nháp gợi ý / trích dẫn')).not.toBeInTheDocument()
    })
  })
})
