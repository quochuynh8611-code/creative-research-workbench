/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TrizLensMetadataSection } from '../triz-lens-metadata-section'
import { EverydayMetadataSection } from '../everyday-metadata-section'
import type { TrizPrinciple } from '@/lib/types'

const MOCK_PRINCIPLE_FULL: TrizPrinciple = {
  id: 1,
  principle_id: 1,
  name_vi: 'Nguyên tắc Phân đoạn (Segmentation)',
  name_en: 'Segmentation',
  description: 'Chia đối tượng thành các phần độc lập.',
  explanation: 'Phân rã hệ thống thành các khối nhỏ...',
  examples: ['Cửa cuốn xếp lớp thay vì cửa nguyên tấm'],
  everyday_title: 'Chia nhỏ việc lớn (Phân đoạn)',
  daily_application: 'Chia nhỏ mục tiêu phức tạp thành các bước nhỏ 5–15 phút.',
  daily_examples: ['Chia bài đọc 40 trang thành 4 phần 10 trang.'],
  action_prompt: 'Việc nào có thể chia nhỏ để bắt đầu ngay?',
  business_title: 'Phân khúc thị trường / Chia nhỏ quy trình',
  business_application: 'Chia nhỏ tệp khách hàng hoặc tách quy trình vận hành phức tạp.',
  business_examples: ['Phân khúc khách hàng theo LTV để cá nhân hóa chiến dịch.'],
  business_action_prompt: 'Quy trình nào đang quá cồng kềnh có thể chia nhỏ để quản lý linh hoạt hơn?',
}

const MOCK_PRINCIPLE_WITHOUT_BUSINESS: TrizPrinciple = {
  id: 2,
  principle_id: 2,
  name_vi: 'Nguyên tắc Tách rời (Taking out)',
  name_en: 'Taking out',
  description: 'Tách phần gây phiền phức hoặc tách phần duy nhất cần thiết.',
  explanation: 'Tách riêng phần gây hại...',
  examples: ['Đặt máy nén khí bên ngoài xưởng'],
  everyday_title: 'Loại bỏ điều gây xao nhãng',
  daily_application: 'Tách điện thoại ra xa khi làm việc tập trung.',
  daily_examples: ['Để điện thoại ở phòng khác trong 1 giờ.'],
  action_prompt: 'Yếu tố nào đang làm bạn phân tâm nhiều nhất?',
}

