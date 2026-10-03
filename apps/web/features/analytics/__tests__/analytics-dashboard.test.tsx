/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClient from '@/lib/api-client'
import type { AnalyticsOverviewResponse } from '@/lib/types'
import { AnalyticsDashboard } from '../analytics-dashboard'

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  getAnalyticsOverview: jest.fn(),
}))

const mockedGetAnalyticsOverview = apiClient.getAnalyticsOverview as jest.MockedFunction<any>

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
}

const mockPopulatedOverview: AnalyticsOverviewResponse = {
  data: {
    sessions: {
      total: 12,
      by_status: { active: 5, paused: 3, completed: 4 },
      by_workflow_state: { structuring: 4, ideation: 6, idle: 2 },
      by_domain: { technical: 7, business: 3, unassigned: 2 },
    },
    content: {
      total_problem_frames: 8,
      total_research_notes: 15,
      notes_by_type: { insight: 6, hypothesis: 5, decision: 4 },
      total_candidate_solutions: 9,
      solutions_by_status: { candidate: 5, accepted: 4 },
    },
    knowledge_base: {
      total_documents: 10,
      golden_documents: 4,
      total_chunks: 42,
    },
    triz: {
      total_contradictions: 6,
      by_contradiction_type: { technical: 4, physical: 2 },
    },
  },
  generated_at: '2026-10-03T12:00:00.000Z',
}

const mockEmptyOverview: AnalyticsOverviewResponse = {
  data: {
    sessions: {
      total: 0,
      by_status: {},
      by_workflow_state: {},
      by_domain: {},
    },
    content: {
      total_problem_frames: 0,
      total_research_notes: 0,
      notes_by_type: {},
      total_candidate_solutions: 0,
      solutions_by_status: {},
    },
    knowledge_base: {
      total_documents: 0,
      golden_documents: 0,
      total_chunks: 0,
    },
    triz: {
      total_contradictions: 0,
      by_contradiction_type: {},
    },
  },
  generated_at: '2026-10-03T12:00:00.000Z',
}

const mockMixedOverview: AnalyticsOverviewResponse = {
  data: {
    sessions: {
      total: 5,
      by_status: {},
      by_workflow_state: { structuring: 3, ideation: 2 },
      by_domain: {},
    },
    content: {
      total_problem_frames: 4,
      total_research_notes: 6,
      notes_by_type: { insight: 4, decision: 2 },
      total_candidate_solutions: 5,
      solutions_by_status: {},
    },
    knowledge_base: {
      total_documents: 8,
      golden_documents: 3,
      total_chunks: 25,
    },
    triz: {
      total_contradictions: 3,
      by_contradiction_type: {},
    },
  },
  generated_at: '2026-10-03T12:00:00.000Z',
}

