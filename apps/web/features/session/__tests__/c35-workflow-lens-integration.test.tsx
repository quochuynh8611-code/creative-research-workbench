/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkflowProfileGuidance } from '../workflow-profile-guidance'
import { resolveLensFromDomain } from '@/lib/triz-lens-resolver'
import * as apiClient from '@/lib/api-client'
import type { WorkflowProfilesResponse } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  getWorkflowProfiles: jest.fn(),
}))

const mockedGetWorkflowProfiles = apiClient.getWorkflowProfiles as jest.MockedFunction<typeof apiClient.getWorkflowProfiles>

const MOCK_PROFILES_RESPONSE: WorkflowProfilesResponse = {
  data: [
    {
      id: 'standard_triz',
      name_vi: 'Quy trình TRIZ Tiêu chuẩn (6 Bước)',
      name_en: 'Standard TRIZ Workflow',
      description_vi: 'Quy trình tuần tự cổ điển đi từ phân tích mâu thuẫn.',
      description_en: 'Classic sequential methodology.',
      recommended_lenses: ['engineering', 'business'],
      stages_guidance: {
        intake: 'Thu thập thông tin bối cảnh.',
        structuring: 'Xác định thông số cần cải thiện và suy giảm.',
        ideation: 'Ứng dụng 40 nguyên tắc sáng tạo.',
      },
    },
    {
      id: 'rapid_prototyping',
      name_vi: 'Tạo Mẫu Thử Nghiệm Nhanh (Rapid Prototyping)',
      name_en: 'Rapid Prototyping Workflow',
      description_vi: 'Luồng tối ưu cho chu kỳ lặp nhanh.',
      description_en: 'Fast-iteration workflow.',
      recommended_lenses: ['design_thinking', 'lean_startup'],
      stages_guidance: {
        intake: 'Nhận diện vấn đề cốt lõi của người dùng.',
        structuring: 'Đóng khung mâu thuẫn then chốt.',
        ideation: 'Sinh phương án MVP tối thiểu.',
      },
    },
    {
      id: 'stakeholder_alignment',
      name_vi: 'Đồng Thuận Đa Bên (Stakeholder Alignment)',
      name_en: 'Stakeholder Alignment Workflow',
      description_vi: 'Luồng tối ưu cho bài toán xung đột lợi ích.',
      description_en: 'Consensus-building workflow.',
      recommended_lenses: ['systems_thinking', 'business'],
      stages_guidance: {
        intake: 'Lập bản đồ các bên liên quan.',
        structuring: 'Mô hình hóa xung đột lợi ích.',
        ideation: 'Đồng sáng tạo giải pháp Win-Win.',
      },
    },
  ],
  meta: { total: 3 },
}

describe('Batch C35 PR 3: End-to-End Workflow & Lens Integration Test', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  function renderComponent(props = {}) {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkflowProfileGuidance {...props} />
      </QueryClientProvider>
    )
  }

  it('1. test_session_detail_workflow_profile_guidance_e2e: verifies full guidance flow and lens interaction', async () => {
    mockedGetWorkflowProfiles.mockResolvedValue(MOCK_PROFILES_RESPONSE)
    const onSelectLens = jest.fn()

    renderComponent({ currentStage: 'structuring', onSelectLens })

    await waitFor(() => {
      expect(screen.getByText('Quy trình TRIZ Tiêu chuẩn (6 Bước)')).toBeInTheDocument()
      expect(screen.getByText('Tạo Mẫu Thử Nghiệm Nhanh (Rapid Prototyping)')).toBeInTheDocument()
      expect(screen.getByText('Đồng Thuận Đa Bên (Stakeholder Alignment)')).toBeInTheDocument()
    })

    // Verify domain resolution
    expect(resolveLensFromDomain('healthcare')).toBe('systems_thinking')

    // Switch to Rapid Prototyping
    const rapidBtn = screen.getByRole('button', { name: /Tạo Mẫu Thử Nghiệm Nhanh/i })
    fireEvent.click(rapidBtn)

    // Check recommended lens badges appear
    const dtLensBadge = screen.getByRole('button', { name: 'Tư duy Thiết kế' })
    expect(dtLensBadge).toBeInTheDocument()
    fireEvent.click(dtLensBadge)
    expect(onSelectLens).toHaveBeenCalledWith('design_thinking')
  })

  it('2. test_workflow_profile_guidance_error_boundary_resilience: renders error alert gracefully on 500 error', async () => {
    mockedGetWorkflowProfiles.mockRejectedValue(new Error('Internal Server Error 500'))
    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('workflow-profiles-error')).toBeInTheDocument()
      expect(screen.getByText(/Không thể tải hồ sơ quy trình làm việc/i)).toBeInTheDocument()
    })
  })

  it('3. test_workflow_profile_guidance_empty_payload_safety: handles empty data array gracefully without crashing', async () => {
    mockedGetWorkflowProfiles.mockResolvedValue({ data: [], meta: { total: 0 } })
    const { container } = renderComponent()

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('4. test_cross_domain_lens_resolution_consistency: checks dynamic resolver for all domains', () => {
    expect(resolveLensFromDomain('healthcare')).toBe('systems_thinking')
    expect(resolveLensFromDomain('education')).toBe('design_thinking')
    expect(resolveLensFromDomain('sustainability')).toBe('systems_thinking')
    expect(resolveLensFromDomain('business')).toBe('business')
    expect(resolveLensFromDomain('technical')).toBe('engineering')
    expect(resolveLensFromDomain('life')).toBe('everyday')
  })
})