describe('Batch B1.1: TrizLensMetadataSection — Component Tests (RED Phase)', () => {
  it('1. Everyday lens render đúng 4 trường everyday metadata cùng tên kỹ thuật', () => {
    render(
      <TrizLensMetadataSection
        lens="everyday"
        principle={MOCK_PRINCIPLE_FULL}
      />
    )

    // Tên kỹ thuật gốc
    expect(screen.getByText('Nguyên tắc Phân đoạn (Segmentation)')).toBeInTheDocument()
    expect(screen.getByText('Chia đối tượng thành các phần độc lập.')).toBeInTheDocument()

    // 4 trường Everyday metadata
    expect(screen.getByText('Chia nhỏ việc lớn (Phân đoạn)')).toBeInTheDocument()
    expect(screen.getByText(/Chia nhỏ mục tiêu phức tạp thành các bước nhỏ/i)).toBeInTheDocument()
    expect(screen.getByText(/Chia bài đọc 40 trang thành 4 phần 10 trang/i)).toBeInTheDocument()
    expect(screen.getByText(/Việc nào có thể chia nhỏ để bắt đầu ngay/i)).toBeInTheDocument()

    // Accordion button nhãn Đời sống
    expect(screen.getByRole('button', { name: /chi tiết đời sống và câu hỏi gợi mở nguyên tắc #1/i })).toBeInTheDocument()
  })

  it('2. Business lens render đúng 4 trường business metadata cùng nhãn kinh doanh', () => {
    render(
      <TrizLensMetadataSection
        lens="business"
        principle={MOCK_PRINCIPLE_FULL}
      />
    )

    // Tên kỹ thuật gốc
    expect(screen.getByText('Nguyên tắc Phân đoạn (Segmentation)')).toBeInTheDocument()

    // 4 trường Business metadata
    expect(screen.getByText('Phân khúc thị trường / Chia nhỏ quy trình')).toBeInTheDocument()
    expect(screen.getByText(/Chia nhỏ tệp khách hàng hoặc tách quy trình vận hành phức tạp/i)).toBeInTheDocument()
    expect(screen.getByText(/Phân khúc khách hàng theo LTV để cá nhân hóa chiến dịch/i)).toBeInTheDocument()
    expect(screen.getByText(/Quy trình nào đang quá cồng kềnh có thể chia nhỏ/i)).toBeInTheDocument()

    // Accordion button mang nhãn ngữ cảnh Kinh doanh (không bị nhầm sang nhãn đời sống)
    const businessButton = screen.getByRole('button', { name: /diễn giải & ứng dụng kinh doanh nguyên tắc #1|chi tiết kinh doanh nguyên tắc #1/i })
    expect(businessButton).toBeInTheDocument()
    expect(screen.queryByText(/Cách áp dụng trong đời sống:/i)).not.toBeInTheDocument()
  })

  it('3. Business lens hiển thị controlled fallback khi thiếu business metadata', () => {
    render(
      <TrizLensMetadataSection
        lens="business"
        principle={MOCK_PRINCIPLE_WITHOUT_BUSINESS}
      />
    )

    // Hiển thị fallback tiếng Việt có kiểm soát
    expect(screen.getByText(/Đang cập nhật diễn giải kinh doanh/i)).toBeInTheDocument()

    // Không render chuỗi thô undefined hoặc null
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('4. Engineering lens chỉ render technical metadata, KHÔNG render accordion lăng kính', () => {
    render(
      <TrizLensMetadataSection
        lens="engineering"
        principle={MOCK_PRINCIPLE_FULL}
      />
    )

    // Hiển thị thông số kỹ thuật gốc và giải thích
    expect(screen.getByText('Nguyên tắc Phân đoạn (Segmentation)')).toBeInTheDocument()
    expect(screen.getByText('Chia đối tượng thành các phần độc lập.')).toBeInTheDocument()
    expect(screen.getByText(/Phân rã hệ thống thành các khối nhỏ/i)).toBeInTheDocument()

    // Tuyệt đối không render accordion lăng kính đời sống hay kinh doanh
    expect(screen.queryByRole('button', { name: /chi tiết đời sống/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /diễn giải & ứng dụng kinh doanh/i })).not.toBeInTheDocument()
  })

  it('5. Đảm bảo mỗi instance có DOM ID và aria-controls duy nhất khi render cùng principle', () => {
    const { container } = render(
      <div>
        <div data-testid="section-instance-1">
          <TrizLensMetadataSection
            lens="everyday"
            principle={MOCK_PRINCIPLE_FULL}
          />
        </div>
        <div data-testid="section-instance-2">
          <TrizLensMetadataSection
            lens="everyday"
            principle={MOCK_PRINCIPLE_FULL}
          />
        </div>
      </div>
    )

    const buttons = screen.getAllByRole('button', { name: /chi tiết đời sống và câu hỏi gợi mở nguyên tắc #1/i })
    expect(buttons).toHaveLength(2)

    const btn1 = buttons[0]
    const btn2 = buttons[1]

    const controlsId1 = btn1.getAttribute('aria-controls')
    const controlsId2 = btn2.getAttribute('aria-controls')

    // Hai aria-controls phải có giá trị và không được trùng nhau
    expect(controlsId1).toBeTruthy()
    expect(controlsId2).toBeTruthy()
    expect(controlsId1).not.toBe(controlsId2)

    // Kiểm tra container DOM tương ứng tồn tại và khớp ID
    const content1 = container.querySelector(`#${controlsId1}`)
    const content2 = container.querySelector(`#${controlsId2}`)
    expect(content1).toBeInTheDocument()
    expect(content2).toBeInTheDocument()
    expect(content1).not.toBe(content2)

    // Toggle độc lập: click btn1 không ảnh hưởng btn2
    expect(btn1).toHaveAttribute('aria-expanded', 'true')
    expect(btn2).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(btn1)
    expect(btn1).toHaveAttribute('aria-expanded', 'false')
    expect(btn2).toHaveAttribute('aria-expanded', 'true')
  })

  it('6. Adapter EverydayMetadataSection tiếp tục hoạt động tương thích với props từ Ideation', () => {
    render(
      <EverydayMetadataSection
        principleId={10}
        everydayTitle="Chuẩn bị sẵn sàng (Tác động sơ bộ)"
        dailyApplication="Sắp xếp, chuẩn bị trước công cụ hoặc nguyên liệu từ hôm trước."
        dailyExamples={['Sơ chế sẵn rau củ vào tối Chủ nhật']}
        actionPrompt="Hành động nào có thể làm từ hôm nay?"
        technicalTitle="Preliminary Action"
        technicalDescription="Thực hiện trước một phần hoặc toàn bộ hành động cần thiết."
      />
    )

    // Kiểm tra render chính xác theo hợp đồng cũ của Ideation
    expect(screen.getByText('Preliminary Action')).toBeInTheDocument()
    expect(screen.getByText('Chuẩn bị sẵn sàng (Tác động sơ bộ)')).toBeInTheDocument()
    expect(screen.getByText(/Sắp xếp, chuẩn bị trước công cụ hoặc nguyên liệu/i)).toBeInTheDocument()
    expect(screen.getByText(/Sơ chế sẵn rau củ vào tối Chủ nhật/i)).toBeInTheDocument()
    expect(screen.getByText(/Hành động nào có thể làm từ hôm nay/i)).toBeInTheDocument()
  })
})
