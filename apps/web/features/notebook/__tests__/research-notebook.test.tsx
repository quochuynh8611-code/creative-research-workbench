/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchNotebook } from '../research-notebook'
import * as apiClient from '@/lib/api-client'
import type { ResearchNotesResponse, ResearchNote, NoteType } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listResearchNotes: jest.fn(),
  createResearchNote: jest.fn(),
  deleteResearchNote: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const MOCK_NOTES: ResearchNote[] = [
  {
    id: 'note-001',
    session_id: 'ses-123',
    content: 'Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong',
    note_type: 'insight',
    source_chunk_id: null,
    created_at: '2026-10-01T08:30:00Z',
  },
  {
    id: 'note-002',
    session_id: 'ses-123',
    content: 'Thử nghiệm phủ lớp graphene đa tầng',
    note_type: 'hypothesis',
    source_chunk_id: 'chk-999',
    created_at: '2026-10-01T09:00:00Z',
  },
]

const defaultProps = {
  sessionId: 'ses-123',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('ResearchNotebook Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 1. Render notes list
  it('1. render danh sách ghi chú với đầy đủ nội dung, phân loại và ngày tạo', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(apiClient.listResearchNotes).toHaveBeenCalledWith('ses-123')

    expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
    expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
    expect(screen.getByText('Insight')).toBeInTheDocument()
    expect(screen.getByText('Hypothesis')).toBeInTheDocument()
  })

  // 2. Create note successfully & form reset
  it('2. tạo ghi chú mới thành công, gọi API và thông báo onNoteCreated (không tự reset controlled content)', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [MOCK_NOTES[0]],
      meta: { total: 1 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

    const newNote: ResearchNote = {
      id: 'note-003',
      session_id: 'ses-123',
      content: 'Cần xác nhận lại kết quả đo nhiệt lượng',
      note_type: 'action',
      source_chunk_id: null,
      created_at: '2026-10-01T10:00:00Z',
    }
    ;(apiClient.createResearchNote as jest.Mock).mockResolvedValueOnce(newNote)

    const onContentChangeMock = jest.fn()
    const onNoteTypeChangeMock = jest.fn()
    const onClearDraftMock = jest.fn()
    const onNoteCreatedMock = jest.fn()

    function TestHarness() {
      const [content, setContent] = React.useState('')
      const [noteType, setNoteType] = React.useState<NoteType>('insight')
      return (
        <ResearchNotebook
          {...defaultProps}
          sessionId="ses-123"
          content={content}
          noteType={noteType}
          onContentChange={(val) => {
            setContent(val)
            onContentChangeMock(val)
          }}
          onNoteTypeChange={(val) => {
            setNoteType(val)
            onNoteTypeChangeMock(val)
          }}
          onClearDraft={onClearDraftMock}
          onNoteCreated={onNoteCreatedMock}
        />
      )
    }

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <TestHarness />
      </QueryClientProvider>
    )

    await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')

    const textarea = screen.getByPlaceholderText(/nhập ghi chú|nội dung ghi chú/i)
    const select = screen.getByLabelText(/loại ghi chú|phân loại/i) || screen.getByRole('combobox')
    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })

    fireEvent.change(textarea, { target: { value: 'Cần xác nhận lại kết quả đo nhiệt lượng' } })
    expect(onContentChangeMock).toHaveBeenCalledWith('Cần xác nhận lại kết quả đo nhiệt lượng')
    fireEvent.change(select, { target: { value: 'action' } })
    expect(onNoteTypeChangeMock).toHaveBeenCalledWith('action')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiClient.createResearchNote).toHaveBeenCalledWith('ses-123', {
        content: 'Cần xác nhận lại kết quả đo nhiệt lượng',
        note_type: 'action',
      })
    })

    expect(onNoteCreatedMock).toHaveBeenCalledTimes(1)
    expect(onClearDraftMock).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Cần xác nhận lại kết quả đo nhiệt lượng')
  })

  // 3. Delete note
  it('3. xóa ghi chú gọi deleteResearchNote với đúng session_id và note_id', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.deleteResearchNote as jest.Mock).mockResolvedValueOnce({
      status: 'deleted',
      id: 'note-001',
      session_id: 'ses-123',
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} sessionId="ses-123" />
      </QueryClientProvider>
    )

    await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')

    const deleteBtns = screen.getAllByRole('button', { name: /xóa|delete/i })
    fireEvent.click(deleteBtns[0])

    await waitFor(() => {
      expect(apiClient.deleteResearchNote).toHaveBeenCalledWith('ses-123', 'note-001')
    })
  })

  // 4. Blank validation
  it('4. validate nội dung rỗng hiển thị lỗi cục bộ và không gọi API', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const onContentChangeMock = jest.fn()
    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          {...defaultProps}
          sessionId="ses-123"
          content="   "
          onContentChange={onContentChangeMock}
        />
      </QueryClientProvider>
    )

    await screen.findByText(/chưa có ghi chú nào/i)

    const textarea = screen.getByPlaceholderText(/nhập ghi chú|nội dung ghi chú/i)
    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })

    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(submitBtn)

    expect(apiClient.createResearchNote).not.toHaveBeenCalled()
    expect(screen.getByText(/vui lòng nhập nội dung/i)).toBeInTheDocument()
  })

  // 5. Empty state
  it('5. hiển thị empty state khi chưa có ghi chú nào', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/chưa có ghi chú nào/i)).toBeInTheDocument()
  })

  // 6. Local error fallback & retry
  it('6. hiển thị banner lỗi cục bộ và cho phép thử lại khi tải thất bại', async () => {
    ;(apiClient.listResearchNotes as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} sessionId="ses-123" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/không thể tải danh sách ghi chú/i)).toBeInTheDocument()

    // Retry
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValueOnce(mockResponse)

    const retryBtn = screen.getByRole('button', { name: /thử lại|retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
  })

  // 7. InitialDraft prefill and clear
  it('7. nhận initialDraft, điền sẵn vào form compose và gọi onClearDraft sau khi lưu thành công', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.createResearchNote as jest.Mock).mockResolvedValueOnce({
      id: 'note-004',
      session_id: 'ses-123',
      content: 'Trích dẫn từ ADR-001 về kiến trúc',
      note_type: 'insight',
      source_chunk_id: 'chk-001',
      created_at: '2026-10-01T11:00:00Z',
    })

    const onClearDraftMock = jest.fn()
    const onNoteCreatedMock = jest.fn()
    const draft = {
      content: 'Trích dẫn từ ADR-001 về kiến trúc',
      note_type: 'insight' as const,
      source_chunk_id: 'chk-001',
    }

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          {...defaultProps}
          sessionId="ses-123"
          initialDraft={draft}
          content={draft.content}
          noteType={draft.note_type}
          onClearDraft={onClearDraftMock}
          onNoteCreated={onNoteCreatedMock}
        />
      </QueryClientProvider>
    )

    await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')

    const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
    expect(textarea).toHaveValue('Trích dẫn từ ADR-001 về kiến trúc')

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú|thêm ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiClient.createResearchNote).toHaveBeenCalledWith('ses-123', {
        content: 'Trích dẫn từ ADR-001 về kiến trúc',
        note_type: 'insight',
        source_chunk_id: 'chk-001',
      })
      expect(onNoteCreatedMock).toHaveBeenCalledTimes(1)
      expect(onClearDraftMock).not.toHaveBeenCalled()
      expect(textarea).toHaveValue('Trích dẫn từ ADR-001 về kiến trúc')
    })
  })

  // 8. Draft Banner indicator and Discard draft button
  it('8. hiển thị draft banner khi có initialDraft và gọi onClearDraft + xóa text khi bấm Hủy nháp', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: MOCK_NOTES,
      meta: { total: 2 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    const onClearDraftMock = jest.fn()
    const draft = {
      content: '[Nguyên tắc sáng tạo #35: Parameter changes]\nThay đổi thông số vật lý',
      note_type: 'hypothesis' as const,
    }

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          {...defaultProps}
          sessionId="ses-123"
          initialDraft={draft}
          content={draft.content}
          noteType={draft.note_type}
          onClearDraft={onClearDraftMock}
        />
      </QueryClientProvider>
    )

    await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')

    // Draft banner indicator
    expect(screen.getByText(/đang soạn thảo từ bản nháp/i)).toBeInTheDocument()
    const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
    expect(textarea).toHaveValue(draft.content)

    // Discard draft button
    const clearDraftBtn = screen.getByRole('button', { name: /hủy nháp|xóa bản nháp/i })
    fireEvent.click(clearDraftBtn)

    expect(onClearDraftMock).toHaveBeenCalled()
  })

  // 9. Preserve draft content on API failure
  it('9. giữ nguyên nội dung ghi chú trong textarea khi API tạo ghi chú thất bại để người dùng có thể thử lại', async () => {
    const mockResponse: ResearchNotesResponse = {
      data: [],
      meta: { total: 0 },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
    ;(apiClient.createResearchNote as jest.Mock).mockRejectedValueOnce(new Error('Lỗi máy chủ 500'))

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          {...defaultProps}
          sessionId="ses-123"
          content="Ghi chú quan trọng cần thử lại"
          noteType="insight"
        />
      </QueryClientProvider>
    )

    await screen.findByText(/chưa có ghi chú nào/i)

    const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Lỗi máy chủ 500/i)).toBeInTheDocument()
    })

    // Content should be preserved, not wiped
    expect(textarea).toHaveValue('Ghi chú quan trọng cần thử lại')
  })

  describe('10. Batch C4a — Controlled Notebook Form & State Preservation', () => {
    it('1. test_renders_controlled_content_value: hiển thị nội dung textarea và note type theo controlled props từ SessionDetail', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: null,
              content: 'Nội dung do SessionDetail quản lý',
              noteType: 'hypothesis',
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
      expect(textarea).toHaveValue('Nội dung do SessionDetail quản lý')
      const select = screen.getByLabelText(/loại ghi chú/i)
      expect(select).toHaveValue('hypothesis')
    })

    it('2. test_calls_on_content_change_when_the_user_edits_content: gọi callback onContentChange khi người dùng gõ vào textarea', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
      const onContentChange = jest.fn()

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: null,
              content: '',
              noteType: 'insight',
              onContentChange,
              onNoteTypeChange: jest.fn(),
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
      fireEvent.change(textarea, { target: { value: 'Nội dung mới đang gõ' } })
      expect(onContentChange).toHaveBeenCalledWith('Nội dung mới đang gõ')
    })

    it('3. test_calls_on_note_type_change_when_the_user_changes_note_type: gọi callback onNoteTypeChange khi người dùng thay đổi combobox', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
      const onNoteTypeChange = jest.fn()

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: null,
              content: '',
              noteType: 'insight',
              onContentChange: jest.fn(),
              onNoteTypeChange,
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      const select = screen.getByLabelText(/loại ghi chú/i)
      fireEvent.change(select, { target: { value: 'decision' } })
      expect(onNoteTypeChange).toHaveBeenCalledWith('decision')
    })

    it('4. test_does_not_retain_internal_content_state_across_remounts: không lưu giữ bản sao state nội bộ khi remount với props mới', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const queryClient = createTestQueryClient()
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: null,
              content: 'Nội dung lần 1',
              noteType: 'insight',
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      unmount()

      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: null,
              content: 'Nội dung mới hoàn toàn từ SessionDetail',
              noteType: 'insight',
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
      expect(textarea).toHaveValue('Nội dung mới hoàn toàn từ SessionDetail')
    })

    it('5. test_loads_a_new_initial_draft_through_controlled_props: nạp initialDraft mới đồng bộ qua controlled props', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const draft = {
        content: '[TRIZ 9-Windows: Kỹ thuật • Siêu hệ thống]\nGóc nhìn vĩ mô',
        note_type: 'insight' as const,
        source_chunk_id: null,
      }

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: draft,
              content: draft.content,
              noteType: draft.note_type,
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      expect(screen.getByText(/đang soạn thảo từ bản nháp/i)).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
      expect(textarea).toHaveValue(draft.content)
    })

    it('6. test_calls_on_clear_draft_when_user_clicks_discard_draft_button: gọi onClearDraft khi người dùng bấm nút Hủy nháp', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
      const onClearDraft = jest.fn()

      const draft = {
        content: 'Bản nháp sắp bị hủy',
        note_type: 'insight' as const,
      }

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: draft,
              content: draft.content,
              noteType: draft.note_type,
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft,
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      const discardBtn = screen.getByRole('button', { name: /hủy nháp/i })
      fireEvent.click(discardBtn)
      expect(onClearDraft).toHaveBeenCalled()
    })

    it('7. test_calls_on_note_created_after_successful_note_creation: gọi onNoteCreated đúng một lần sau khi lưu thành công', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)
      ;(apiClient.createResearchNote as jest.Mock).mockResolvedValueOnce({
        id: 'note-persisted',
        session_id: 'ses-123',
        content: 'Ghi chú đã được lưu vào backend',
        note_type: 'insight',
        source_chunk_id: null,
        created_at: '2026-11-12T00:00:00Z',
      })
      const onClearDraft = jest.fn()
      const onNoteCreated = jest.fn()

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: { content: 'Ghi chú đã được lưu vào backend', note_type: 'insight' },
              content: 'Ghi chú đã được lưu vào backend',
              noteType: 'insight',
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft,
              onNoteCreated,
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(apiClient.createResearchNote).toHaveBeenCalled()
      })

      // onNoteCreated được gọi đúng 1 lần sau khi createNoteMutation thành công
      expect(onNoteCreated).toHaveBeenCalledTimes(1)
      // onClearDraft KHÔNG được gọi trong luồng lưu thành công
      expect(onClearDraft).not.toHaveBeenCalled()
      // content và noteType không bị component tự reset (vẫn do controlled props giữ)
      const textarea = screen.getByPlaceholderText(/nhập ghi chú/i)
      expect(textarea).toHaveValue('Ghi chú đã được lưu vào backend')
      const select = screen.getByLabelText(/loại ghi chú/i)
      expect(select).toHaveValue('insight')
    })

    it('8. test_preserves_validation_and_submit_behavior: bảo toàn cơ chế validation rỗng và submit hợp lệ', async () => {
      const mockResponse: ResearchNotesResponse = { data: [], meta: { total: 0 } }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const queryClient = createTestQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            {...({
              sessionId: 'ses-123',
              initialDraft: null,
              content: '   ',
              noteType: 'question',
              onContentChange: jest.fn(),
              onNoteTypeChange: jest.fn(),
              onClearDraft: jest.fn(),
              onNoteCreated: jest.fn(),
            } as any)}
          />
        </QueryClientProvider>
      )

      await screen.findByText(/chưa có ghi chú nào/i)
      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      expect(screen.getByText('Vui lòng nhập nội dung ghi chú')).toBeInTheDocument()
      expect(apiClient.createResearchNote).not.toHaveBeenCalled()
    })
  })

  describe('Batch C7a — Notebook Organization (Filter & Search)', () => {
    const C7A_NOTES: ResearchNote[] = [
      {
        id: 'c7a-1',
        session_id: 'ses-c7a',
        content: 'Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong',
        note_type: 'insight',
        source_chunk_id: null,
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'c7a-2',
        session_id: 'ses-c7a',
        content: 'Thử nghiệm phủ lớp graphene đa tầng',
        note_type: 'hypothesis',
        source_chunk_id: null,
        created_at: '2026-10-01T09:00:00Z',
      },
      {
        id: 'c7a-3',
        session_id: 'ses-c7a',
        content: 'Chấp nhận phương án vật liệu composite tổ ong',
        note_type: 'decision',
        source_chunk_id: null,
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'c7a-4',
        session_id: 'ses-c7a',
        content: 'Khả năng chịu nhiệt của graphene là bao nhiêu?',
        note_type: 'question',
        source_chunk_id: null,
        created_at: '2026-10-01T11:00:00Z',
      },
      {
        id: 'c7a-5',
        session_id: 'ses-c7a',
        content: 'Đặt hàng mẫu thử nghiệm tổ ong độ bền cao',
        note_type: 'action',
        source_chunk_id: null,
        created_at: '2026-10-01T12:00:00Z',
      },
      {
        id: 'c7a-6',
        session_id: 'ses-c7a',
        content: 'Quan sát thấy cấu trúc tổ ong có độ giãn nở nhiệt thấp',
        note_type: 'insight',
        source_chunk_id: null,
        created_at: '2026-10-01T13:00:00Z',
      },
      {
        id: 'c7a-7',
        session_id: 'ses-c7a',
        content: 'Giả định rằng graphene làm tăng tính dẫn điện',
        note_type: 'hypothesis',
        source_chunk_id: null,
        created_at: '2026-10-01T14:00:00Z',
      },
    ]

    function renderNotebookWithNotes(notes: ResearchNote[] = C7A_NOTES, customProps = {}) {
      const mockResponse: ResearchNotesResponse = {
        data: notes,
        meta: { total: notes.length },
      }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const queryClient = createTestQueryClient()
      const props = {
        ...defaultProps,
        sessionId: 'ses-c7a',
        ...customProps,
      }

      const utils = render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook {...props} />
        </QueryClientProvider>
      )
      return { ...utils, queryClient }
    }

    it('1. renders notebook filter options with correct counters', async () => {
      renderNotebookWithNotes()

      // Chờ dữ liệu load xong
      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const allBtn = screen.getByRole('button', { name: /tất cả/i })
      const insightBtn = screen.getByRole('button', { name: /insight/i })
      const hypothesisBtn = screen.getByRole('button', { name: /hypothesis/i })
      const decisionBtn = screen.getByRole('button', { name: /decision/i })
      const questionBtn = screen.getByRole('button', { name: /question/i })
      const actionBtn = screen.getByRole('button', { name: /action/i })

      expect(allBtn).toHaveTextContent('7')
      expect(insightBtn).toHaveTextContent('2')
      expect(hypothesisBtn).toHaveTextContent('2')
      expect(decisionBtn).toHaveTextContent('1')
      expect(questionBtn).toHaveTextContent('1')
      expect(actionBtn).toHaveTextContent('1')
    })

    it('2. filters notes by insight type', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const insightBtn = screen.getByRole('button', { name: /insight/i })
      fireEvent.click(insightBtn)

      // 2 insight notes hiển thị
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Quan sát thấy cấu trúc tổ ong có độ giãn nở nhiệt thấp')).toBeInTheDocument()

      // Các loại khác bị ẩn
      expect(screen.queryByText('Thử nghiệm phủ lớp graphene đa tầng')).not.toBeInTheDocument()
      expect(screen.queryByText('Chấp nhận phương án vật liệu composite tổ ong')).not.toBeInTheDocument()
      expect(screen.queryByText('Khả năng chịu nhiệt của graphene là bao nhiêu?')).not.toBeInTheDocument()
      expect(screen.queryByText('Đặt hàng mẫu thử nghiệm tổ ong độ bền cao')).not.toBeInTheDocument()
    })

    it('3. filters notes by hypothesis type', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const hypothesisBtn = screen.getByRole('button', { name: /hypothesis/i })
      fireEvent.click(hypothesisBtn)

      // 2 hypothesis notes hiển thị
      expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
      expect(screen.getByText('Giả định rằng graphene làm tăng tính dẫn điện')).toBeInTheDocument()

      // Các loại khác bị ẩn
      expect(screen.queryByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).not.toBeInTheDocument()
      expect(screen.queryByText('Chấp nhận phương án vật liệu composite tổ ong')).not.toBeInTheDocument()
    })

    it('4. filters notes by decision type', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const decisionBtn = screen.getByRole('button', { name: /decision/i })
      fireEvent.click(decisionBtn)

      expect(screen.getByText('Chấp nhận phương án vật liệu composite tổ ong')).toBeInTheDocument()
      expect(screen.queryByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).not.toBeInTheDocument()
      expect(screen.queryByText('Thử nghiệm phủ lớp graphene đa tầng')).not.toBeInTheDocument()
    })

    it('5. filters notes by question type', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const questionBtn = screen.getByRole('button', { name: /question/i })
      fireEvent.click(questionBtn)

      expect(screen.getByText('Khả năng chịu nhiệt của graphene là bao nhiêu?')).toBeInTheDocument()
      expect(screen.queryByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).not.toBeInTheDocument()
    })

    it('6. filters notes by action type', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const actionBtn = screen.getByRole('button', { name: /action/i })
      fireEvent.click(actionBtn)

      expect(screen.getByText('Đặt hàng mẫu thử nghiệm tổ ong độ bền cao')).toBeInTheDocument()
      expect(screen.queryByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).not.toBeInTheDocument()
    })

    it('7. shows all notes when all filter is selected', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      // Lọc theo insight trước
      fireEvent.click(screen.getByRole('button', { name: /insight/i }))
      expect(screen.queryByText('Thử nghiệm phủ lớp graphene đa tầng')).not.toBeInTheDocument()

      // Chọn lại Tất cả
      fireEvent.click(screen.getByRole('button', { name: /tất cả/i }))

      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
      expect(screen.getByText('Chấp nhận phương án vật liệu composite tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Khả năng chịu nhiệt của graphene là bao nhiêu?')).toBeInTheDocument()
      expect(screen.getByText('Đặt hàng mẫu thử nghiệm tổ ong độ bền cao')).toBeInTheDocument()
      expect(screen.getByText('Quan sát thấy cấu trúc tổ ong có độ giãn nở nhiệt thấp')).toBeInTheDocument()
      expect(screen.getByText('Giả định rằng graphene làm tăng tính dẫn điện')).toBeInTheDocument()
    })

    it('8. searches notes by content case-insensitively', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
      fireEvent.change(searchInput, { target: { value: 'TỔ ONG' } })

      // 4 ghi chú chứa "tổ ong" hiển thị
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Chấp nhận phương án vật liệu composite tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Đặt hàng mẫu thử nghiệm tổ ong độ bền cao')).toBeInTheDocument()
      expect(screen.getByText('Quan sát thấy cấu trúc tổ ong có độ giãn nở nhiệt thấp')).toBeInTheDocument()

      // Các ghi chú không chứa "tổ ong" bị ẩn
      expect(screen.queryByText('Thử nghiệm phủ lớp graphene đa tầng')).not.toBeInTheDocument()
      expect(screen.queryByText('Khả năng chịu nhiệt của graphene là bao nhiêu?')).not.toBeInTheDocument()
      expect(screen.queryByText('Giả định rằng graphene làm tăng tính dẫn điện')).not.toBeInTheDocument()
    })

    it('9. shows empty filter state when no note matches search', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
      fireEvent.change(searchInput, { target: { value: 'từ khóa không hề tồn tại 99999' } })

      expect(screen.getByText(/không tìm thấy ghi chú phù hợp với bộ lọc/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /xóa bộ lọc/i })).toBeInTheDocument()
    })

    it('10. combines type filter and search query with logical AND', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      // Chọn loại Hypothesis
      const hypothesisBtn = screen.getByRole('button', { name: /hypothesis/i })
      fireEvent.click(hypothesisBtn)

      // Tìm kiếm từ khóa "graphene"
      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
      fireEvent.change(searchInput, { target: { value: 'graphene' } })

      // 2 hypothesis note chứa graphene được hiển thị
      expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
      expect(screen.getByText('Giả định rằng graphene làm tăng tính dẫn điện')).toBeInTheDocument()

      // Ghi chú Question cũng chứa "graphene" nhưng bị loại vì khác type
      expect(screen.queryByText('Khả năng chịu nhiệt của graphene là bao nhiêu?')).not.toBeInTheDocument()
      // Ghi chú insight bị loại
      expect(screen.queryByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).not.toBeInTheDocument()

      // Tiếp tục chuyển sang loại Decision với từ khóa "graphene" (không có kết quả)
      const decisionBtn = screen.getByRole('button', { name: /decision/i })
      fireEvent.click(decisionBtn)

      expect(screen.getByText(/không tìm thấy ghi chú phù hợp với bộ lọc/i)).toBeInTheDocument()
    })

    it('11. resets filter and search when clear filters is clicked', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      // Đặt bộ lọc Decision và search không khớp
      fireEvent.click(screen.getByRole('button', { name: /decision/i }))
      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i) as HTMLInputElement
      fireEvent.change(searchInput, { target: { value: 'graphene' } })

      expect(screen.getByText(/không tìm thấy ghi chú phù hợp với bộ lọc/i)).toBeInTheDocument()

      // Nhấn Xóa bộ lọc
      const clearBtn = screen.getByRole('button', { name: /xóa bộ lọc/i })
      fireEvent.click(clearBtn)

      // Ô tìm kiếm rỗng
      expect(searchInput.value).toBe('')

      // Toàn bộ 7 notes xuất hiện trở lại
      expect(screen.getByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()
      expect(screen.getByText('Chấp nhận phương án vật liệu composite tổ ong')).toBeInTheDocument()
      expect(screen.getByText('Khả năng chịu nhiệt của graphene là bao nhiêu?')).toBeInTheDocument()
      expect(screen.getByText('Đặt hàng mẫu thử nghiệm tổ ong độ bền cao')).toBeInTheDocument()
      expect(screen.getByText('Quan sát thấy cấu trúc tổ ong có độ giãn nở nhiệt thấp')).toBeInTheDocument()
      expect(screen.getByText('Giả định rằng graphene làm tăng tính dẫn điện')).toBeInTheDocument()
    })

    it('12. keeps type counters stable while search query changes', async () => {
      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
      fireEvent.change(searchInput, { target: { value: 'graphene' } })

      // Dù chỉ có 3 note khớp search, counters của các loại vẫn giữ nguyên theo toàn bộ session
      const allBtn = screen.getByRole('button', { name: /tất cả/i })
      const insightBtn = screen.getByRole('button', { name: /insight/i })
      const hypothesisBtn = screen.getByRole('button', { name: /hypothesis/i })
      const decisionBtn = screen.getByRole('button', { name: /decision/i })
      const questionBtn = screen.getByRole('button', { name: /question/i })
      const actionBtn = screen.getByRole('button', { name: /action/i })

      expect(allBtn).toHaveTextContent('7')
      expect(insightBtn).toHaveTextContent('2')
      expect(hypothesisBtn).toHaveTextContent('2')
      expect(decisionBtn).toHaveTextContent('1')
      expect(questionBtn).toHaveTextContent('1')
      expect(actionBtn).toHaveTextContent('1')
    })

    it('13. preserves existing note creation behavior', async () => {
      const onNoteCreated = jest.fn()
      ;(apiClient.createResearchNote as jest.Mock).mockResolvedValueOnce({
        id: 'new-note',
        session_id: 'ses-c7a',
        content: 'Ghi chú mới tạo',
        note_type: 'insight',
        created_at: '2026-10-01T15:00:00Z',
      })

      renderNotebookWithNotes(C7A_NOTES, {
        content: 'Ghi chú mới tạo',
        noteType: 'insight',
        onNoteCreated,
      })

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(apiClient.createResearchNote).toHaveBeenCalledWith('ses-c7a', {
          content: 'Ghi chú mới tạo',
          note_type: 'insight',
        })
      })
      expect(onNoteCreated).toHaveBeenCalledTimes(1)
    })

    it('14. preserves existing note deletion behavior', async () => {
      ;(apiClient.deleteResearchNote as jest.Mock).mockResolvedValueOnce({
        status: 'success',
        id: 'c7a-1',
        session_id: 'ses-c7a',
      })

      renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      const deleteButtons = screen.getAllByRole('button', { name: /xóa ghi chú/i })
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(apiClient.deleteResearchNote).toHaveBeenCalledWith('ses-c7a', 'c7a-1')
      })
    })

    it('15. preserves existing draft banner and controlled content behavior', async () => {
      const onClearDraft = jest.fn()

      renderNotebookWithNotes(C7A_NOTES, {
        initialDraft: { content: 'Bản nháp gợi ý', note_type: 'hypothesis' },
        content: 'Bản nháp gợi ý',
        noteType: 'hypothesis',
        onClearDraft,
      })

      expect(await screen.findByText(/đang soạn thảo từ bản nháp gợi ý/i)).toBeInTheDocument()

      const discardBtn = screen.getByRole('button', { name: /hủy nháp/i })
      fireEvent.click(discardBtn)

      expect(onClearDraft).toHaveBeenCalledTimes(1)
    })

    it('16. does not persist filter or search state', async () => {
      const localGetSpy = jest.spyOn(Storage.prototype, 'getItem')
      const localSetSpy = jest.spyOn(Storage.prototype, 'setItem')

      const { unmount } = renderNotebookWithNotes()

      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()

      // Không đọc storage khi mount
      expect(localGetSpy).not.toHaveBeenCalledWith(expect.stringMatching(/notebook.*filter|search/i))

      // Tìm kiếm và lọc
      const hypothesisBtn = screen.getByRole('button', { name: /hypothesis/i })
      fireEvent.click(hypothesisBtn)
      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
      fireEvent.change(searchInput, { target: { value: 'graphene' } })

      // Không ghi storage khi filter/search thay đổi
      expect(localSetSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/notebook.*filter|search/i),
        expect.anything()
      )

      unmount()

      // Mount lại và xác nhận mặc định là Tất cả và ô search rỗng
      renderNotebookWithNotes()
      expect(await screen.findByText('Phát hiện cơ chế phân tán nhiệt qua cấu trúc tổ ong')).toBeInTheDocument()
      const newSearchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i) as HTMLInputElement
      expect(newSearchInput.value).toBe('')
      expect(screen.getByText('Thử nghiệm phủ lớp graphene đa tầng')).toBeInTheDocument()

      localGetSpy.mockRestore()
      localSetSpy.mockRestore()
    })
  })

  describe('Batch C7b — Copy Note to Clipboard', () => {
    const originalClipboard = navigator.clipboard

    const C7B_NOTES: ResearchNote[] = [
      {
        id: 'c7b-1',
        session_id: 'ses-c7b',
        content: '\n   Phát hiện mâu thuẫn giữa độ bền và trọng lượng tại 500°C. \n\t   ',
        note_type: 'insight',
        source_chunk_id: null,
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'c7b-2',
        session_id: 'ses-c7b',
        content: 'Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.',
        note_type: 'decision',
        source_chunk_id: null,
        created_at: '2026-10-01T11:00:00Z',
      },
      {
        id: 'c7b-3',
        session_id: 'ses-c7b',
        content: 'Giả định rằng graphene làm tăng tính dẫn nhiệt đáng kể.',
        note_type: 'hypothesis',
        source_chunk_id: null,
        created_at: '2026-10-01T12:00:00Z',
      },
    ]

    function createDeferred<T>() {
      let resolve!: (val: T) => void
      let reject!: (err: any) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    function renderNotebookForC7b(notes: ResearchNote[] = C7B_NOTES, customProps = {}) {
      const mockResponse: ResearchNotesResponse = {
        data: notes,
        meta: { total: notes.length },
      }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const queryClient = createTestQueryClient()
      const props = {
        ...defaultProps,
        sessionId: 'ses-c7b',
        ...customProps,
      }

      const utils = render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook {...props} />
        </QueryClientProvider>
      )
      return { ...utils, queryClient }
    }

    function mockClipboard(writeTextFn?: any) {
      const clipboardObj = writeTextFn !== undefined ? { writeText: writeTextFn } : undefined
      Object.defineProperty(navigator, 'clipboard', {
        value: clipboardObj,
        configurable: true,
        writable: true,
      })
    }

    afterEach(() => {
      jest.useRealTimers()
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
        writable: true,
      })
    })

    it('1. renders copy button with distinct accessible name on each note card', async () => {
      mockClipboard(jest.fn().mockResolvedValue(undefined))
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn1 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' })
      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      const copyBtn3 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-3' })

      expect(copyBtn1).toHaveAttribute('type', 'button')
      expect(copyBtn2).toHaveAttribute('type', 'button')
      expect(copyBtn3).toHaveAttribute('type', 'button')
    })

    it('2. copies exact note content preserving leading/trailing whitespace, newlines, and unicode', async () => {
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText(/Phát hiện mâu thuẫn giữa độ bền và trọng lượng/i)).toBeInTheDocument()

      const copyBtn1 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' })
      fireEvent.click(copyBtn1)

      expect(mockWrite).toHaveBeenCalledTimes(1)
      expect(mockWrite).toHaveBeenCalledWith('\n   Phát hiện mâu thuẫn giữa độ bền và trọng lượng tại 500°C. \n\t   ')
    })

    it('3. does not show success feedback while clipboard Promise is pending', async () => {
      const deferred = createDeferred<void>()
      const mockWrite = jest.fn().mockReturnValue(deferred.promise)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      fireEvent.click(copyBtn2)

      expect(mockWrite).toHaveBeenCalledWith('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')
      // Khi pending: chưa hiển thị text "Đã chép"
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()

      // Giải quyết Promise
      await act(async () => {
        deferred.resolve()
      })

      // Sau khi resolve: hiển thị "Đã chép"
      expect(screen.getByText('Đã chép')).toBeInTheDocument()
    })

    it('4. displays success feedback on the target note card upon resolution', async () => {
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      fireEvent.click(copyBtn2)

      expect(await screen.findByText('Đã chép')).toBeInTheDocument()

      // Card 1 và Card 3 vẫn có nút sao chép bình thường
      expect(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-3' })).toBeInTheDocument()
    })

    it('5. success feedback remains before 2000ms and expires at 2000ms', async () => {
      jest.useFakeTimers()
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      // Chờ data load xong
      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn2)
      })

      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Tại 1999ms: vẫn còn "Đã chép"
      act(() => {
        jest.advanceTimersByTime(1999)
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Tại 2000ms: hết và trở về nút ban đầu
      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })).toBeInTheDocument()
    })

    it('6. displays error message and does not show success when writeText rejects', async () => {
      const mockWrite = jest.fn().mockRejectedValue(new Error('Permission denied'))
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn2)
      })

      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(await screen.findByText(/Không thể sao chép vào bộ nhớ tạm/i)).toBeInTheDocument()
    })

    it('7. handles missing navigator.clipboard safely with error message', async () => {
      mockClipboard(undefined)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn2)
      })

      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(await screen.findByText(/Trình duyệt không hỗ trợ sao chép/i)).toBeInTheDocument()
    })

    it('8. handles non-function writeText safely with error message', async () => {
      mockClipboard('not-a-function' as any)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn2)
      })

      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(await screen.findByText(/Trình duyệt không hỗ trợ sao chép/i)).toBeInTheDocument()
    })

    it('9. timer from note A does not clear feedback of note B when copied sequentially', async () => {
      jest.useFakeTimers()
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn1 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' })
      await act(async () => {
        fireEvent.click(copyBtn1)
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Sau 1000ms, user bấm copy note 2
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn2)
      })

      // Card 2 đang có "Đã chép"
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Trôi thêm 1000ms (tổng 2000ms tính từ lần bấm A): timer của A đã bị cancel nên KHÔNG được xóa feedback của B
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Trôi tiếp 1000ms nữa (đủ 2000ms của B): feedback của B mới hết
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
    })

    it('10. out-of-order resolution: A pending, B resolves first, A resolves later retains B feedback', async () => {
      const deferredA = createDeferred<void>()
      const deferredB = createDeferred<void>()

      const mockWrite = jest.fn().mockImplementation((content: string) => {
        if (content.includes('c7b-1') || content.includes('mâu thuẫn')) {
          return deferredA.promise
        }
        return deferredB.promise
      })
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Bấm note 1 (pending)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' }))
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()

      // Bấm note 2 (pending)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' }))

      // B resolve trước
      await act(async () => {
        deferredB.resolve()
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // A resolve muộn hơn
      await act(async () => {
        deferredA.resolve()
      })

      // Vẫn giữ feedback của B, không bị chuyển lại card 1
      expect(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' })).toBeInTheDocument()
      expect(screen.getByText('Đã chép')).toBeInTheDocument()
    })

    it('11. out-of-order resolution: A pending, B resolves, A rejects later retains B success', async () => {
      const deferredA = createDeferred<void>()
      const deferredB = createDeferred<void>()

      const mockWrite = jest.fn().mockImplementation((content: string) => {
        if (content.includes('c7b-1') || content.includes('mâu thuẫn')) {
          return deferredA.promise
        }
        return deferredB.promise
      })
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Bấm note 1 (pending)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' }))

      // Bấm note 2 (resolve)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' }))
      await act(async () => {
        deferredB.resolve()
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // A reject muộn hơn
      await act(async () => {
        deferredA.reject(new Error('Old operation rejected'))
      })

      // Phản hồi thành công của B không bị thay bằng lỗi của A
      expect(screen.queryByText(/Không thể sao chép vào bộ nhớ tạm/i)).not.toBeInTheDocument()
      expect(screen.getByText('Đã chép')).toBeInTheDocument()
    })

    it('12. out-of-order resolution: A pending, B rejects, A resolves later retains B error', async () => {
      const deferredA = createDeferred<void>()
      const deferredB = createDeferred<void>()

      const mockWrite = jest.fn().mockImplementation((content: string) => {
        if (content.includes('c7b-1') || content.includes('mâu thuẫn')) {
          return deferredA.promise
        }
        return deferredB.promise
      })
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Bấm note 1 (pending)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' }))

      // Bấm note 2 (reject)
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' }))
      await act(async () => {
        deferredB.reject(new Error('Permission denied'))
      })
      expect(await screen.findByText(/Không thể sao chép vào bộ nhớ tạm/i)).toBeInTheDocument()

      // A resolve muộn hơn
      await act(async () => {
        deferredA.resolve()
      })

      // Lỗi của B không bị thay bằng success của A
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(screen.getByText(/Không thể sao chép vào bộ nhớ tạm/i)).toBeInTheDocument()
    })

    it('13. unmount after success cancels timer cleanly', async () => {
      jest.useFakeTimers()
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)

      // QueryClient riêng với gcTime: Infinity để cô lập Query GC
      const isolatedQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
          mutations: { retry: false },
        },
      })

      const mockResponse: ResearchNotesResponse = {
        data: C7B_NOTES,
        meta: { total: C7B_NOTES.length },
      }
      ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout')

      const { unmount } = render(
        <QueryClientProvider client={isolatedQueryClient}>
          <ResearchNotebook {...defaultProps} sessionId="ses-c7b" />
        </QueryClientProvider>
      )

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn)
      })

      expect(screen.getByText('Đã chép')).toBeInTheDocument()
      // Có đúng 1 timer feedback đang chạy
      expect(jest.getTimerCount()).toBe(1)

      unmount()

      // Sau unmount: clearTimeout đã được gọi và timer count trở về 0
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(jest.getTimerCount()).toBe(0)

      clearTimeoutSpy.mockRestore()
    })

    it('14. unmount while pending does not create feedback timer upon resolution', async () => {
      jest.useFakeTimers()
      const deferred = createDeferred<void>()
      mockClipboard(jest.fn().mockReturnValue(deferred.promise))

      const { unmount } = renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      fireEvent.click(copyBtn)

      unmount()

      const timersBeforeResolve = jest.getTimerCount()

      // Resolve sau unmount
      await act(async () => {
        deferred.resolve()
      })

      // Không lập lịch feedback timer mới sau khi unmount
      expect(jest.getTimerCount()).toBe(timersBeforeResolve)
    })

    it('15. copies note accurately in filtered/searched list', async () => {
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Lọc theo search 'nguyên tắc'
      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
      fireEvent.change(searchInput, { target: { value: 'nguyên tắc' } })

      // Chỉ c7b-2 hiển thị
      expect(screen.queryByText(/Phát hiện mâu thuẫn/i)).not.toBeInTheDocument()
      expect(screen.getByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      fireEvent.click(copyBtn2)

      expect(mockWrite).toHaveBeenCalledWith('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')
      expect(await screen.findByText('Đã chép')).toBeInTheDocument()
    })

    it('16. copy does not invoke create or delete mutation', async () => {
      mockClipboard(jest.fn().mockResolvedValue(undefined))
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      fireEvent.click(copyBtn2)

      expect(apiClient.createResearchNote).not.toHaveBeenCalled()
      expect(apiClient.deleteResearchNote).not.toHaveBeenCalled()
    })

    it('17. copy preserves draft content, draft noteType, and filter/search inputs', async () => {
      mockClipboard(jest.fn().mockResolvedValue(undefined))
      const onContentChange = jest.fn()
      const onNoteTypeChange = jest.fn()

      renderNotebookForC7b(C7B_NOTES, {
        content: 'Bản nháp đang gõ dở...',
        noteType: 'decision',
        onContentChange,
        onNoteTypeChange,
      })

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Nhập từ khóa tìm kiếm
      const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i) as HTMLInputElement
      fireEvent.change(searchInput, { target: { value: 'kết cấu' } })

      // Click copy
      const copyBtn2 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      fireEvent.click(copyBtn2)

      // Draft form không bị thay đổi
      expect(onContentChange).not.toHaveBeenCalled()
      expect(onNoteTypeChange).not.toHaveBeenCalled()
      expect(searchInput.value).toBe('kết cấu')
    })

    it('18. hiding a card with active feedback via filter does not transfer feedback to another note', async () => {
      jest.useFakeTimers()
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Copy c7b-1 (insight)
      const copyBtn1 = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-1' })
      await act(async () => {
        fireEvent.click(copyBtn1)
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Lọc sang 'decision' (c7b-1 bị ẩn, chỉ c7b-2 hiển thị)
      const decisionBtn = screen.getByRole('button', { name: /decision/i })
      act(() => {
        fireEvent.click(decisionBtn)
      })

      // c7b-1 đã bị ẩn
      expect(screen.queryByText(/Phát hiện mâu thuẫn/i)).not.toBeInTheDocument()
      // Card c7b-2 hiển thị nút sao chép bình thường, tuyệt đối KHÔNG hiển thị "Đã chép"
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })).toBeInTheDocument()
    })

    it('19. preserves copy button during success feedback and allows re-copying same note before 2000ms', async () => {
      jest.useFakeTimers()
      const mockWrite = jest.fn().mockResolvedValue(undefined)
      mockClipboard(mockWrite)
      renderNotebookForC7b()

      expect(await screen.findByText('Quyết định áp dụng nguyên tắc phân chia 1 cho kết cấu vỏ.')).toBeInTheDocument()

      // Bấm copy lần 1
      const copyBtn = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      await act(async () => {
        fireEvent.click(copyBtn)
      })

      // Feedback "Đã chép" hiển thị
      expect(screen.getByText('Đã chép')).toBeInTheDocument()
      expect(mockWrite).toHaveBeenCalledTimes(1)

      // Nút copy vẫn tồn tại và dùng được (không bị thay thế)
      const reCopyBtn = screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })
      expect(reCopyBtn).toBeInTheDocument()

      // Sau 1000ms (trước khi timer 2000ms hết), bấm copy lại cùng note
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      await act(async () => {
        fireEvent.click(reCopyBtn)
      })

      // Gọi writeText lần thứ hai
      expect(mockWrite).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Trôi thêm 1000ms (tổng 2000ms từ lần bấm 1): feedback vẫn còn vì timer đã được reset theo lần bấm 2
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(screen.getByText('Đã chép')).toBeInTheDocument()

      // Trôi tiếp 1000ms nữa (đủ 2000ms từ lần bấm 2): feedback hết
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sao chép ghi chú c7b-2' })).toBeInTheDocument()
    })
  })
})
