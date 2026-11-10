/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NormalizedView } from '../normalized-view'
import type { ProblemFrame } from '@/lib/types'

describe('Separation Strategies UI — Physical Contradiction Handling (Batch A: RED Phase)', () => {
  const mockPhysicalFrame: ProblemFrame = {
    id: 'pf-phys-001',
    session_id: 'ses-phys-001',
    raw_statement: 'Bánh răng cần vừa cứng để chịu mài mòn vừa mềm để triệt tiêu dao động rung lắc',
    normalized_statement: 'Mâu thuẫn vật lý: Đối tượng cần đồng thời đạt trạng thái cứng và mềm.',
    contradiction_type: 'physical',
    improving_parameter: null,
    worsening_parameter: null,
    domain: 'mechanical',
    created_at: '2026-03-15T09:00:00Z',
  }

  const mockTechnicalFrame: ProblemFrame = {
    id: 'pf-tech-001',
    session_id: 'ses-tech-001',
    raw_statement: 'Tăng tốc độ làm tăng tiêu hao năng lượng',
    normalized_statement: 'Mâu thuẫn kỹ thuật: Cải thiện tốc độ làm suy giảm hiệu suất năng lượng.',
    contradiction_type: 'technical',
    improving_parameter: 'Tốc độ',
    worsening_parameter: 'Tiêu hao năng lượng',
    domain: 'mechanical',
    created_at: '2026-03-15T09:00:00Z',
  }

  const mockNoneFrame: ProblemFrame = {
    id: 'pf-none-001',
    session_id: 'ses-none-001',
    raw_statement: 'Bài toán tối ưu hóa thông thường',
    normalized_statement: 'Không có mâu thuẫn.',
    contradiction_type: 'none',
    domain: 'general',
    created_at: '2026-03-15T09:00:00Z',
  }

  const mockUnknownFrame: ProblemFrame = {
    id: 'pf-unk-001',
    session_id: 'ses-unk-001',
    raw_statement: 'Chưa rõ thông số',
    normalized_statement: 'Chưa xác định mâu thuẫn.',
    contradiction_type: 'unknown',
    domain: 'general',
    created_at: '2026-03-15T09:00:00Z',
  }

  it('1. Physical: Hiển thị tiêu đề khu vực và đầy đủ 4 chiến lược phân tách bằng tiếng Việt', () => {
    render(<NormalizedView problemFrame={mockPhysicalFrame} />)

    // Kỳ vọng tiêu đề khối chiến lược phân tách
    expect(
      screen.getByText(/Chiến lược phân tách cho mâu thuẫn vật lý|Separation Strategies/i)
    ).toBeInTheDocument()

    // Kỳ vọng 4 tên chiến lược tiếng Việt chuẩn
    expect(screen.getByText('Phân tách trong không gian')).toBeInTheDocument()
    expect(screen.getByText('Phân tách trong thời gian')).toBeInTheDocument()
    expect(screen.getByText('Phân tách theo điều kiện')).toBeInTheDocument()
    expect(screen.getByText('Phân tách giữa hệ thống và các thành phần (mức hệ thống)')).toBeInTheDocument()
  })

  it('2. Physical: Hiển thị câu hỏi chẩn đoán gợi mở tiếng Việt cho cả 4 chiến lược', () => {
    render(<NormalizedView problemFrame={mockPhysicalFrame} />)

    expect(
      screen.getByText(/Vấn đề hoặc tính chất đối nghịch này có thể tách biệt tại các vị trí\/vùng không gian khác nhau không\?/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tính chất đối nghịch này có thể xuất hiện tại các thời điểm hoặc giai đoạn khác nhau không\?/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Hệ thống có thể chuyển đổi tính chất khi điều kiện môi trường hoặc trạng thái thay đổi không\?/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tính chất này có thể thuộc về toàn bộ hệ thống trong khi các thành phần riêng lẻ có tính chất ngược lại không\?/i)
    ).toBeInTheDocument()
  })

  it('3. Chọn một chiến lược (space): Lọc và hiển thị đúng 10 nguyên tắc theo mapping', () => {
    render(<NormalizedView problemFrame={mockPhysicalFrame} />)

    const spaceButton = screen.getByRole('button', { name: /Phân tách trong không gian/i })
    fireEvent.click(spaceButton)

    // space mapping: [1, 2, 3, 4, 7, 13, 17, 24, 26, 30]
    // Kỳ vọng hiển thị các badge hoặc danh sách nguyên tắc số 1, 2, 3, 4, 7, 13, 17, 24, 26, 30
    const principlesSection = screen.getByTestId('separation-principles-list')
    expect(principlesSection).toBeInTheDocument()
    expect(principlesSection).toHaveTextContent('#1')
    expect(principlesSection).toHaveTextContent('#7')
    expect(principlesSection).toHaveTextContent('#13')
    expect(principlesSection).toHaveTextContent('#30')
    // Nguyên tắc #9 (thuộc time) không được xuất hiện khi chỉ chọn space
    expect(principlesSection).not.toHaveTextContent('#9')
  })

  it('4. Chọn hai chiến lược (space + condition): Hợp nhất và khử trùng lặp principle IDs', () => {
    render(<NormalizedView problemFrame={mockPhysicalFrame} />)

    const spaceButton = screen.getByRole('button', { name: /Phân tách trong không gian/i })
    const conditionButton = screen.getByRole('button', { name: /Phân tách theo điều kiện/i })
    fireEvent.click(spaceButton)
    fireEvent.click(conditionButton)

    const principlesSection = screen.getByTestId('separation-principles-list')
    expect(principlesSection).toBeInTheDocument()

    // Chứa cả principles của space và condition
    expect(principlesSection).toHaveTextContent('#1')   // space
    expect(principlesSection).toHaveTextContent('#30')  // space
    expect(principlesSection).toHaveTextContent('#28')  // condition
    expect(principlesSection).toHaveTextContent('#40')  // condition

    // Kiểm tra không bị duplicate element cho các principle xuất hiện ở cả hai (nếu có)
    const principleItems = screen.getAllByTestId(/^principle-item-/)
    const ids = principleItems.map((el) => el.getAttribute('data-principle-id'))
    const uniqueIds = Array.from(new Set(ids))
    expect(ids.length).toBe(uniqueIds.length)
  })

  it('5. Technical / None / Unknown: Không hiển thị khu vực Separation Strategies', () => {
    const { rerender } = render(<NormalizedView problemFrame={mockTechnicalFrame} />)
    expect(screen.queryByText(/Chiến lược phân tách/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Phân tách trong không gian')).not.toBeInTheDocument()

    rerender(<NormalizedView problemFrame={mockNoneFrame} />)
    expect(screen.queryByText(/Chiến lược phân tách/i)).not.toBeInTheDocument()

    rerender(<NormalizedView problemFrame={mockUnknownFrame} />)
    expect(screen.queryByText(/Chiến lược phân tách/i)).not.toBeInTheDocument()
  })

  it('6. Không chọn strategy nào: Giữ nguyên danh sách gợi ý mặc định fallback [1, 2, 3, 4]', () => {
    render(<NormalizedView problemFrame={mockPhysicalFrame} />)

    // Khi không tick chọn strategy nào, fallback [1, 2, 3, 4] được duy trì
    const fallbackSection = screen.getByTestId('separation-fallback-principles')
    expect(fallbackSection).toBeInTheDocument()
    expect(fallbackSection).toHaveTextContent('#1')
    expect(fallbackSection).toHaveTextContent('#2')
    expect(fallbackSection).toHaveTextContent('#3')
    expect(fallbackSection).toHaveTextContent('#4')
    expect(fallbackSection).not.toHaveTextContent('#7')
  })

  it('7. Không render raw backend error ra giao diện người dùng', () => {
    render(<NormalizedView problemFrame={mockPhysicalFrame} />)

    // Đảm bảo không hiển thị raw stacktrace hoặc HTTP error codes
    expect(screen.queryByText(/500 Internal Server Error/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Traceback \(most recent call last\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RuntimeError/i)).not.toBeInTheDocument()
  })
})
