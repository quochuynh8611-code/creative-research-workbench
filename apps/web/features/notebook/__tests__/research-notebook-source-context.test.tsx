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

  // Hardening: Phân biệt context null/undefined với các giá trị sai kiểu falsy
  describe('Hardening C7c-2a: Phân biệt context null/undefined với các giá trị sai kiểu falsy', () => {
    const falsyCases = [
      { name: 'boolean false', value: false },
      { name: 'number 0', value: 0 },
      { name: 'empty string ""', value: '' },
      { name: 'NaN', value: NaN },
    ]

    test.each(falsyCases)(
      'khi initialDraft có source_context là $name, submit bị chặn fail-closed: không gọi API, báo lỗi, giữ draft',
      async ({ value }) => {
        const invalidDraft: NoteDraft = {
          content: 'Nội dung nháp với context falsy',
          note_type: 'hypothesis',
          source_chunk_id: null,
          source_context: value as unknown as NoteDraft['source_context'],
        }

        const onNoteCreated = jest.fn()
        const onClearDraft = jest.fn()
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
              onClearDraft={onClearDraft}
              onNoteCreated={onNoteCreated}
            />
          </QueryClientProvider>
        )

        const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
        fireEvent.click(submitBtn)

        // Không được gọi API createResearchNote
        expect(mockedCreateResearchNote).not.toHaveBeenCalled()
        expect(onNoteCreated).not.toHaveBeenCalled()
        expect(onClearDraft).not.toHaveBeenCalled()

        // Phải hiển thị thông báo lỗi accessible
        const errorEl = await screen.findByText(/context không hợp lệ/i)
        expect(errorEl).toBeInTheDocument()
        expect(errorEl).toBeVisible()

        // Form và textarea vẫn giữ nguyên nội dung bản nháp và note_type không mặc định
        expect(
          screen.getByDisplayValue('Nội dung nháp với context falsy')
        ).toBeInTheDocument()
        const selectEl = screen.getByRole('combobox', {
          name: /loại ghi chú/i,
        }) as HTMLSelectElement
        expect(selectEl.value).toBe('hypothesis')
      }
    )

    it('khi initialDraft là object hợp lệ với source_context: null, submit gọi API thành công và payload không mang context cũ', async () => {
      const draftWithNullContext: NoteDraft = {
        content: 'Ghi chú khởi tạo từ nháp có source_context null',
        note_type: 'decision',
        source_chunk_id: null,
        source_context: null,
      }

      mockedCreateResearchNote.mockResolvedValueOnce({
        id: 'note-105',
        session_id: 'ses-123',
        content: draftWithNullContext.content,
        note_type: draftWithNullContext.note_type,
        source_chunk_id: null,
        created_at: '2026-11-13T10:20:00Z',
      })

      const onNoteCreated = jest.fn()
      const onClearDraft = jest.fn()
      const queryClient = createTestQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            sessionId="ses-123"
            initialDraft={draftWithNullContext}
            content={draftWithNullContext.content}
            noteType={draftWithNullContext.note_type}
            onContentChange={jest.fn()}
            onNoteTypeChange={jest.fn()}
            onClearDraft={onClearDraft}
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
      expect(callPayload.content).toBe(
        'Ghi chú khởi tạo từ nháp có source_context null'
      )
      expect(callPayload.note_type).toBe('decision')
      expect(
        callPayload.source_context === undefined ||
          callPayload.source_context === null
      ).toBe(true)
      expect(callPayload.source_context).not.toEqual({})
      expect(
        screen.queryByText(/context không hợp lệ/i)
      ).not.toBeInTheDocument()
      expect(onNoteCreated).toHaveBeenCalledTimes(1)
    })

    it('khi initialDraft có source_context là undefined, vẫn cho phép lưu note thủ công và không gửi context rỗng', async () => {
      mockedCreateResearchNote.mockResolvedValueOnce({
        id: 'note-104',
        session_id: 'ses-123',
        content: 'Ghi chú với context undefined',
        note_type: 'insight',
        source_chunk_id: null,
        created_at: '2026-11-13T10:15:00Z',
      })

      const queryClient = createTestQueryClient()
      const draft: NoteDraft = {
        content: 'Ghi chú với context undefined',
        note_type: 'insight',
        source_chunk_id: null,
        source_context: undefined,
      }

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
        expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
      })

      const callPayload = mockedCreateResearchNote.mock.calls[0][1]
      expect(callPayload.source_context).toBeUndefined()
    })
  })

  describe('Batch C7c-2c: ResearchNotebook triz_matrix source_context Submission & Validation', () => {
    const VALID_MATRIX_CONTEXT = {
      schema_version: 1 as const,
      source_type: 'triz_matrix' as const,
      principle_id: 35,
      improving_param_id: 1,
      worsening_param_id: 14,
      lens: 'business' as const,
    }

    it('submit draft kèm source_context triz_matrix hợp lệ chuyển nguyên vẹn context tới createResearchNote', async () => {
      const draft: NoteDraft = {
        content: '[Ma trận TRIZ - Nguyên tắc #35: ...]\nNội dung mô tả...',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: VALID_MATRIX_CONTEXT,
      } as any

      const createdNote: ResearchNote = {
        id: 'note-201',
        session_id: 'ses-123',
        content: draft.content,
        note_type: draft.note_type,
        source_chunk_id: null,
        source_context: VALID_MATRIX_CONTEXT,
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
      expect(callPayload.source_context).toEqual(VALID_MATRIX_CONTEXT)
      expect(onNoteCreated).toHaveBeenCalledTimes(1)
    })

    it('chặn submit và giữ draft khi draft kèm context triz_matrix invalid (principle_id: 0)', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú ma trận với context lỗi',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: {
          ...VALID_MATRIX_CONTEXT,
          principle_id: 0,
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

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(onNoteCreated).not.toHaveBeenCalled()

      expect(await screen.findByText(/context không hợp lệ|principle_id phải là số nguyên/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú ma trận với context lỗi')).toBeInTheDocument()
    })

    it('chặn submit và giữ draft khi draft kèm context triz_matrix thừa trường lạ', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú ma trận với context thừa trường',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: {
          ...VALID_MATRIX_CONTEXT,
          extra_param: 'not allowed',
        },
      } as any

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
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(await screen.findByText(/context không hợp lệ/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú ma trận với context thừa trường')).toBeInTheDocument()
    })
  })

  describe('Batch C7c-2d-2: ResearchNotebook principle_suggestion source_context Submission & Validation', () => {
    const VALID_SUGGESTION_CONTEXT = {
      schema_version: 1 as const,
      source_type: 'principle_suggestion' as const,
      principle_id: 35,
      method_id: 'triz-principle-35',
    }

    it('submit draft kèm source_context principle_suggestion hợp lệ chuyển nguyên vẹn context tới createResearchNote', async () => {
      const draft: NoteDraft = {
        content: '[Nguyên tắc sáng tạo #35: Parameter Changes]\nNội dung mô tả...',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: VALID_SUGGESTION_CONTEXT,
      } as any

      const createdNote: ResearchNote = {
        id: 'note-301',
        session_id: 'ses-123',
        content: draft.content,
        note_type: draft.note_type,
        source_chunk_id: null,
        source_context: VALID_SUGGESTION_CONTEXT,
        created_at: '2026-11-14T10:00:00Z',
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
      expect(callPayload.source_context).toEqual(VALID_SUGGESTION_CONTEXT)
      expect(onNoteCreated).toHaveBeenCalledTimes(1)
    })

    it('chặn submit và giữ draft khi draft kèm context principle_suggestion invalid (principle_id: 0)', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú gợi ý nguyên tắc với principle_id lỗi',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: {
          ...VALID_SUGGESTION_CONTEXT,
          principle_id: 0,
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

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(onNoteCreated).not.toHaveBeenCalled()

      expect(await screen.findByText(/context không hợp lệ|principle_id phải là số nguyên/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú gợi ý nguyên tắc với principle_id lỗi')).toBeInTheDocument()
    })

    it('chặn submit và giữ draft khi draft kèm context principle_suggestion có method_id rỗng', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú gợi ý nguyên tắc với method_id rỗng',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: {
          ...VALID_SUGGESTION_CONTEXT,
          method_id: '',
        },
      } as any

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
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(await screen.findByText(/context không hợp lệ/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú gợi ý nguyên tắc với method_id rỗng')).toBeInTheDocument()
    })

    it('chặn submit và giữ draft khi draft kèm context principle_suggestion thừa trường lạ', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú gợi ý nguyên tắc với context thừa trường',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: {
          ...VALID_SUGGESTION_CONTEXT,
          extra_param: 'not allowed',
        },
      } as any

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
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(await screen.findByText(/context không hợp lệ/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú gợi ý nguyên tắc với context thừa trường')).toBeInTheDocument()
    })

    it('sửa nội dung văn bản và đổi note_type nhưng source_context principle_suggestion vẫn được giữ nguyên', async () => {
      const originalDraft: NoteDraft = {
        content: '[Nguyên tắc sáng tạo #35: Parameter Changes]\nNội dung ban đầu...',
        note_type: 'hypothesis',
        source_chunk_id: null,
        source_context: VALID_SUGGESTION_CONTEXT,
      } as any

      const modifiedContent = '[Nguyên tắc sáng tạo #35: Parameter Changes]\nNội dung đã chỉnh sửa thêm'
      const modifiedType: NoteType = 'decision'

      mockedCreateResearchNote.mockResolvedValueOnce({
        id: 'note-302',
        session_id: 'ses-123',
        content: modifiedContent,
        note_type: modifiedType,
        source_chunk_id: null,
        source_context: VALID_SUGGESTION_CONTEXT,
        created_at: '2026-11-14T10:05:00Z',
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
      expect(callPayload.note_type).toBe(modifiedType)
      expect(callPayload.source_context).toEqual(VALID_SUGGESTION_CONTEXT)
    })
  })

  describe('Batch C7c-2e: ResearchNotebook evidence source_context Submission & Validation', () => {
    const VALID_EVIDENCE_CONTEXT = {
      schema_version: 1 as const,
      source_type: 'evidence' as const,
      source_ref: 'docs/ADR-001-architecture.md',
    }

    it('submit draft kèm source_context evidence hợp lệ chuyển nguyên vẹn context và source_chunk_id độc lập', async () => {
      const draft: NoteDraft = {
        content: '[Trích dẫn từ docs/ADR-001-architecture.md]\nNội dung trích dẫn...',
        note_type: 'insight',
        source_chunk_id: 'chk-evidence-001',
        source_context: VALID_EVIDENCE_CONTEXT,
      } as any

      const createdNote: ResearchNote = {
        id: 'note-401',
        session_id: 'ses-123',
        content: draft.content,
        note_type: draft.note_type,
        source_chunk_id: 'chk-evidence-001',
        source_context: VALID_EVIDENCE_CONTEXT,
        created_at: '2026-11-14T11:00:00Z',
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
      expect(callPayload.source_context).toEqual(VALID_EVIDENCE_CONTEXT)
      expect(callPayload.source_chunk_id).toBe('chk-evidence-001')
      expect(callPayload.source_context).not.toHaveProperty('source_chunk_id')
      expect(callPayload.source_context).not.toHaveProperty('chunk_id')
      expect(callPayload.source_context).not.toHaveProperty('score')
      expect(onNoteCreated).toHaveBeenCalledTimes(1)
    })

    it('chặn submit và giữ draft khi draft kèm context evidence có source_ref rỗng ""', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú bằng chứng với source_ref rỗng',
        note_type: 'insight',
        source_chunk_id: 'chk-evidence-001',
        source_context: {
          ...VALID_EVIDENCE_CONTEXT,
          source_ref: '',
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

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(onNoteCreated).not.toHaveBeenCalled()

      expect(await screen.findByText(/context không hợp lệ/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú bằng chứng với source_ref rỗng')).toBeInTheDocument()
    })

    it('chặn submit và giữ draft khi draft kèm context evidence có ký tự điều khiển \\n', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú bằng chứng chứa newline',
        note_type: 'insight',
        source_chunk_id: 'chk-evidence-001',
        source_context: {
          ...VALID_EVIDENCE_CONTEXT,
          source_ref: 'docs/ADR-001\narchitecture.md',
        },
      } as any

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
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(await screen.findByText(/context không hợp lệ|ký tự điều khiển/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú bằng chứng chứa newline')).toBeInTheDocument()
    })

    it('chặn submit và giữ draft khi draft kèm context evidence cố ý chứa chunk_id hoặc score', async () => {
      const invalidDraft: NoteDraft = {
        content: 'Ghi chú bằng chứng chứa chunk_id thừa trong context',
        note_type: 'insight',
        source_chunk_id: 'chk-evidence-001',
        source_context: {
          ...VALID_EVIDENCE_CONTEXT,
          chunk_id: 'chk-evidence-001',
          score: 0.95,
        },
      } as any

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
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
      fireEvent.click(submitBtn)

      expect(mockedCreateResearchNote).not.toHaveBeenCalled()
      expect(await screen.findByText(/context không hợp lệ/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ghi chú bằng chứng chứa chunk_id thừa trong context')).toBeInTheDocument()
    })

    it('sửa nội dung văn bản và đổi note_type nhưng source_context evidence vẫn được giữ nguyên', async () => {
      const originalDraft: NoteDraft = {
        content: '[Trích dẫn từ docs/ADR-001-architecture.md]\nNội dung ban đầu...',
        note_type: 'insight',
        source_chunk_id: 'chk-evidence-001',
        source_context: VALID_EVIDENCE_CONTEXT,
      } as any

      const modifiedContent = '[Trích dẫn từ docs/ADR-001-architecture.md]\nNội dung đã chỉnh sửa thêm'
      const modifiedType: NoteType = 'hypothesis'

      mockedCreateResearchNote.mockResolvedValueOnce({
        id: 'note-402',
        session_id: 'ses-123',
        content: modifiedContent,
        note_type: modifiedType,
        source_chunk_id: 'chk-evidence-001',
        source_context: VALID_EVIDENCE_CONTEXT,
        created_at: '2026-11-14T11:05:00Z',
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
      expect(callPayload.note_type).toBe(modifiedType)
      expect(callPayload.source_context).toEqual(VALID_EVIDENCE_CONTEXT)
      expect(callPayload.source_chunk_id).toBe('chk-evidence-001')
    })
  })
})
