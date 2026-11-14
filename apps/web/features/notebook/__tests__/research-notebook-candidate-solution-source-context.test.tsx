/**
 * @jest-environment jsdom
 */

import React, { useState } from 'react'
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

function NotebookTestHarness({
  initialDraft,
  onNoteCreated = () => {},
}: {
  initialDraft: NoteDraft | null
  onNoteCreated?: () => void
}) {
  const [content, setContent] = useState(initialDraft?.content ?? '')
  const [noteType, setNoteType] = useState<NoteType>(initialDraft?.note_type ?? 'insight')

  return (
    <ResearchNotebook
      sessionId="ses-123"
      initialDraft={initialDraft}
      content={content}
      noteType={noteType}
      onContentChange={setContent}
      onNoteTypeChange={setNoteType}
      onClearDraft={jest.fn()}
      onNoteCreated={onNoteCreated}
    />
  )
}

const VALID_CANDIDATE_SOLUTION_CONTEXT = {
  schema_version: 1 as const,
  source_type: 'candidate_solution' as const,
  solution_id: '550e8400-e29b-41d4-a716-446655440000',
  solution_status: 'accepted' as const,
  principle_used: 10,
}

describe('Batch C7c-2f: ResearchNotebook candidate_solution Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedListResearchNotes.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })
  })

  it('1. Valid candidate_solution context được truyền nguyên vẹn tới createResearchNote khi submit form', async () => {
    const draft: NoteDraft = {
      content: '[Giải pháp ứng viên: Cánh tản nhiệt vi kênh đa tầng]\nCơ chế: Vi dòng chảy cưỡng bức.',
      note_type: 'decision',
      source_chunk_id: null,
      source_context: VALID_CANDIDATE_SOLUTION_CONTEXT as any,
    }

    const createdNote: ResearchNote = {
      id: 'note-cs-101',
      session_id: 'ses-123',
      content: draft.content,
      note_type: draft.note_type,
      source_chunk_id: null,
      source_context: VALID_CANDIDATE_SOLUTION_CONTEXT,
      created_at: '2026-11-14T10:00:00Z',
    }
    mockedCreateResearchNote.mockResolvedValueOnce(createdNote)

    const onNoteCreated = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <NotebookTestHarness initialDraft={draft} onNoteCreated={onNoteCreated} />
      </QueryClientProvider>
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue(draft.content)

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })

    const callPayload = mockedCreateResearchNote.mock.calls[0][1]
    expect(callPayload.content).toBe(draft.content)
    expect(callPayload.note_type).toBe('decision')
    expect(callPayload.source_context).toEqual(VALID_CANDIDATE_SOLUTION_CONTEXT)
  })

  it('2. Invalid candidate_solution context chặn createResearchNote và bảo toàn nội dung draft', async () => {
    const invalidDraft: NoteDraft = {
      content: '[Giải pháp ứng viên: Giải pháp hỏng context]\nCơ chế thử nghiệm.',
      note_type: 'hypothesis',
      source_chunk_id: null,
      source_context: {
        schema_version: 1,
        source_type: 'candidate_solution',
        solution_id: 'not-a-valid-uuid',
        solution_status: 'accepted',
      } as any,
    }

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <NotebookTestHarness initialDraft={invalidDraft} />
      </QueryClientProvider>
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue(invalidDraft.content)

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    // Chặn gọi API
    expect(mockedCreateResearchNote).not.toHaveBeenCalled()

    // Nội dung textarea vẫn được giữ nguyên vẹn
    expect(textarea).toHaveValue(invalidDraft.content)
  })

  it('3. Invalid candidate_solution context hiển thị thông báo lỗi trên form', async () => {
    const invalidDraft: NoteDraft = {
      content: '[Giải pháp ứng viên: Kiểm tra hiển thị lỗi]\nCơ chế thử nghiệm.',
      note_type: 'hypothesis',
      source_chunk_id: null,
      source_context: {
        schema_version: 1,
        source_type: 'candidate_solution',
        solution_id: '550e8400-e29b-41d4-a716-446655440000',
        solution_status: 'invalid_status_value',
      } as any,
    }

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <NotebookTestHarness initialDraft={invalidDraft} />
      </QueryClientProvider>
    )

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      const errorMsg = screen.getByText(/Context không hợp lệ/i)
      expect(errorMsg).toBeInTheDocument()
    })
  })

  it('4. Ghi chú thủ công không có source_context vẫn hoạt động bình thường', async () => {
    const createdNote: ResearchNote = {
      id: 'note-manual-202',
      session_id: 'ses-123',
      content: 'Ghi chú tự do do người dùng nhập thủ công',
      note_type: 'insight',
      source_chunk_id: null,
      source_context: null,
      created_at: '2026-11-14T10:30:00Z',
    }
    mockedCreateResearchNote.mockResolvedValueOnce(createdNote)

    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <NotebookTestHarness initialDraft={null} />
      </QueryClientProvider>
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, {
      target: { value: 'Ghi chú tự do do người dùng nhập thủ công' },
    })

    const submitBtn = screen.getByRole('button', { name: /lưu ghi chú/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockedCreateResearchNote).toHaveBeenCalledTimes(1)
    })

    expect(mockedCreateResearchNote).toHaveBeenCalledWith('ses-123', {
      content: 'Ghi chú tự do do người dùng nhập thủ công',
      note_type: 'insight',
    })
  })
})
