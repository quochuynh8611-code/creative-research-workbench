/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResearchNotebook } from '../research-notebook'
import * as apiClient from '@/lib/api-client'
import type {
  ResearchNotesResponse,
  ResearchNote,
  Triz9WindowsSourceContext,
  TrizMatrixSourceContext,
  PrincipleSuggestionSourceContext,
  EvidenceSourceContext,
  CandidateSolutionSourceContext,
} from '@/lib/types'

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

const defaultProps = {
  sessionId: 'ses-source-filter-test',
  initialDraft: null,
  content: '',
  noteType: 'insight' as const,
  onContentChange: jest.fn(),
  onNoteTypeChange: jest.fn(),
  onClearDraft: jest.fn(),
  onNoteCreated: jest.fn(),
}

describe('Batch C7c-3b: ResearchNotebook Source Provenance Filter Tests (RED Phase)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Fixture hợp lệ theo đúng validator
  const ctxTriz9Windows: Triz9WindowsSourceContext = {
    schema_version: 1,
    source_type: 'triz_9_windows',
    lens: 'engineering',
    level: 'system',
    time: 'present',
    cell_label: 'Hiện tại / Hệ thống',
  }

  const ctxTrizMatrix1: TrizMatrixSourceContext = {
    schema_version: 1,
    source_type: 'triz_matrix',
    principle_id: 35,
    improving_param_id: 1,
    worsening_param_id: 14,
    lens: 'engineering',
  }

  const ctxTrizMatrix2: TrizMatrixSourceContext = {
    schema_version: 1,
    source_type: 'triz_matrix',
    principle_id: 10,
    improving_param_id: 2,
    worsening_param_id: 15,
    lens: 'business',
  }

  const ctxPrincipleSuggestion: PrincipleSuggestionSourceContext = {
    schema_version: 1,
    source_type: 'principle_suggestion',
    principle_id: 10,
    method_id: 'method-triz-param-transform',
  }

  const ctxEvidence: EvidenceSourceContext = {
    schema_version: 1,
    source_type: 'evidence',
    source_ref: 'Báo cáo thử nghiệm độ bền vật liệu composite 2026',
  }

  const ctxCandidateSolution: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440001',
    solution_status: 'accepted',
    principle_used: 35,
  }

  // 8 Fixture Notes phủ đầy đủ các case yêu cầu
  const MOCK_FIXTURE_NOTES: ResearchNote[] = [
    {
      id: 'note-01-triz9',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại',
      note_type: 'insight',
      source_context: ctxTriz9Windows,
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'note-02-matrix-hypo',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ',
      note_type: 'hypothesis',
      source_context: ctxTrizMatrix1,
      created_at: '2026-10-01T08:10:00Z',
    },
    {
      id: 'note-03-matrix-insight',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Ma trận TRIZ 2: Phát hiện mâu thuẫn vận hành kinh doanh',
      note_type: 'insight',
      source_context: ctxTrizMatrix2,
      created_at: '2026-10-01T08:20:00Z',
    },
    {
      id: 'note-04-principle',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10',
      note_type: 'decision',
      source_context: ctxPrincipleSuggestion,
      created_at: '2026-10-01T08:30:00Z',
    },
    {
      id: 'note-05-evidence',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite',
      note_type: 'question',
      source_context: ctxEvidence,
      created_at: '2026-10-01T08:40:00Z',
    },
    {
      id: 'note-06-candidate',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp',
      note_type: 'action',
      source_context: ctxCandidateSolution,
      created_at: '2026-10-01T08:50:00Z',
    },
    {
      id: 'note-07-manual-null',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Thủ công: Ý tưởng do người dùng tự nhập không có nguồn',
      note_type: 'insight',
      source_context: null,
      created_at: '2026-10-01T09:00:00Z',
    },
    {
      id: 'note-08-invalid-ctx',
      session_id: 'ses-source-filter-test',
      content: 'Ghi chú Context lỗi: Dữ liệu nguồn không hợp lệ hoặc lạ',
      note_type: 'hypothesis',
      source_context: { source_type: 'unknown_source_type_invalid' } as any,
      created_at: '2026-10-01T09:10:00Z',
    },
  ]

  function renderNotebookWithNotes(notes: ResearchNote[] = MOCK_FIXTURE_NOTES) {
    const mockResponse: ResearchNotesResponse = {
      data: notes,
      meta: { total: notes.length },
    }
    ;(apiClient.listResearchNotes as jest.Mock).mockResolvedValue(mockResponse)

    const queryClient = createTestQueryClient()
    return render(
      <QueryClientProvider client={queryClient}>
        <ResearchNotebook {...defaultProps} />
      </QueryClientProvider>
    )
  }

  function getSourceFilterButton(name: RegExp | string) {
    const sourceToolbar = screen.queryByRole('toolbar', { name: /bộ lọc nguồn/i })
    if (sourceToolbar) {
      return within(sourceToolbar).getByRole('button', { name })
    }
    return screen.getByRole('button', { name })
  }

  function getAllSourceButton() {
    const sourceToolbar = screen.queryByRole('toolbar', { name: /bộ lọc nguồn/i })
    if (sourceToolbar) {
      return within(sourceToolbar).getByRole('button', { name: /tất cả/i })
    }
    const buttons = screen.getAllByRole('button', { name: /tất cả/i })
    return buttons[1] || buttons[0]
  }

  it('1. Chọn nguồn "Ma trận TRIZ" => chỉ hiển thị note triz_matrix', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    const trizMatrixBtn = getSourceFilterButton(/ma trận triz/i)
    fireEvent.click(trizMatrixBtn)

    // Hiển thị cả 2 notes có source_type là triz_matrix
    expect(screen.getByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú Ma trận TRIZ 2: Phát hiện mâu thuẫn vận hành kinh doanh')).toBeInTheDocument()

    // Ẩn tất cả các note thuộc nguồn khác
    expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Thủ công: Ý tưởng do người dùng tự nhập không có nguồn')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Context lỗi: Dữ liệu nguồn không hợp lệ hoặc lạ')).not.toBeInTheDocument()
  })

  it('2. Chọn nguồn "Lưới 9 màn hình" => chỉ hiển thị note triz_9_windows', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    const nineWindowsBtn = getSourceFilterButton(/lưới 9 màn hình/i)
    fireEvent.click(nineWindowsBtn)

    expect(screen.getByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Thủ công: Ý tưởng do người dùng tự nhập không có nguồn')).not.toBeInTheDocument()
  })

  it('3. Chọn nguồn "Gợi ý nguyên tắc" => chỉ hiển thị note principle_suggestion', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10')).toBeInTheDocument()

    const principleBtn = getSourceFilterButton(/gợi ý nguyên tắc/i)
    fireEvent.click(principleBtn)

    expect(screen.getByText('Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10')).toBeInTheDocument()
    expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).not.toBeInTheDocument()
  })

  it('4. Chọn nguồn "Bằng chứng" => chỉ hiển thị note evidence', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).toBeInTheDocument()

    const evidenceBtn = getSourceFilterButton(/bằng chứng/i)
    fireEvent.click(evidenceBtn)

    expect(screen.getByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).toBeInTheDocument()
    expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).not.toBeInTheDocument()
  })

  it('5. Chọn nguồn "Giải pháp ứng viên" => chỉ hiển thị note candidate_solution', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).toBeInTheDocument()

    const candidateBtn = getSourceFilterButton(/giải pháp ứng viên/i)
    fireEvent.click(candidateBtn)

    expect(screen.getByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).toBeInTheDocument()
    expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).not.toBeInTheDocument()
  })

  it('6. Chọn nguồn "Thủ công" => hiển thị note null và note invalid, không hiển thị note có context hợp lệ', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú Thủ công: Ý tưởng do người dùng tự nhập không có nguồn')).toBeInTheDocument()

    const manualBtn = getSourceFilterButton(/thủ công/i)
    fireEvent.click(manualBtn)

    // Hiển thị cả note null và note invalid
    expect(screen.getByText('Ghi chú Thủ công: Ý tưởng do người dùng tự nhập không có nguồn')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú Context lỗi: Dữ liệu nguồn không hợp lệ hoặc lạ')).toBeInTheDocument()

    // Ẩn tất cả note có context hợp lệ
    expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 2: Phát hiện mâu thuẫn vận hành kinh doanh')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Gợi ý nguyên tắc: Quyết định áp dụng sơ bộ nguyên tắc 10')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Bằng chứng: Câu hỏi về độ tin cậy kết quả thử nghiệm composite')).not.toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Giải pháp ứng viên: Hành động tích hợp module giải pháp')).not.toBeInTheDocument()
  })

  it('7. Chọn nguồn "Tất cả" => hiển thị toàn bộ note', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    // Đang lọc Ma trận TRIZ
    fireEvent.click(getSourceFilterButton(/ma trận triz/i))
    expect(screen.queryByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).not.toBeInTheDocument()

    // Chuyển lại về Tất cả của nguồn
    const allBtn = getAllSourceButton()
    fireEvent.click(allBtn)

    // Cả 8 notes đều hiển thị đầy đủ
    for (const note of MOCK_FIXTURE_NOTES) {
      expect(screen.getByText(note.content)).toBeInTheDocument()
    }
  })

  it('8. Kết hợp "Ma trận TRIZ" + note_type "hypothesis" => chỉ hiển thị note triz_matrix có note_type hypothesis', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    // Chọn nguồn Ma trận TRIZ
    fireEvent.click(getSourceFilterButton(/ma trận triz/i))

    // Chọn loại Hypothesis
    const hypothesisTypeBtn = screen.getByRole('button', { name: /hypothesis/i })
    fireEvent.click(hypothesisTypeBtn)

    // Chỉ note 02 khớp cả 2 tiêu chí (Ma trận TRIZ AND hypothesis)
    expect(screen.getByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).toBeInTheDocument()

    // Note 03 là Ma trận TRIZ nhưng note_type là insight => bị loại
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 2: Phát hiện mâu thuẫn vận hành kinh doanh')).not.toBeInTheDocument()

    // Note 08 có note_type hypothesis nhưng nguồn là invalid (manual) => bị loại
    expect(screen.queryByText('Ghi chú Context lỗi: Dữ liệu nguồn không hợp lệ hoặc lạ')).not.toBeInTheDocument()
  })

  it('9. Kết hợp nguồn + search content', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    // Chọn nguồn Ma trận TRIZ (có 2 note: nhiệt độ và mâu thuẫn)
    fireEvent.click(getSourceFilterButton(/ma trận triz/i))

    // Nhập từ khóa tìm kiếm "nhiệt độ"
    const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
    fireEvent.change(searchInput, { target: { value: 'nhiệt độ' } })

    // Chỉ note 02 xuất hiện
    expect(screen.getByText('Ghi chú Ma trận TRIZ 1: Giả thuyết thay đổi thông số nhiệt độ')).toBeInTheDocument()
    expect(screen.queryByText('Ghi chú Ma trận TRIZ 2: Phát hiện mâu thuẫn vận hành kinh doanh')).not.toBeInTheDocument()
  })

  it('10. Counter từng lựa chọn nguồn đúng, kể cả khi đang chọn filter khác', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    // Kích hoạt tìm kiếm hoặc filter type khác
    const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i)
    fireEvent.change(searchInput, { target: { value: 'nhiệt độ' } })

    // Counters của các nút nguồn phải giữ nguyên theo toàn bộ 8 notes
    const allSourceBtn = getAllSourceButton()
    const nineWindowsBtn = getSourceFilterButton(/lưới 9 màn hình/i)
    const trizMatrixBtn = getSourceFilterButton(/ma trận triz/i)
    const principleBtn = getSourceFilterButton(/gợi ý nguyên tắc/i)
    const evidenceBtn = getSourceFilterButton(/bằng chứng/i)
    const candidateBtn = getSourceFilterButton(/giải pháp ứng viên/i)
    const manualBtn = getSourceFilterButton(/thủ công/i)

    expect(allSourceBtn).toHaveTextContent('8')
    expect(nineWindowsBtn).toHaveTextContent('1')
    expect(trizMatrixBtn).toHaveTextContent('2')
    expect(principleBtn).toHaveTextContent('1')
    expect(evidenceBtn).toHaveTextContent('1')
    expect(candidateBtn).toHaveTextContent('1')
    expect(manualBtn).toHaveTextContent('2')
  })

  it('11. Counter "Thủ công" gồm null và invalid context', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    const manualBtn = getSourceFilterButton(/thủ công/i)
    // 1 note null context + 1 note invalid context = 2
    expect(manualBtn).toHaveTextContent('2')
  })

  it('12. "Xóa bộ lọc" reset nguồn, note_type và search', async () => {
    renderNotebookWithNotes()
    expect(await screen.findByText('Ghi chú 9 Màn hình: Quan sát hệ thống hiện tại')).toBeInTheDocument()

    // Chọn nguồn Ma trận TRIZ
    fireEvent.click(getSourceFilterButton(/ma trận triz/i))

    // Chọn loại Decision (không có note Ma trận TRIZ nào là Decision => empty filter state)
    const decisionBtn = screen.getByRole('button', { name: /decision/i })
    fireEvent.click(decisionBtn)

    // Nhập thêm search
    const searchInput = screen.getByPlaceholderText(/tìm kiếm ghi chú/i) as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'không tồn tại' } })

    expect(screen.getByText(/không tìm thấy ghi chú phù hợp với bộ lọc/i)).toBeInTheDocument()

    // Bấm nút Xóa bộ lọc
    const clearBtn = screen.getByRole('button', { name: /xóa bộ lọc/i })
    fireEvent.click(clearBtn)

    // Ô search bị xóa
    expect(searchInput.value).toBe('')

    // Cả 8 notes xuất hiện lại đầy đủ
    for (const note of MOCK_FIXTURE_NOTES) {
      expect(screen.getByText(note.content)).toBeInTheDocument()
    }
  })

  it('13. Không crash với invalid context', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const notesWithBizarreContexts: ResearchNote[] = [
      {
        id: 'note-bizarre-1',
        session_id: 'ses-source-filter-test',
        content: 'Ghi chú context là string nguyên thủy',
        note_type: 'insight',
        source_context: 'just-a-raw-string' as any,
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'note-bizarre-2',
        session_id: 'ses-source-filter-test',
        content: 'Ghi chú context là mảng',
        note_type: 'insight',
        source_context: [1, 2, 3] as any,
        created_at: '2026-10-01T10:01:00Z',
      },
      {
        id: 'note-bizarre-3',
        session_id: 'ses-source-filter-test',
        content: 'Ghi chú context thiếu source_type',
        note_type: 'insight',
        source_context: { foo: 'bar' } as any,
        created_at: '2026-10-01T10:02:00Z',
      },
    ]

    renderNotebookWithNotes(notesWithBizarreContexts)

    // Cả 3 ghi chú được hiển thị an toàn
    expect(await screen.findByText('Ghi chú context là string nguyên thủy')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú context là mảng')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú context thiếu source_type')).toBeInTheDocument()

    // Lọc theo Thủ công phải hiển thị cả 3 note kỳ dị này
    const manualBtn = getSourceFilterButton(/thủ công/i)
    fireEvent.click(manualBtn)

    expect(screen.getByText('Ghi chú context là string nguyên thủy')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú context là mảng')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú context thiếu source_type')).toBeInTheDocument()

    errorSpy.mockRestore()
  })
})
