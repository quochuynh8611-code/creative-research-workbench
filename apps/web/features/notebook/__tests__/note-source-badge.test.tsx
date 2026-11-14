/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NoteSourceBadge } from '../components/note-source-badge'
import type {
  Triz9WindowsSourceContext,
  TrizMatrixSourceContext,
  PrincipleSuggestionSourceContext,
  EvidenceSourceContext,
  CandidateSolutionSourceContext,
} from '@/lib/types'

describe('Batch C7c-3c: NoteSourceBadge Provenance Detail Tooltip Tests', () => {
  const VALID_TRIZ_9_WINDOWS: Triz9WindowsSourceContext = {
    schema_version: 1,
    source_type: 'triz_9_windows',
    lens: 'engineering',
    level: 'system',
    time: 'past',
    cell_label: 'Quá khứ / Hệ thống',
  }

  const VALID_TRIZ_MATRIX: TrizMatrixSourceContext = {
    schema_version: 1,
    source_type: 'triz_matrix',
    principle_id: 35,
    improving_param_id: 1,
    worsening_param_id: 14,
    lens: 'engineering',
  }

  const VALID_PRINCIPLE_SUGGESTION: PrincipleSuggestionSourceContext = {
    schema_version: 1,
    source_type: 'principle_suggestion',
    principle_id: 10,
    method_id: 'method-triz-param-transform',
  }

  const VALID_EVIDENCE: EvidenceSourceContext = {
    schema_version: 1,
    source_type: 'evidence',
    source_ref: 'Tài liệu nghiên cứu vật liệu composite 2026',
  }

  // Chuỗi 120 ký tự hợp lệ cho test truncate evidence
  const LONG_SOURCE_REF_120 =
    'Nghiên cứu thực nghiệm tính chất cơ lý hóa của vật liệu nano composite đa lớp trong điều kiện nhiệt độ cao và áp suất cao'
  const VALID_LONG_EVIDENCE: EvidenceSourceContext = {
    schema_version: 1,
    source_type: 'evidence',
    source_ref: LONG_SOURCE_REF_120,
  }

  const VALID_CANDIDATE_SOLUTION_NUMERIC: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440001',
    solution_status: 'accepted',
    principle_used: 35,
  }

  const VALID_CANDIDATE_SOLUTION_STRING: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440002',
    solution_status: 'candidate',
    principle_used: 'nguyen-tac-so-10',
  }

  const VALID_CANDIDATE_SOLUTION_NO_PRINCIPLE: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440003',
    solution_status: 'rejected',
  }

  describe('1. Happy Paths: Render đúng nhãn nguồn tĩnh trên giao diện badge', () => {
    it('1.1 render đúng nhãn "Lưới 9 màn hình" cho triz_9_windows', () => {
      render(<NoteSourceBadge sourceContext={VALID_TRIZ_9_WINDOWS} />)
      const badge = screen.getByText('Lưới 9 màn hình')
      expect(badge).toBeInTheDocument()
    })

    it('1.2 render đúng nhãn "Ma trận TRIZ" cho triz_matrix', () => {
      render(<NoteSourceBadge sourceContext={VALID_TRIZ_MATRIX} />)
      const badge = screen.getByText('Ma trận TRIZ')
      expect(badge).toBeInTheDocument()
    })

    it('1.3 render đúng nhãn "Gợi ý nguyên tắc" cho principle_suggestion', () => {
      render(<NoteSourceBadge sourceContext={VALID_PRINCIPLE_SUGGESTION} />)
      const badge = screen.getByText('Gợi ý nguyên tắc')
      expect(badge).toBeInTheDocument()
    })

    it('1.4 render đúng nhãn "Bằng chứng" cho evidence', () => {
      render(<NoteSourceBadge sourceContext={VALID_EVIDENCE} />)
      const badge = screen.getByText('Bằng chứng')
      expect(badge).toBeInTheDocument()
    })

    it('1.5 render đúng nhãn "Giải pháp ứng viên" cho candidate_solution', () => {
      render(<NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION_NUMERIC} />)
      const badge = screen.getByText('Giải pháp ứng viên')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('2. Provenance Detail Tooltip (title attribute)', () => {
    it('2.1 triz_9_windows: title "Lưới 9 màn hình: <cell_label>"', () => {
      const { container } = render(<NoteSourceBadge sourceContext={VALID_TRIZ_9_WINDOWS} />)
      const badge = container.querySelector('[title="Lưới 9 màn hình: Quá khứ / Hệ thống"]')
      expect(badge).toBeInTheDocument()
    })

    it('2.2 triz_matrix: title "Ma trận TRIZ: Nguyên tắc #<principle_id> (Cải thiện: #<improving_param_id>, Xấu đi: #<worsening_param_id>)"', () => {
      const { container } = render(<NoteSourceBadge sourceContext={VALID_TRIZ_MATRIX} />)
      const badge = container.querySelector(
        '[title="Ma trận TRIZ: Nguyên tắc #35 (Cải thiện: #1, Xấu đi: #14)"]'
      )
      expect(badge).toBeInTheDocument()
    })

    it('2.3 principle_suggestion: title "Gợi ý nguyên tắc: Nguyên tắc #<principle_id> (<method_id>)"', () => {
      const { container } = render(<NoteSourceBadge sourceContext={VALID_PRINCIPLE_SUGGESTION} />)
      const badge = container.querySelector(
        '[title="Gợi ý nguyên tắc: Nguyên tắc #10 (method-triz-param-transform)"]'
      )
      expect(badge).toBeInTheDocument()
    })

    it('2.4 evidence (source_ref ngắn <= 100 ký tự): title giữ nguyên source_ref đầy đủ', () => {
      const { container } = render(<NoteSourceBadge sourceContext={VALID_EVIDENCE} />)
      const badge = container.querySelector(
        '[title="Bằng chứng: Tài liệu nghiên cứu vật liệu composite 2026"]'
      )
      expect(badge).toBeInTheDocument()
    })

    it('2.5 evidence (source_ref dài > 100 ký tự): title truncate ở 100 ký tự đầu kèm "..."', () => {
      const { container } = render(<NoteSourceBadge sourceContext={VALID_LONG_EVIDENCE} />)
      const expectedTruncated = LONG_SOURCE_REF_120.slice(0, 100) + '...'
      const badge = container.querySelector(`[title="Bằng chứng: ${expectedTruncated}"]`)
      expect(badge).toBeInTheDocument()
    })

    it('2.6 candidate_solution có principle_used là số và status "accepted"', () => {
      const { container } = render(
        <NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION_NUMERIC} />
      )
      const badge = container.querySelector(
        '[title="Giải pháp ứng viên: Đã chấp nhận (Nguyên tắc #35)"]'
      )
      expect(badge).toBeInTheDocument()
    })

    it('2.7 candidate_solution có principle_used là string và status "candidate"', () => {
      const { container } = render(
        <NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION_STRING} />
      )
      const badge = container.querySelector(
        '[title="Giải pháp ứng viên: Đang xem xét (Nguyên tắc #nguyen-tac-so-10)"]'
      )
      expect(badge).toBeInTheDocument()
    })

    it('2.8 candidate_solution không có principle_used và status "rejected"', () => {
      const { container } = render(
        <NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION_NO_PRINCIPLE} />
      )
      const badge = container.querySelector('[title="Giải pháp ứng viên: Bị từ chối"]')
      expect(badge).toBeInTheDocument()
    })

    it('2.9 candidate_solution kiểm tra đúng cả 3 nhãn trạng thái ("Đang xem xét", "Đã chấp nhận", "Bị từ chối")', () => {
      const candidateContext: CandidateSolutionSourceContext = {
        schema_version: 1,
        source_type: 'candidate_solution',
        solution_id: '550e8400-e29b-41d4-a716-446655440010',
        solution_status: 'candidate',
      }
      const acceptedContext: CandidateSolutionSourceContext = {
        schema_version: 1,
        source_type: 'candidate_solution',
        solution_id: '550e8400-e29b-41d4-a716-446655440020',
        solution_status: 'accepted',
      }
      const rejectedContext: CandidateSolutionSourceContext = {
        schema_version: 1,
        source_type: 'candidate_solution',
        solution_id: '550e8400-e29b-41d4-a716-446655440030',
        solution_status: 'rejected',
      }

      const { container: c1 } = render(<NoteSourceBadge sourceContext={candidateContext} />)
      expect(c1.querySelector('[title="Giải pháp ứng viên: Đang xem xét"]')).toBeInTheDocument()

      const { container: c2 } = render(<NoteSourceBadge sourceContext={acceptedContext} />)
      expect(c2.querySelector('[title="Giải pháp ứng viên: Đã chấp nhận"]')).toBeInTheDocument()

      const { container: c3 } = render(<NoteSourceBadge sourceContext={rejectedContext} />)
      expect(c3.querySelector('[title="Giải pháp ứng viên: Bị từ chối"]')).toBeInTheDocument()
    })
  })

  describe('3. Ràng buộc bảo mật UX & UI Truncation', () => {
    it('3.1 tooltip của candidate_solution KHÔNG chứa UUID / solution_id', () => {
      const { container } = render(
        <NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION_NUMERIC} />
      )
      const elementWithTitle = container.querySelector('[title]')
      const titleValue = elementWithTitle?.getAttribute('title') || ''
      expect(titleValue).not.toContain(VALID_CANDIDATE_SOLUTION_NUMERIC.solution_id)
      expect(titleValue).not.toMatch(
        /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
      )
    })

    it('3.2 text node hiển thị của badge không bị rò rỉ chi tiết provenance vào DOM text', () => {
      const { container: c1 } = render(<NoteSourceBadge sourceContext={VALID_TRIZ_9_WINDOWS} />)
      expect(screen.queryByText(/Quá khứ \/ Hệ thống/i)).not.toBeInTheDocument()

      const { container: c2 } = render(<NoteSourceBadge sourceContext={VALID_TRIZ_MATRIX} />)
      expect(screen.queryByText(/param/i)).not.toBeInTheDocument()

      const { container: c3 } = render(<NoteSourceBadge sourceContext={VALID_PRINCIPLE_SUGGESTION} />)
      expect(screen.queryByText(/method-triz-param-transform/i)).not.toBeInTheDocument()

      const { container: c4 } = render(<NoteSourceBadge sourceContext={VALID_EVIDENCE} />)
      expect(screen.queryByText(/vật liệu composite/i)).not.toBeInTheDocument()

      const { container: c5 } = render(<NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION_NUMERIC} />)
      expect(screen.queryByText(/550e8400/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/accepted/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Đã chấp nhận/i)).not.toBeInTheDocument()
    })

    it('3.3 badge element và inner text element đều chứa class truncate', () => {
      const { container } = render(<NoteSourceBadge sourceContext={VALID_TRIZ_9_WINDOWS} />)
      const truncateElements = container.querySelectorAll('.truncate')
      expect(truncateElements.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('4. Fail-safe: null, undefined, invalid context trả về null', () => {
    it('sourceContext là undefined => không render gì', () => {
      const { container } = render(<NoteSourceBadge sourceContext={undefined} />)
      expect(container.firstChild).toBeNull()
    })

    it('sourceContext là null => không render gì', () => {
      const { container } = render(<NoteSourceBadge sourceContext={null} />)
      expect(container.firstChild).toBeNull()
    })

    it('sourceContext không phải object (string, number, boolean) => không render gì', () => {
      const { container: c1 } = render(<NoteSourceBadge sourceContext="invalid-string" />)
      expect(c1.firstChild).toBeNull()

      const { container: c2 } = render(<NoteSourceBadge sourceContext={12345} />)
      expect(c2.firstChild).toBeNull()

      const { container: c3 } = render(<NoteSourceBadge sourceContext={true} />)
      expect(c3.firstChild).toBeNull()
    })

    it('sourceContext là object invalid (thiếu trường, sai source_type, thừa trường lạ) => không render gì', () => {
      const { container: c1 } = render(
        <NoteSourceBadge sourceContext={{ source_type: 'unknown_source' }} />
      )
      expect(c1.firstChild).toBeNull()

      const { container: c2 } = render(
        <NoteSourceBadge
          sourceContext={{
            ...VALID_TRIZ_9_WINDOWS,
            schema_version: 2,
          }}
        />
      )
      expect(c2.firstChild).toBeNull()

      const { container: c3 } = render(
        <NoteSourceBadge
          sourceContext={{
            ...VALID_CANDIDATE_SOLUTION_NUMERIC,
            solution_id: 'not-a-uuid',
          }}
        />
      )
      expect(c3.firstChild).toBeNull()
    })
  })
})
