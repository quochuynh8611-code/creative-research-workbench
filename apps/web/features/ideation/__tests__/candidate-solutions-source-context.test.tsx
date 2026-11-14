/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CandidateSolutions } from '../candidate-solutions'
import * as apiClient from '@/lib/api-client'
import type { CandidateSolutionsResponse, CandidateSolution, NoteDraft } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listCandidateSolutions: jest.fn(),
  createCandidateSolution: jest.fn(),
  updateCandidateSolution: jest.fn(),
  deleteCandidateSolution: jest.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

describe('Batch C7c-2f: CandidateSolutions source_context UI Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const validSolutionAccepted: CandidateSolution = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    session_id: 'ses-123',
    title: 'Cánh tản nhiệt vi kênh đa tầng',
    mechanism: 'Ứng dụng vi dòng chảy cưỡng bức để giảm gradient nhiệt.',
    status: 'accepted',
    novelty_score: 0.9,
    feasibility_score: 0.8,
    risk_notes: null,
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-01T09:30:00Z',
  }

  const validSolutionCandidate: CandidateSolution = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    session_id: 'ses-123',
    title: 'Màng nano polymer tự phục hồi',
    mechanism: 'Cơ chế tự liên kết ngang khi xuất hiện vết nứt vi mô.',
    status: 'candidate',
    novelty_score: 0.85,
    feasibility_score: 0.75,
    risk_notes: 'Cần kiểm chứng độ ổn định nhiệt.',
    created_at: '2026-10-01T08:30:00Z',
    updated_at: '2026-10-01T08:30:00Z',
  }

  const validSolutionRejected: CandidateSolution = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    session_id: 'ses-123',
    title: 'Gia nhiệt điện trở cuộn dây trần',
    mechanism: 'Dùng nhiệt trực tiếp không qua lớp cách ly.',
    status: 'rejected',
    novelty_score: 0.2,
    feasibility_score: 0.9,
    risk_notes: 'Nguy cơ chập cháy quá cao.',
    created_at: '2026-10-01T07:00:00Z',
    updated_at: '2026-10-01T07:15:00Z',
  }

  it('1. Happy path: solution accepted => note_type "decision", source_context chuẩn 4 trường, không principle_used', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [validSolutionAccepted],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Cánh tản nhiệt vi kênh đa tầng')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft: NoteDraft = onSaveAsNoteMock.mock.calls[0][0]

    expect(draft.note_type).toBe('decision')
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'candidate_solution',
      solution_id: '550e8400-e29b-41d4-a716-446655440001',
      solution_status: 'accepted',
    })
    expect(draft.source_context).not.toHaveProperty('principle_used')
  })

  it('2. Happy path: solution candidate => note_type "hypothesis", source_context status "candidate"', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [validSolutionCandidate],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft: NoteDraft = onSaveAsNoteMock.mock.calls[0][0]

    expect(draft.note_type).toBe('hypothesis')
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'candidate_solution',
      solution_id: '550e8400-e29b-41d4-a716-446655440002',
      solution_status: 'candidate',
    })
  })

  it('3. Happy path: solution rejected => note_type "hypothesis", source_context status "rejected"', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [validSolutionRejected],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Gia nhiệt điện trở cuộn dây trần')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft: NoteDraft = onSaveAsNoteMock.mock.calls[0][0]

    expect(draft.note_type).toBe('hypothesis')
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'candidate_solution',
      solution_id: '550e8400-e29b-41d4-a716-446655440003',
      solution_status: 'rejected',
    })
  })

  it('4. Fail-closed: khi solution_id không phải UUID hợp lệ, chặn onSaveAsNote và hiển thị role="alert"', async () => {
    const invalidSolution: CandidateSolution = {
      ...validSolutionAccepted,
      id: 'sol-invalid-not-uuid',
    }
    const mockResponse: CandidateSolutionsResponse = {
      data: [invalidSolution],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Cánh tản nhiệt vi kênh đa tầng')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alertEl = await screen.findByRole('alert')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl.textContent).toMatch(/solution_id|uuid|không thể tạo context/i)
  })

  it('5. Fail-closed: khi solution_status không hợp lệ, chặn onSaveAsNote và hiển thị role="alert"', async () => {
    const invalidStatusSolution = {
      ...validSolutionAccepted,
      status: 'unknown_status' as any,
    }
    const mockResponse: CandidateSolutionsResponse = {
      data: [invalidStatusSolution],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Cánh tản nhiệt vi kênh đa tầng')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alertEl = await screen.findByRole('alert')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl.textContent).toMatch(/solution_status|trạng thái|không thể tạo context/i)
  })

  it('6. Bảo vệ schema: tuyệt đối không đưa title, mechanism, risk_notes, novelty_score vào source_context', async () => {
    const mockResponse: CandidateSolutionsResponse = {
      data: [validSolutionCandidate],
      meta: { total: 1, session_id: 'ses-123' },
    }
    ;(apiClient.listCandidateSolutions as jest.Mock).mockResolvedValueOnce(mockResponse)
    const onSaveAsNoteMock = jest.fn()
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <CandidateSolutions sessionId="ses-123" onSaveAsNote={onSaveAsNoteMock} />
      </QueryClientProvider>
    )

    await screen.findByText('Màng nano polymer tự phục hồi')

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft: NoteDraft = onSaveAsNoteMock.mock.calls[0][0]
    const ctx = draft.source_context as Record<string, unknown>

    expect(ctx).toBeDefined()
    expect(ctx).not.toHaveProperty('title')
    expect(ctx).not.toHaveProperty('mechanism')
    expect(ctx).not.toHaveProperty('risk_notes')
    expect(ctx).not.toHaveProperty('novelty_score')
    expect(ctx).not.toHaveProperty('feasibility_score')
    expect(ctx).not.toHaveProperty('source_chunk_id')
    expect(ctx).not.toHaveProperty('chunk_id')
    expect(ctx).not.toHaveProperty('score')
  })
})
