/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakeForm } from '@/features/intake/intake-form'
import { CandidateSolutions } from '@/features/ideation/candidate-solutions'
import { ResearchNotebook } from '@/features/notebook/research-notebook'
import { SessionList } from '@/features/session/session-list'
import * as apiClient from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  createProblemFrame: jest.fn(),
  createResearchNote: jest.fn(),
  createCandidateSolution: jest.fn(),
  listResearchNotes: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  listCandidateSolutions: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  listSessions: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  createSession: jest.fn(),
  getSessionTemplates: jest.fn().mockResolvedValue({ templates: [], total: 0 }),
  getEmbeddingStatus: jest.fn().mockResolvedValue({ status: 'ready', provider: 'mock' }),
  getAIStatus: jest.fn().mockResolvedValue({ status: 'ready', provider: 'mock' }),
}))

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

describe('C38-GAP-05: Form Field Accessibility Improvements (WCAG 2.1 AA)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = createTestClient()
    jest.clearAllMocks()
  })

  describe('1. IntakeForm Accessibility', () => {
    it('1.1 Trường bắt buộc (wantText, obstacleText) có aria-required="true"', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <IntakeForm sessionId="ses-a11y-1" />
        </QueryClientProvider>
      )

      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được/i)
      const obstacleInput = screen.getByLabelText(/Nhưng lại bị vướng/i)

      expect(wantInput).toHaveAttribute('aria-required', 'true')
      expect(obstacleInput).toHaveAttribute('aria-required', 'true')
    })

    it('1.2 Khi submit để trống trường bắt buộc, kích hoạt aria-invalid="true", aria-describedby và focus vào trường đầu tiên bị lỗi', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <IntakeForm sessionId="ses-a11y-1" />
        </QueryClientProvider>
      )

      const wantInput = screen.getByLabelText(/Điều tôi muốn đạt được/i)
      const form = wantInput.closest('form')!

      // Dispatch submit event on form
      fireEvent.submit(form)

      await waitFor(() => {
        expect(wantInput).toHaveAttribute('aria-invalid', 'true')
        const describedBy = wantInput.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        const errorElem = document.getElementById(describedBy!)
        expect(errorElem).toBeInTheDocument()
        expect(errorElem).toHaveAttribute('role', 'alert')
        expect(wantInput).toHaveFocus()
      })
    })
  })

  describe('2. CandidateSolutions Accessibility', () => {
    it('2.1 Trường tiêu đề và cơ chế có aria-required="true"', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CandidateSolutions sessionId="ses-a11y-2" />
        </QueryClientProvider>
      )

      const titleInput = screen.getByLabelText(/Tiêu đề giải pháp/i)
      const mechanismTextarea = screen.getByLabelText(/Cơ chế hoạt động/i)

      expect(titleInput).toHaveAttribute('aria-required', 'true')
      expect(mechanismTextarea).toHaveAttribute('aria-required', 'true')
    })

    it('2.2 Khi submit giải pháp rỗng, kích hoạt aria-invalid="true", aria-describedby trỏ tới error message role="alert", và focus vào tiêu đề', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CandidateSolutions sessionId="ses-a11y-2" />
        </QueryClientProvider>
      )

      const titleInput = screen.getByLabelText(/Tiêu đề giải pháp/i)
      const submitBtn = screen.getByRole('button', { name: /Lưu giải pháp/i })

      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(titleInput).toHaveAttribute('aria-invalid', 'true')
        const describedBy = titleInput.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        const errorElem = document.getElementById(describedBy!)
        expect(errorElem).toBeInTheDocument()
        expect(errorElem).toHaveAttribute('role', 'alert')
        expect(titleInput).toHaveFocus()
      })
    })

    it('2.3 Range sliders (Novelty, Feasibility) có đủ thuộc tính ARIA: valuemin, valuemax, valuenow, valuetext', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <CandidateSolutions sessionId="ses-a11y-2" />
        </QueryClientProvider>
      )

      const noveltySlider = screen.getByLabelText(/Điểm mới/i)
      const feasibilitySlider = screen.getByLabelText(/Tính khả thi/i)

      expect(noveltySlider).toHaveAttribute('aria-valuemin', '0')
      expect(noveltySlider).toHaveAttribute('aria-valuemax', '1')
      expect(noveltySlider).toHaveAttribute('aria-valuenow')
      expect(noveltySlider).toHaveAttribute('aria-valuetext')

      expect(feasibilitySlider).toHaveAttribute('aria-valuemin', '0')
      expect(feasibilitySlider).toHaveAttribute('aria-valuemax', '1')
      expect(feasibilitySlider).toHaveAttribute('aria-valuenow')
      expect(feasibilitySlider).toHaveAttribute('aria-valuetext')
    })
  })

  describe('3. ResearchNotebook Accessibility', () => {
    it('3.1 Ô nhập nội dung ghi chú có aria-required="true"', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            sessionId="ses-a11y-3"
            initialDraft={null}
            content=""
            noteType="insight"
            onContentChange={jest.fn()}
            onNoteTypeChange={jest.fn()}
            onClearDraft={jest.fn()}
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const contentTextarea = screen.getByLabelText(/Nội dung ghi chú/i)
      expect(contentTextarea).toHaveAttribute('aria-required', 'true')
    })

    it('3.2 Khi submit ghi chú rỗng, textarea nhận aria-invalid="true", aria-describedby trỏ tới error role="alert", và focus vào textarea', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <ResearchNotebook
            sessionId="ses-a11y-3"
            initialDraft={null}
            content=""
            noteType="insight"
            onContentChange={jest.fn()}
            onNoteTypeChange={jest.fn()}
            onClearDraft={jest.fn()}
            onNoteCreated={jest.fn()}
          />
        </QueryClientProvider>
      )

      const contentTextarea = screen.getByLabelText(/Nội dung ghi chú/i)
      const submitBtn = screen.getByRole('button', { name: /Lưu ghi chú/i })

      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(contentTextarea).toHaveAttribute('aria-invalid', 'true')
        const describedBy = contentTextarea.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        const errorElem = document.getElementById(describedBy!)
        expect(errorElem).toBeInTheDocument()
        expect(errorElem).toHaveAttribute('role', 'alert')
        expect(contentTextarea).toHaveFocus()
      })
    })
  })

  describe('4. SessionList Accessibility', () => {
    it('4.1 Ô tìm kiếm session có accessible name/label rõ ràng', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SessionList />
        </QueryClientProvider>
      )

      await waitFor(() => {
        const searchInput = screen.getByRole('textbox', { name: /Tìm session theo tên/i })
        expect(searchInput).toBeInTheDocument()
      })
    })

    it('4.2 Form tạo session: Tiêu đề có aria-required="true", khi submit rỗng bật aria-invalid="true", aria-describedby và focus vào tiêu đề', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SessionList />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Tạo session mới/i })).toBeInTheDocument()
      })

      // Mở form tạo session
      const openFormBtn = screen.getByRole('button', { name: /Tạo session mới/i })
      fireEvent.click(openFormBtn)

      const titleInput = screen.getByRole('textbox', { name: /Tiêu đề session|Tiêu đề/i })
      expect(titleInput).toHaveAttribute('aria-required', 'true')

      // Submit khi để trống
      const submitBtn = screen.getByRole('button', { name: /Tạo session/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(titleInput).toHaveAttribute('aria-invalid', 'true')
        const describedBy = titleInput.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        const errorElem = document.getElementById(describedBy!)
        expect(errorElem).toBeInTheDocument()
        expect(errorElem).toHaveAttribute('role', 'alert')
        expect(titleInput).toHaveFocus()
      })
    })
  })
})
