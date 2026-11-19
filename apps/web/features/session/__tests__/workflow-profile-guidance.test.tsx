/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkflowProfileGuidance } from '../workflow-profile-guidance'
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

describe('Workflow Profile Guidance Component — Batch C35', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    mockedGetWorkflowProfiles.mockResolvedValue(MOCK_PROFILES_RESPONSE)
  })

  function renderComponent(props = {}) {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkflowProfileGuidance {...props} />
      </QueryClientProvider>
    )
  }

  it('1. test_renders_all_3_workflow_profiles: hiển thị đủ 3 profiles', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Quy trình TRIZ Tiêu chuẩn (6 Bước)')).toBeInTheDocument()
      expect(screen.getByText('Tạo Mẫu Thử Nghiệm Nhanh (Rapid Prototyping)')).toBeInTheDocument()
      expect(screen.getByText('Đồng Thuận Đa Bên (Stakeholder Alignment)')).toBeInTheDocument()
    })
  })

  it('2. test_highlights_active_stage_guidance: làm nổi bật hướng dẫn theo currentStage', async () => {
    renderComponent({ currentStage: 'structuring' })

    await waitFor(() => {
      expect(screen.getByText('Xác định thông số cần cải thiện và suy giảm.')).toBeInTheDocument()
    })
  })

  it('3. test_switching_profiles_updates_guidance_display', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Quy trình TRIZ Tiêu chuẩn (6 Bước)')).toBeInTheDocument()
    })

    const rapidTab = screen.getByRole('button', { name: /Tạo Mẫu Thử Nghiệm Nhanh/i })
    fireEvent.click(rapidTab)

    expect(screen.getByText('Sinh phương án MVP tối thiểu.')).toBeInTheDocument()
  })

  it('4. test_persists_selected_profile_to_local_storage_and_restores_on_remount', async () => {
    const sessionId = 'session-c36-test'
    const storageKey = `crw:session:${sessionId}:workflow-profile:v1`
    localStorage.clear()

    const { unmount } = renderComponent({ sessionId })

    await waitFor(() => {
      expect(screen.getByText('Quy trình TRIZ Tiêu chuẩn (6 Bước)')).toBeInTheDocument()
    })

    // Chọn profile Rapid Prototyping
    const rapidTab = screen.getByRole('button', { name: /Tạo Mẫu Thử Nghiệm Nhanh/i })
    fireEvent.click(rapidTab)

    // Kiểm tra localStorage đã lưu profile
    expect(localStorage.getItem(storageKey)).toBe('rapid_prototyping')

    // Unmount component
    unmount()

    // Re-mount với cùng sessionId
    renderComponent({ sessionId })

    // Phải tự động khôi phục profile Rapid Prototyping
    await waitFor(() => {
      expect(screen.getByText('Chi tiết: Tạo Mẫu Thử Nghiệm Nhanh (Rapid Prototyping)')).toBeInTheDocument()
      expect(screen.getByText('Sinh phương án MVP tối thiểu.')).toBeInTheDocument()
    })
  })
})
