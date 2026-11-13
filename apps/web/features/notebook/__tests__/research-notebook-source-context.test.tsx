/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchNotebook } from '../research-notebook'
import * as apiClient from '@/lib/api-client'
import type { NoteDraft, ResearchNote, NoteType } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listResearchNotes: jest.fn(),
  createResearchNote: jest.fn(),
  deleteResearchNote: jest.fn(),
}))

const mockedListResearchNotes = apiClient.listResearchNotes as jest.MockedFunction<
  typeof apiClient.listResearchNotes
>
const mockedCreateResearchNote = apiClient.createResearchNote as jest.MockedFunction<
  typeof apiClient.createResearchNote
>

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const VALID_9_WINDOWS_CONTEXT = {
  schema_version: 1 as const,
  source_type: 'triz_9_windows' as const,
  lens: 'engineering' as const,
  level: 'system' as const,
  time: 'present' as const,
  cell_label: 'Hệ thống kỹ thuật hiện tại',
}

describe('Pilot C7c-2a: ResearchNotebook source_context Submission & Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedListResearchNotes.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })
  })

  // Nhóm 6: Notebook submit chuyển context nguyên vẹn tới createResearchNote
  it('Nhóm 6: khi form có initialDraft kèm source_context, submit phải chuyển nguyên vẹn context tới createResearchNote', async () => {
    const draft: NoteDraft = {
      content: '[TRIZ 9-Windows: ...]\nNội dung mô tả...',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: VALID_9_WINDOWS_CONTEXT,
    } as any

    const createdNote: ResearchNote = {
      id: 'note-101',
      session_id: 'ses-123',
      content: draft.content,
      note_type: draft.note_type,
      source_chunk_id: null,
      source_context: VALID_9_WINDOWS_CONTEXT,
      created_at: '2026-11-13T10:00:00Z',
    } as any
    mockedCreateResearchNote.mockResolvedValueOnce(createdNote)

    const onNoteCreated = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={draft}
          content={draft.content}
          noteType={draft.note_type}
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={onNoteCreated}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })

    const callPayload = mockedCreateResearchNote.mock.calls[0][1]
    expect(callPayload).toHaveProperty('source_context')
    expect(callPayload.source_context).toEqual(VALID_9_WINDOWS_CONTEXT)
  })

  // Nhóm 7: Sửa content/note_type vẫn giữ context nguồn khởi đầu
  it('Nhóm 7: người dùng chỉnh sửa nội dung văn bản và đổi note_type nhưng source_context nguồn khởi đầu vẫn được giữ nguyên', async () => {
    const originalDraft: NoteDraft = {
      content: '[TRIZ 9-Windows: ...]\nNội dung ban đầu...',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: VALID_9_WINDOWS_CONTEXT,
    } as any

    const modifiedContent = '[TRIZ 9-Windows: ...]\nNội dung ban đầu...\nNhận xét riêng: cần thử nghiệm vật liệu mới'
    const modifiedType: NoteType = 'hypothesis'

    mockedCreateResearchNote.mockResolvedValueOnce({
      id: 'note-102',
      session_id: 'ses-123',
      content: modifiedContent,
      note_type: modifiedType,
      source_chunk_id: null,
      source_context: VALID_9_WINDOWS_CONTEXT,
      created_at: '2026-11-13T10:05:00Z',
    } as any)

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={originalDraft}
          content={modifiedContent}
          noteType={modifiedType}
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })

    const callPayload = mockedCreateResearchNote.mock.calls[0][1]
    expect(callPayload.content).toBe(modifiedContent)
    expect(callPayload.note_type).toBe('hypothesis')
    expect(callPayload.source_context).toEqual(VALID_9_WINDOWS_CONTEXT)
  })

  // Nhóm 8: Draft không context vẫn gửi payload cũ, không object {}
  it('Nhóm 8: khi người dùng tự nhập ghi chú thủ công (initialDraft=null), payload không chứa source_context hoặc là undefined/null, tuyệt đối không gửi object rỗng {}', async () => {
    mockedCreateResearchNote.mockResolvedValueOnce({
      id: 'note-103',
      session_id: 'ses-123',
      content: 'Ghi chú tự tạo thủ công',
      note_type: 'insight',
      source_chunk_id: null,
      created_at: '2026-11-13T10:10:00Z',
    })

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={null}
          content="Ghi chú tự tạo thủ công"
          noteType="insight"
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })

    const callPayload = mockedCreateResearchNote.mock.calls[0][1]
    expect(callPayload.source_context).toBeUndefined()
    expect(callPayload.source_context).not.toEqual({})
  })

  // Nhóm 9: Invalid context ở submit không POST và giữ draft
  it('Nhóm 9: draft có context sai quy chuẩn (cell_label rỗng hoặc vượt 100 ký tự) bị chặn ở submit, không gọi POST, báo lỗi chuỗi và giữ draft', async () => {
    const invalidDraft: NoteDraft = {
      content: 'Ghi chú có context lỗi',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: {
        ...VALID_9_WINDOWS_CONTEXT,
        cell_label: '', // Rỗng vi phạm contract
      },
    } as any

    const onNoteCreated = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={invalidDraft}
          content={invalidDraft.content}
          noteType={invalidDraft.note_type}
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={onNoteCreated}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    // Tuyệt đối không được gọi API POST
    expect(mockedCreateResearchNote).not.toHaveBeenCalled()
    expect(onNoteCreated).not.toHaveBeenCalled()

    // Phải hiển thị thông báo lỗi string trên form
    expect(await screen.findByText(/context không hợp lệ|cell_label không được rỗng/i)).toBeInTheDocument()

    // Form và textarea vẫn giữ nguyên nội dung bản nháp
    expect(screen.getByDisplayValue('Ghi chú có context lỗi')).toBeInTheDocument()
  })

  // Nhóm 13: API 422 detail string/array: UI không crash, draft giữ nguyên
  it('Nhóm 13a: khi API trả về 422 với detail là array object từ FastAPI, UI render thông báo lỗi dạng chuỗi an toàn, không bị crash trắng trang', async () => {
    const fastApiError: any = new Error('Request failed with status code 422')
    fastApiError.response = {
      status: 422,
      data: {
        detail: [
          {
            loc: ['body', 'source_context', 'triz_9_windows', 'cell_label'],
            msg: 'String should have at least 1 character',
            type: 'string_too_short',
          },
        ],
      },
    }
    mockedCreateResearchNote.mockRejectedValueOnce(fastApiError)

    const draft: NoteDraft = {
      content: 'Nội dung test lỗi 422',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: VALID_9_WINDOWS_CONTEXT,
    } as any

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={draft}
          content={draft.content}
          noteType={draft.note_type}
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    // Phải hiển thị lỗi an toàn, không ném exception làm React unmount
    await waitFor(() => {
      expect(screen.getByText(/String should have at least 1 character|cell_label/i)).toBeInTheDocument()
    })

    // Bản nháp vẫn được giữ nguyên
    expect(screen.getByDisplayValue('Nội dung test lỗi 422')).toBeInTheDocument()
  })

  it('Nhóm 13b: khi API trả về 422 với detail là chuỗi đơn giản, hiển thị đúng chuỗi đó và không xóa draft', async () => {
    const customError: any = new Error('Request failed with status code 422')
    customError.response = {
      status: 422,
      data: {
        detail: 'Dữ liệu ngữ cảnh không phù hợp với phiên bản schema hiện tại.',
      },
    }
    mockedCreateResearchNote.mockRejectedValueOnce(customError)

    const draft: NoteDraft = {
      content: 'Nội dung test lỗi 422 chuỗi',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: VALID_9_WINDOWS_CONTEXT,
    } as any

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook
          sessionId="ses-123"
          initialDraft={draft}
          content={draft.content}
          noteType={draft.note_type}
          onContentChange={jest.fn()}
          onNoteTypeChange={jest.fn()}
          onClearDraft={jest.fn()}
          onNoteCreated={jest.fn()}
        />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Dữ liệu ngữ cảnh không phù hợp với phiên bản schema hiện tại.')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Nội dung test lỗi 422 chuỗi')).toBeInTheDocument()
  })
})
