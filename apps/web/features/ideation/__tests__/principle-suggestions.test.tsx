/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PrincipleSuggestions } from '../principle-suggestions'
import type { RecommendedMethod } from '@/lib/types'

describe('Phase 5.6 — PrincipleSuggestions Component Tests', () => {
  const mockMethods: RecommendedMethod[] = [
    {
      id: 1,
      principle_id: 35,
      title: 'Parameter changes (Chuyển đổi thông số)',
      description: 'Thay đổi trạng thái tập hợp, mật độ, độ dẻo, nhiệt độ.',
    },
    {
      id: 2,
      principle_id: 1,
      title: 'Segmentation (Phân đoạn)',
      description: 'Chia đối tượng thành các phần độc lập hoặc tháo rời được.',
    },
  ]

  it('1. Render danh sách các nguyên tắc TRIZ với số hiệu, tiêu đề và mô tả', () => {
    render(<PrincipleSuggestions methods={mockMethods} />)

    expect(screen.getByText('Nguyên tắc sáng tạo TRIZ được gợi ý')).toBeInTheDocument()
    expect(screen.getByText(/#35/i)).toBeInTheDocument()
    expect(screen.getByText('Parameter changes (Chuyển đổi thông số)')).toBeInTheDocument()
    expect(screen.getByText(/Thay đổi trạng thái tập hợp/i)).toBeInTheDocument()

    expect(screen.getByText(/#1/i)).toBeInTheDocument()
    expect(screen.getByText('Segmentation (Phân đoạn)')).toBeInTheDocument()
  })

  it('2. Hiển thị Empty state khi không có nguyên tắc nào được gợi ý', () => {
    render(<PrincipleSuggestions methods={[]} />)

    expect(screen.getByText(/Chưa có gợi ý nguyên tắc sáng chế/i)).toBeInTheDocument()
    expect(screen.getByText(/Phân tích cấu trúc/i)).toBeInTheDocument()
  })

  it('3. Kích hoạt callback onSelect khi người dùng chọn một nguyên tắc', () => {
    const onSelectMock = jest.fn()
    render(<PrincipleSuggestions methods={mockMethods} onSelectPrinciple={onSelectMock} />)

    const selectBtn = screen.getAllByRole('button', { name: /áp dụng nguyên tắc/i })[0]
    fireEvent.click(selectBtn)

    expect(onSelectMock).toHaveBeenCalledWith(mockMethods[0])
  })
})
