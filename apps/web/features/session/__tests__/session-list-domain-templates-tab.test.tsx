/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionList } from '../session-list'
import {
  listSessions,
  createSession,
  archiveSession,
  restoreSession,
  importSession,
  getSessionTemplates,
  createSessionFromTemplate,
  batchExportSessions,
} from '@/lib/api-client'
import type { ResearchSession, SessionTemplate } from '@/lib/types'

jest.mock('@/lib/api-client', () => ({
  listSessions: jest.fn(),
  createSession: jest.fn(),
  archiveSession: jest.fn(),
  restoreSession: jest.fn(),
  importSession: jest.fn(),
  getSessionTemplates: jest.fn(),
  createSessionFromTemplate: jest.fn(),
  batchExportSessions: jest.fn(),
}))

const mockedListSessions = listSessions as jest.MockedFunction<typeof listSessions>
const mockedGetSessionTemplates = getSessionTemplates as jest.MockedFunction<typeof getSessionTemplates>
const mockedCreateSessionFromTemplate = createSessionFromTemplate as jest.MockedFunction<typeof createSessionFromTemplate>

const MOCK_TEMPLATES: SessionTemplate[] = [
  {
    id: 'tpl_engineering_01',
    title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
    domain: 'technical',
    description: 'Mẫu bài toán mâu thuẫn giữa độ cứng vững kết cấu và khối lượng.',
    tags: ['engineering', 'triz'],
    workflow_state: 'structuring',
  },
  {
    id: 'tpl_business_02',
    title: 'Tối ưu Tốc độ Giao hàng & Chi phí Vận hành',
    domain: 'business',
    description: 'Mẫu giải quyết mâu thuẫn giữa chi phí logistics và thời gian giao hàng.',
    tags: ['business', 'logistics'],
    workflow_state: 'structuring',
  },
  {
    id: 'tpl_healthcare_03',
    title: 'Cân Bằng Độ Chính Xác Chẩn Đoán & Tốc Độ Cấp Cứu',
    domain: 'healthcare',
    description: 'Nâng cao độ an toàn phân loại bệnh nhân cấp cứu mà không làm chậm can thiệp.',
    tags: ['healthcare', 'emergency'],
    workflow_state: 'structuring',
  },
]

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderWithClient(ui: React.ReactElement, customQueryClient?: QueryClient) {
  const queryClient = customQueryClient ?? createTestQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
  }
}

