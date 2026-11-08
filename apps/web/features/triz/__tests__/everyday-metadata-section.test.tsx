/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { EverydayMetadataSection } from '../everyday-metadata-section'

describe('EverydayMetadataSection — Multi-instance DOM ID Uniqueness & Isolation', () => {
  it('1. Đảm bảo mỗi instance có DOM ID riêng biệt và aria-controls khớp chính xác khi cùng render principle #10', () => {
    const { container } = render(
      <div>
        <div data-testid="instance-1">
          <EverydayMetadataSection
            principleId={10}
            everydayTitle="Chuẩn bị sẵn sàng (Tác động sơ bộ) - Khối Gợi ý"
            dailyApplication="Sắp xếp đồ đạc sẵn từ tối hôm trước."
            dailyExamples={['Chuẩn bị tài liệu trước khi ngủ']}
            actionPrompt="Có thể chuẩn bị gì từ hôm nay?"
            technicalTitle="Preliminary Action"
            technicalDescription="Thực hiện trước một phần hoặc toàn bộ hành động."
          />
        </div>
        <div data-testid="instance-2">
          <EverydayMetadataSection
            principleId={10}
            everydayTitle="Chuẩn bị sẵn sàng (Tác động sơ bộ) - Khối Ma trận"
            dailyApplication="Sắp xếp đồ đạc sẵn từ tối hôm trước."
            dailyExamples={['Chuẩn bị tài liệu trước khi ngủ']}
            actionPrompt="Có thể chuẩn bị gì từ hôm nay?"
            technicalTitle="Preliminary Action"
            technicalDescription="Thực hiện trước một phần hoặc toàn bộ hành động."
          />
        </div>
      </div>
    )

    const buttons = screen.getAllByRole('button', { name: /chi tiết đời sống và câu hỏi gợi mở nguyên tắc #10/i })
    expect(buttons).toHaveLength(2)

    const btn1 = buttons[0]
    const btn2 = buttons[1]

    const controlsId1 = btn1.getAttribute('aria-controls')
    const controlsId2 = btn2.getAttribute('aria-controls')

    // Hai aria-controls phải có giá trị và PHẢI KHÁC NHAU
    expect(controlsId1).toBeTruthy()
    expect(controlsId2).toBeTruthy()
    expect(controlsId1).not.toBe(controlsId2)

    // Kiểm tra hai container tương ứng trong DOM có ID khớp với aria-controls
    const content1 = container.querySelector(`#${controlsId1}`)
    const content2 = container.querySelector(`#${controlsId2}`)

    expect(content1).toBeInTheDocument()
    expect(content2).toBeInTheDocument()
    expect(content1).not.toBe(content2)

    // Toggle instance 1 không làm thay đổi trạng thái instance 2
    expect(btn1).toHaveAttribute('aria-expanded', 'true')
    expect(btn2).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(btn1)
    expect(btn1).toHaveAttribute('aria-expanded', 'false')
    expect(btn2).toHaveAttribute('aria-expanded', 'true')
  })
})