describe('AnalyticsDashboard Component (Phase 11.1B)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Test 1: Loading State
  it('renders_loading_state_while_fetching_analytics', () => {
    mockedGetAnalyticsOverview.mockReturnValue(new Promise(() => {}))

    renderWithClient(<AnalyticsDashboard />)

    expect(
      screen.getByTestId('analytics-loading-skeleton') ||
        screen.getByText(/đang tải dữ liệu phân tích/i)
    ).toBeInTheDocument()
  })

  // Test 2: Error State & Retry
  it('renders_error_state_and_retries_on_button_click', async () => {
    mockedGetAnalyticsOverview.mockRejectedValueOnce(new Error('Network error'))

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByText(/không thể tải dữ liệu phân tích/i)).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /thử lại/i })
    expect(retryButton).toBeInTheDocument()

    // Mock successful response on retry
    mockedGetAnalyticsOverview.mockResolvedValueOnce(mockPopulatedOverview)
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(mockedGetAnalyticsOverview).toHaveBeenCalledTimes(2)
    })
  })

  // Test 3: Zero/Empty State
  it('renders_zero_state_for_empty_analytics_payload', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockEmptyOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Assert zero totals
    expect(screen.getByTestId('stat-total-sessions')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-total-solutions')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-total-documents')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-total-contradictions')).toHaveTextContent('0')

    // Assert empty notices
    const emptyNotices = screen.getAllByText(/chưa có dữ liệu/i)
    expect(emptyNotices.length).toBeGreaterThan(0)
  })

  // Test 4: Populated Dashboard
  it('renders_populated_dashboard_sections_from_analytics_response', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // 1. Top KPI Cards
    expect(screen.getByTestId('stat-total-sessions')).toHaveTextContent('12')
    expect(screen.getByTestId('stat-total-solutions')).toHaveTextContent('9')
    expect(screen.getByTestId('stat-total-documents')).toHaveTextContent('10')
    expect(screen.getByTestId('stat-total-contradictions')).toHaveTextContent('6')

    // 2. Sessions section breakdowns
    expect(screen.getByText(/active/i)).toBeInTheDocument()
    expect(screen.getAllByText(/technical/i).length).toBeGreaterThanOrEqual(1)

    // 3. Content section breakdowns
    expect(screen.getByText(/insight/i)).toBeInTheDocument()

    // 4. TRIZ section breakdowns
    expect(screen.getByText(/physical/i)).toBeInTheDocument()
  })

  // Test 5: Manual Refresh Action
  it('renders_refresh_action_for_manual_reload', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const refreshButton = screen.getByRole('button', { name: /làm mới/i })
    expect(refreshButton).toBeInTheDocument()

    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockedGetAnalyticsOverview).toHaveBeenCalledTimes(2)
    })
  })

  // Phase 11.3: Contextual Deep Links (RED suite)
  // Test A: Header contextual links to core workspaces
  it('renders_header_contextual_links_to_core_workspaces', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Header should contain contextual links
    const sessionsLink = screen.getByRole('link', { name: /sessions/i })
    expect(sessionsLink).toHaveAttribute('href', '/sessions')

    const knowledgeLink = screen.getByRole('link', { name: /cơ sở tri thức/i })
    expect(knowledgeLink).toHaveAttribute('href', '/knowledge')

    const searchLink = screen.getByRole('link', { name: /tìm kiếm/i })
    expect(searchLink).toHaveAttribute('href', '/search')
  })

  // Test B: Contextual link in Research Sessions KPI card
  it('renders_contextual_link_in_research_sessions_kpi_card', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const sessionsStat = screen.getByTestId('stat-total-sessions')
    const sessionsCard = sessionsStat.parentElement!
    const cardLink = within(sessionsCard).getByRole('link')
    expect(cardLink).toHaveAttribute('href', '/sessions')
  })

  // Test C: Contextual link in Knowledge Base KPI card
  it('renders_contextual_link_in_knowledge_base_kpi_card', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const documentsStat = screen.getByTestId('stat-total-documents')
    const documentsCard = documentsStat.parentElement!
    const cardLink = within(documentsCard).getByRole('link')
    expect(cardLink).toHaveAttribute('href', '/knowledge')
  })

  // Phase 11.4: Actionable Empty-State Guidance (RED suite)
  // Test 1: Actionable empty state when all metrics are zero
  it('renders_actionable_empty_state_guidance_when_all_analytics_metrics_are_zero', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockEmptyOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // 1. Heading / Description guidance
    expect(
      screen.getByText(/chưa có dữ liệu nghiên cứu & tri thức/i)
    ).toBeInTheDocument()

    // 2. Actionable CTAs
    const createSessionCTA = screen.getByRole('link', {
      name: /tạo research session đầu tiên/i,
    })
    expect(createSessionCTA).toHaveAttribute('href', '/sessions')

    const openKnowledgeCTA = screen.getByRole('link', {
      name: /mở cơ sở tri thức/i,
    })
    expect(openKnowledgeCTA).toHaveAttribute('href', '/knowledge')
  })

  // Test 2: Does not render global empty state guidance when populated
  it('does_not_render_global_empty_state_guidance_when_dashboard_has_data', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Assert guidance panel and CTAs are NOT rendered
    expect(
      screen.queryByText(/chưa có dữ liệu nghiên cứu & tri thức/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /tạo research session đầu tiên/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /mở cơ sở tri thức/i })
    ).not.toBeInTheDocument()
  })

  // Phase 11.5: Section-Level Contextual Navigation (RED suite)
  // Test 1: Section 1 (Sessions Breakdown) header contextual link
  it('renders_contextual_link_in_sessions_breakdown_section_header', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const sectionLink = screen.getByRole('link', { name: /xem toàn bộ phiên/i })
    expect(sectionLink).toHaveAttribute('href', '/sessions')
  })

  // Test 2: Section 2 (Content & Solutions) header contextual link
  it('renders_contextual_link_in_content_and_solutions_section_header', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const sectionLink = screen.getByRole('link', { name: /xem các giải pháp/i })
    expect(sectionLink).toHaveAttribute('href', '/sessions')
  })

  // Test 3: Section 3 (Knowledge Base & TRIZ) header contextual links
  it('renders_contextual_links_in_knowledge_and_triz_section_header', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const knowledgeLink = screen.getByRole('link', { name: /kho tri thức/i })
    expect(knowledgeLink).toHaveAttribute('href', '/knowledge')

    const searchLink = screen.getByRole('link', { name: /tra cứu semantic/i })
    expect(searchLink).toHaveAttribute('href', '/search')
  })

  // Phase 11.6: Section-Local Empty Breakdown Affordance (RED suite)
  // Test 1: Local-empty guidance when sessions breakdown is empty
  it('renders_section_local_empty_guidance_when_sessions_breakdown_is_empty', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockMixedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Subsections by_status and by_domain are empty
    const emptyNotices = screen.getAllByText(/chưa có phân loại phiên để hiển thị/i)
    expect(emptyNotices.length).toBeGreaterThanOrEqual(1)

    // Contextual link in local empty state
    const openSessionsLinks = screen.getAllByRole('link', { name: /mở sessions/i })
    expect(openSessionsLinks.length).toBeGreaterThanOrEqual(1)
    expect(openSessionsLinks[0]).toHaveAttribute('href', '/sessions')
  })

  // Test 2: Local-empty guidance when solutions breakdown is empty
  it('renders_section_local_empty_guidance_when_solutions_breakdown_is_empty', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockMixedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    expect(
      screen.getByText(/chưa có trạng thái giải pháp để phân tích/i)
    ).toBeInTheDocument()

    const viewSessionsLinks = screen.getAllByRole('link', { name: /xem sessions/i })
    expect(viewSessionsLinks.length).toBeGreaterThanOrEqual(1)
    expect(viewSessionsLinks[0]).toHaveAttribute('href', '/sessions')
  })

  // Test 3: Local-empty guidance when TRIZ breakdown is empty
  it('renders_section_local_empty_guidance_when_triz_breakdown_is_empty', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockMixedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    expect(
      screen.getByText(/chưa có loại mâu thuẫn để phân tích/i)
    ).toBeInTheDocument()
  })

  // Test 4: Preserves populated breakdown chips and does not render global empty state in mixed data
  it('preserves_populated_breakdown_chips_and_hides_global_empty_state_in_mixed_data', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockMixedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Populated chips still render
    expect(screen.getByText(/structuring/i)).toBeInTheDocument()
    expect(screen.getByText(/insight/i)).toBeInTheDocument()

    expect(
      screen.queryByRole('link', { name: /tạo research session đầu tiên/i })
    ).not.toBeInTheDocument()
  })

  // Phase 11.7: KPI Contextual Drilldown Completion (RED suite)
  // Test 1: Contextual link in Candidate Solutions KPI card
  it('renders_contextual_link_in_candidate_solutions_kpi_card', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const solutionsStat = screen.getByTestId('stat-total-solutions')
    const solutionsCard = solutionsStat.parentElement!
    const cardLink = within(solutionsCard).getByRole('link', { name: /xem giải pháp/i })
    expect(cardLink).toHaveAttribute('href', '/sessions')
  })

  // Test 2: Contextual link in TRIZ Contradictions KPI card
  it('renders_contextual_link_in_triz_contradictions_kpi_card', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    const trizStat = screen.getByTestId('stat-total-contradictions')
    const trizCard = trizStat.parentElement!
    const cardLink = within(trizCard).getByRole('link', { name: /tra cứu triz/i })
    expect(cardLink).toHaveAttribute('href', '/search')
  })

  // Phase 11.8: Golden Documents Local-Empty Guidance & Quality Ratio (RED suite)
  // Test 1: Local-empty guidance when knowledge base is empty in mixed-state
  it('renders_section_local_empty_guidance_for_golden_documents_when_knowledge_base_is_empty', async () => {
    const mockMixedWithoutKnowledge: AnalyticsOverviewResponse = {
      data: {
        sessions: {
          total: 5,
          by_status: { active: 5 },
          by_workflow_state: { structuring: 5 },
          by_domain: { technical: 5 },
        },
        content: {
          total_problem_frames: 4,
          total_research_notes: 6,
          notes_by_type: { insight: 6 },
          total_candidate_solutions: 5,
          solutions_by_status: { candidate: 5 },
        },
        knowledge_base: {
          total_documents: 0,
          golden_documents: 0,
          total_chunks: 0,
        },
        triz: {
          total_contradictions: 3,
          by_contradiction_type: { technical: 3 },
        },
      },
      generated_at: '2026-10-03T12:00:00.000Z',
    }

    mockedGetAnalyticsOverview.mockResolvedValue(mockMixedWithoutKnowledge)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Local-empty guidance text
    expect(
      screen.getByText(/chưa có tài liệu trong kho tri thức/i)
    ).toBeInTheDocument()

    // Contextual link to /knowledge
    const openKnowledgeLink = screen.getByRole('link', {
      name: /mở kho tri thức/i,
    })
    expect(openKnowledgeLink).toHaveAttribute('href', '/knowledge')

    // Raw zero text should not be rendered
    expect(screen.queryByText(/0 tổng tài liệu/i)).not.toBeInTheDocument()
  })

  // Test 2: Golden documents ratio badge when knowledge base has documents
  it('renders_golden_documents_ratio_badge_when_knowledge_base_has_documents', async () => {
    mockedGetAnalyticsOverview.mockResolvedValue(mockPopulatedOverview)

    renderWithClient(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.queryByTestId('analytics-loading-skeleton')).not.toBeInTheDocument()
    })

    // Ratio badge: 4 / 10 = 40%
    expect(screen.getByText(/40% chuẩn hóa/i)).toBeInTheDocument()

    // Populated counts still rendered
    expect(screen.getAllByText(/4/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/10/i).length).toBeGreaterThanOrEqual(1)

    // Local empty guidance should NOT be rendered
    expect(
      screen.queryByText(/chưa có tài liệu trong kho tri thức/i)
    ).not.toBeInTheDocument()
  })
})
