/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PrincipleSuggestions } from '../principle-suggestions'
import type { RecommendedMethod } from '@/lib/types'

describe('Phase 5.6 & P2 — PrincipleSuggestions Component Tests', () => {
  const mockMethodsWithMetadata: RecommendedMethod[] = [
    {
      id: 1,
      principle_id: 10,
      method_id: 'triz-principle-10',
      title: 'Preliminary Action (Tác động sơ bộ)',
      description: 'Thực hiện trước một phần hoặc toàn bộ hành động cần thiết.',
      everyday_title: 'Chuẩn bị sẵn sàng (Tác động sơ bộ)',
      daily_application: 'Sắp xếp, chuẩn bị trước công cụ hoặc nguyên liệu từ hôm trước.',
      daily_examples: [
        'Sơ chế sẵn rau củ vào tối Chủ nhật để bữa tối trong tuần nấu nhanh.',
        'Sạc pin điện thoại và chuẩn bị tài liệu trước khi đi ngủ.',
      ],
      action_prompt: 'Hành động nào có thể làm từ hôm nay để công việc ngày mai diễn ra êm đẹp?',
    },
    {
      id: 2,
      principle_id: 35,
      method_id: 'triz-principle-35',
      title: 'Parameter changes (Chuyển đổi thông số)',
      description: 'Thay đổi trạng thái tập hợp, mật độ, độ dẻo, nhiệt độ.',
      // Không có everyday metadata để test fallback
    },
  ]

  it('1. Render danh sách các nguyên tắc TRIZ với số hiệu, tiêu đề và mô tả', () => {
    render(<PrincipleSuggestions methods={mockMethodsWithMetadata} />)

    expect(screen.getByText('Nguyên tắc sáng tạo TRIZ được gợi ý')).toBeInTheDocument()
    expect(screen.getByText(/#10/i)).toBeInTheDocument()
    expect(screen.getByText(/#35/i)).toBeInTheDocument()
  })

  it('2. Hiển thị Empty state khi không có nguyên tắc nào được gợi ý', () => {
    render(<PrincipleSuggestions methods={[]} />)

    expect(screen.getByText(/Chưa có gợi ý nguyên tắc sáng chế/i)).toBeInTheDocument()
    expect(screen.getByText(/Phân tích cấu trúc/i)).toBeInTheDocument()
  })

  it('3. Kích hoạt callback onSelect khi người dùng chọn một nguyên tắc', () => {
    const onSelectMock = jest.fn()
    render(<PrincipleSuggestions methods={mockMethodsWithMetadata} onSelectPrinciple={onSelectMock} />)

    const selectBtn = screen.getAllByRole('button', { name: /áp dụng nguyên tắc/i })[0]
    fireEvent.click(selectBtn)

    expect(onSelectMock).toHaveBeenCalledWith(mockMethodsWithMetadata[0])
  })

  it('4. Kích hoạt callback onSaveAsNote với thông tin nguyên tắc khi bấm nút Lưu vào sổ tay', () => {
    const onSaveAsNoteMock = jest.fn()
    render(<PrincipleSuggestions methods={mockMethodsWithMetadata} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtns = screen.getAllByRole('button', { name: /lưu vào sổ tay|lưu ghi chú/i })
    expect(saveBtns.length).toBeGreaterThan(0)
    fireEvent.click(saveBtns[0])

    expect(onSaveAsNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Preliminary Action'),
        note_type: 'hypothesis',
      })
    )
  })

  it('5. Render đầy đủ 4 trường Everyday Metadata khi có dữ liệu', () => {
    render(<PrincipleSuggestions methods={mockMethodsWithMetadata} />)

    // everyday_title
    expect(screen.getByText('Chuẩn bị sẵn sàng (Tác động sơ bộ)')).toBeInTheDocument()
    // daily_application
    expect(screen.getByText(/Sắp xếp, chuẩn bị trước công cụ hoặc nguyên liệu/i)).toBeInTheDocument()
    // daily_examples
    expect(screen.getByText(/Sơ chế sẵn rau củ vào tối Chủ nhật/i)).toBeInTheDocument()
    expect(screen.getByText(/Sạc pin điện thoại và chuẩn bị tài liệu/i)).toBeInTheDocument()
    // action_prompt
    expect(screen.getByText(/Hành động nào có thể làm từ hôm nay để công việc ngày mai diễn ra êm đẹp/i)).toBeInTheDocument()

    // Vẫn hiển thị tên kỹ thuật gốc để đối chiếu
    expect(screen.getByText(/Preliminary Action \(Tác động sơ bộ\)/i)).toBeInTheDocument()
  })

  it('6. Fallback an toàn khi nguyên tắc thiếu Everyday Metadata', () => {
    render(<PrincipleSuggestions methods={mockMethodsWithMetadata} />)

    // Nguyên tắc #35 không có everyday metadata
    expect(screen.getByText('Parameter changes (Chuyển đổi thông số)')).toBeInTheDocument()
    expect(screen.getByText(/Thay đổi trạng thái tập hợp, mật độ, độ dẻo/i)).toBeInTheDocument()

    // Không render chữ "undefined" hay "null"
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('7. Accordion / Toggle chi tiết everyday có accessible name và aria-expanded đúng', () => {
    render(<PrincipleSuggestions methods={mockMethodsWithMetadata} />)

    const toggleBtn = screen.getByRole('button', { name: /chi tiết đời sống|hướng dẫn đời thường|ví dụ & câu hỏi/i })
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-expanded')

    const initialExpanded = toggleBtn.getAttribute('aria-expanded') === 'true'
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', String(!initialExpanded))
  })
})
