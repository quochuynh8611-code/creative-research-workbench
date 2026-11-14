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

describe('Batch C7c-3a: NoteSourceBadge Unit Tests', () => {
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

  const VALID_CANDIDATE_SOLUTION: CandidateSolutionSourceContext = {
    schema_version: 1,
    source_type: 'candidate_solution',
    solution_id: '550e8400-e29b-41d4-a716-446655440001',
    solution_status: 'accepted',
    principle_used: 35,
  }

  describe('1. Happy Paths: Render đúng nhãn cho 5 source_type hợp lệ', () => {
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
      render(<NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION} />)
      const badge = screen.getByText('Giải pháp ứng viên')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('2. Ràng buộc hiển thị: title và class truncate', () => {
    it.each([
      ['triz_9_windows', VALID_TRIZ_9_WINDOWS, 'Lưới 9 màn hình'],
      ['triz_matrix', VALID_TRIZ_MATRIX, 'Ma trận TRIZ'],
      ['principle_suggestion', VALID_PRINCIPLE_SUGGESTION, 'Gợi ý nguyên tắc'],
      ['evidence', VALID_EVIDENCE, 'Bằng chứng'],
      ['candidate_solution', VALID_CANDIDATE_SOLUTION, 'Giải pháp ứng viên'],
    ])('mỗi badge %s phải có title bằng đúng nhãn nguồn và chứa class truncate', (_, context, expectedLabel) => {
      const { container } = render(<NoteSourceBadge sourceContext={context} />)
      const badge = screen.getByText(expectedLabel)
      expect(badge).toBeInTheDocument()

      const elementWithTitle = container.querySelector(`[title="${expectedLabel}"]`)
      expect(elementWithTitle).toBeInTheDocument()

      const elementWithTruncate = container.querySelector('.truncate')
      expect(elementWithTruncate).toBeInTheDocument()
    })
  })

  describe('3. Ràng buộc tối giản: Không rò rỉ chi tiết nghiệp vụ vào badge', () => {
    it('không hiển thị cell_label "Quá khứ / Hệ thống" của triz_9_windows', () => {
      render(<NoteSourceBadge sourceContext={VALID_TRIZ_9_WINDOWS} />)
      expect(screen.queryByText(/Quá khứ \/ Hệ thống/i)).not.toBeInTheDocument()
    })

    it('không hiển thị principle_id hay param_id của triz_matrix', () => {
      render(<NoteSourceBadge sourceContext={VALID_TRIZ_MATRIX} />)
      expect(screen.queryByText(/35/)).not.toBeInTheDocument()
      expect(screen.queryByText(/param/i)).not.toBeInTheDocument()
    })

    it('không hiển thị method_id của principle_suggestion', () => {
      render(<NoteSourceBadge sourceContext={VALID_PRINCIPLE_SUGGESTION} />)
      expect(screen.queryByText(/method-triz-param-transform/i)).not.toBeInTheDocument()
    })

    it('không hiển thị source_ref của evidence', () => {
      render(<NoteSourceBadge sourceContext={VALID_EVIDENCE} />)
      expect(screen.queryByText(/vật liệu composite/i)).not.toBeInTheDocument()
    })

    it('không hiển thị solution_id hay status của candidate_solution', () => {
      render(<NoteSourceBadge sourceContext={VALID_CANDIDATE_SOLUTION} />)
      expect(screen.queryByText(/550e8400/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/accepted/i)).not.toBeInTheDocument()
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
            ...VALID_CANDIDATE_SOLUTION,
            solution_id: 'not-a-uuid',
          }}
        />
      )
      expect(c3.firstChild).toBeNull()
    })
  })
})
