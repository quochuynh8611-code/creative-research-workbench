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
})