describe('Domain Templates Tab Integration (Test-First Spec)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = jest.fn()
    mockedListSessions.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })
    mockedGetSessionTemplates.mockResolvedValue(MOCK_TEMPLATES)
  })

  it('Gherkin 1: Hiển thị 3 tab chính: Đang hoạt động, Đã lưu trữ, Mẫu nghiên cứu (chuẩn WAI-ARIA tablist & aria-selected)', async () => {
    renderWithClient(<SessionList />)

    const tablist = screen.getByRole('tablist', { name: /Chế độ xem phiên nghiên cứu/i })
    expect(tablist).toBeInTheDocument()

    const activeTab = screen.getByTestId('tab-active')
    const archivedTab = screen.getByTestId('tab-archived')
    const templatesTab = screen.getByTestId('tab-templates')

    expect(activeTab).toHaveAttribute('role', 'tab')
    expect(activeTab).toHaveAttribute('aria-selected', 'true')
    expect(activeTab).toHaveAttribute('aria-controls', 'tabpanel-sessions')

    expect(archivedTab).toHaveAttribute('role', 'tab')
    expect(archivedTab).toHaveAttribute('aria-selected', 'false')
    expect(archivedTab).toHaveAttribute('aria-controls', 'tabpanel-sessions')

    expect(templatesTab).toHaveAttribute('role', 'tab')
    expect(templatesTab).toHaveAttribute('aria-selected', 'false')
    expect(templatesTab).toHaveAttribute('aria-controls', 'tabpanel-templates')
    expect(templatesTab).toHaveTextContent('Mẫu nghiên cứu')

    // Khi chuyển sang tab templates, query templates được kích hoạt và cập nhật số lượng
    fireEvent.click(templatesTab)
    await waitFor(() => {
      expect(templatesTab).toHaveTextContent(/Mẫu nghiên cứu \(3\)/)
      expect(templatesTab).toHaveAttribute('aria-selected', 'true')
      expect(activeTab).toHaveAttribute('aria-selected', 'false')
    })
  })

  it('Gherkin 2: Khi danh sách sessions rỗng, empty state hiển thị nút dẫn sang tab Mẫu nghiên cứu', async () => {
    renderWithClient(<SessionList />)

    await waitFor(() => {
      expect(screen.getByText(/Chưa có session nào/i)).toBeInTheDocument()
    })

    // Có nút CTA chuyển sang tab Mẫu nghiên cứu
    const exploreTemplatesBtn = screen.getByTestId('empty-explore-templates-cta')
    expect(exploreTemplatesBtn).toBeInTheDocument()

    fireEvent.click(exploreTemplatesBtn)

    // Chuyển sang hiển thị các mẫu nghiên cứu
    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      expect(screen.getByText('Tối ưu Tốc độ Giao hàng & Chi phí Vận hành')).toBeInTheDocument()
    })
  })

  it('Gherkin 3: Khi chuyển sang tab Mẫu nghiên cứu, hiển thị danh sách mẫu và bộ lọc domain', async () => {
    renderWithClient(<SessionList />)

    const templatesTab = await screen.findByTestId('tab-templates')
    fireEvent.click(templatesTab)

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
      expect(screen.getByText('Tối ưu Tốc độ Giao hàng & Chi phí Vận hành')).toBeInTheDocument()
      expect(screen.getByText('Cân Bằng Độ Chính Xác Chẩn Đoán & Tốc Độ Cấp Cứu')).toBeInTheDocument()
    })

    // Mở tab KHÔNG được tạo session
    expect(mockedCreateSessionFromTemplate).not.toHaveBeenCalled()
  })

  it('Gherkin 4: Bộ lọc domain trong tab Mẫu nghiên cứu lọc chính xác các card mẫu', async () => {
    renderWithClient(<SessionList />)

    const templatesTab = await screen.findByTestId('tab-templates')
    fireEvent.click(templatesTab)

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
    })

    // Tìm dropdown lọc lĩnh vực mẫu
    const domainSelect = screen.getByLabelText(/Lọc mẫu theo lĩnh vực/i)
    fireEvent.change(domainSelect, { target: { value: 'business' } })

    // Chỉ còn mẫu business
    expect(screen.getByText('Tối ưu Tốc độ Giao hàng & Chi phí Vận hành')).toBeInTheDocument()
    expect(screen.queryByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).not.toBeInTheDocument()
    expect(screen.queryByText('Cân Bằng Độ Chính Xác Chẩn Đoán & Tốc Độ Cấp Cứu')).not.toBeInTheDocument()

    // Lọc mẫu KHÔNG được tạo session
    expect(mockedCreateSessionFromTemplate).not.toHaveBeenCalled()
  })

  it('Gherkin 5: Bấm nút "Áp dụng mẫu này" tạo session mới từ template và hiển thị thông báo', async () => {
    mockedCreateSessionFromTemplate.mockResolvedValueOnce({
      id: 'new-sess-123',
      title: 'Tối ưu hóa Trọng lượng & Độ bền Cơ học',
      status: 'active',
      domain: 'technical',
      tags: ['engineering'],
      workflow_state: 'structuring',
      created_at: '2026-11-20T10:00:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    })

    renderWithClient(<SessionList />)

    const templatesTab = await screen.findByTestId('tab-templates')
    fireEvent.click(templatesTab)

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
    })

    // Bấm nút Áp dụng mẫu đầu tiên
    const applyButtons = screen.getAllByRole('button', { name: /Áp dụng mẫu này/i })
    fireEvent.click(applyButtons[0])

    await waitFor(() => {
      expect(mockedCreateSessionFromTemplate).toHaveBeenCalledWith({
        template_id: 'tpl_engineering_01',
      })
    })

    // Thông báo thành công xuất hiện
    await waitFor(() => {
      expect(screen.getByText(/Đã khởi tạo phiên nghiên cứu từ Mẫu/i)).toBeInTheDocument()
    })
  })

  it('Gherkin 6: Nút "Mẫu nghiên cứu" trên header chuyển trực tiếp sang tab Mẫu nghiên cứu (không mở modal)', async () => {
    renderWithClient(<SessionList />)

    const headerTemplateBtn = screen.getByTestId('header-templates-button')
    fireEvent.click(headerTemplateBtn)

    // Hiển thị nội dung của tab Mẫu nghiên cứu trên trang chính
    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
    })
  })

  it('Gherkin 7: Hỗ trợ Keyboard Navigation giữa các tabs theo chuẩn WAI-ARIA (ArrowRight, ArrowLeft, Home, End)', async () => {
    renderWithClient(<SessionList />)

    const activeTab = screen.getByTestId('tab-active')
    const archivedTab = screen.getByTestId('tab-archived')
    const templatesTab = screen.getByTestId('tab-templates')

    // Bắt đầu từ active tab, bấm ArrowRight chuyển sang archived tab
    fireEvent.keyDown(activeTab, { key: 'ArrowRight' })
    expect(archivedTab).toHaveAttribute('aria-selected', 'true')
    expect(activeTab).toHaveAttribute('aria-selected', 'false')

    // Từ archived tab, bấm ArrowRight chuyển sang templates tab
    fireEvent.keyDown(archivedTab, { key: 'ArrowRight' })
    expect(templatesTab).toHaveAttribute('aria-selected', 'true')
    expect(archivedTab).toHaveAttribute('aria-selected', 'false')

    // Từ templates tab, bấm ArrowLeft quay lại archived tab
    fireEvent.keyDown(templatesTab, { key: 'ArrowLeft' })
    expect(archivedTab).toHaveAttribute('aria-selected', 'true')

    // Bấm Home chuyển về active tab đầu tiên
    fireEvent.keyDown(archivedTab, { key: 'Home' })
    expect(activeTab).toHaveAttribute('aria-selected', 'true')

    // Bấm End chuyển sang templates tab cuối cùng
    fireEvent.keyDown(activeTab, { key: 'End' })
    expect(templatesTab).toHaveAttribute('aria-selected', 'true')
  })

  it('Gherkin 8: Lỗi khi tạo session từ template không báo thành công giả và không hiển thị link mở phiên', async () => {
    mockedCreateSessionFromTemplate.mockRejectedValueOnce(new Error('Máy chủ từ chối tạo session từ mẫu'))

    renderWithClient(<SessionList />)

    const templatesTab = await screen.findByTestId('tab-templates')
    fireEvent.click(templatesTab)

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
    })

    const applyButtons = screen.getAllByRole('button', { name: /Áp dụng mẫu này/i })
    fireEvent.click(applyButtons[0])

    // Thông báo lỗi xuất hiện, tuyệt đối không báo thành công giả
    await waitFor(() => {
      expect(screen.getByText('Máy chủ từ chối tạo session từ mẫu')).toBeInTheDocument()
      expect(screen.queryByText(/Đã khởi tạo phiên nghiên cứu từ Mẫu/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Mở phiên ngay/i)).not.toBeInTheDocument()
    })
  })

  it('Gherkin 9: Chuyển tab và lọc lĩnh vực không bao giờ tự ý phát sinh lệnh tạo session', async () => {
    renderWithClient(<SessionList />)

    const templatesTab = await screen.findByTestId('tab-templates')
    fireEvent.click(templatesTab)

    await waitFor(() => {
      expect(screen.getByText('Tối ưu hóa Trọng lượng & Độ bền Cơ học')).toBeInTheDocument()
    })

    const domainSelect = screen.getByLabelText(/Lọc mẫu theo lĩnh vực/i)
    fireEvent.change(domainSelect, { target: { value: 'technical' } })
    fireEvent.change(domainSelect, { target: { value: 'business' } })
    fireEvent.change(domainSelect, { target: { value: 'all' } })

    expect(mockedCreateSessionFromTemplate).not.toHaveBeenCalled()
  })
})
