/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PrincipleSuggestions } from '../principle-suggestions'
import type { RecommendedMethod, NoteDraft } from '@/lib/types'

describe('Batch C7c-2d-2: PrincipleSuggestions source_context UI Tests', () => {
  const validMethod: RecommendedMethod = {
    id: 1,
    principle_id: 10,
    method_id: 'triz-principle-10',
    title: 'Preliminary Action (Tác động sơ bộ)',
    description: 'Thực hiện trước một phần hoặc toàn bộ hành động cần thiết.',
  }

  it('1. Happy path: khi dữ liệu method hợp lệ, bấm Lưu vào sổ tay truyền source_context đúng chuẩn', () => {
    const onSaveAsNoteMock = jest.fn()
    render(<PrincipleSuggestions methods={[validMethod]} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).toHaveBeenCalledTimes(1)
    const draft: NoteDraft = onSaveAsNoteMock.mock.calls[0][0]
    expect(draft.source_context).toEqual({
      schema_version: 1,
      source_type: 'principle_suggestion',
      principle_id: 10,
      method_id: 'triz-principle-10',
    })
    expect(draft.note_type).toBe('hypothesis')
  })

  it('2. Fail-closed: khi method thiếu method_id (undefined), chặn gọi onSaveAsNote và hiển thị alert', () => {
    const onSaveAsNoteMock = jest.fn()
    const invalidMethod = {
      ...validMethod,
      method_id: undefined,
    } as unknown as RecommendedMethod

    render(<PrincipleSuggestions methods={[invalidMethod]} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|method_id/i)
  })

  it('3. Fail-closed: khi method_id là chuỗi rỗng "", chặn gọi onSaveAsNote và hiển thị alert', () => {
    const onSaveAsNoteMock = jest.fn()
    const invalidMethod = {
      ...validMethod,
      method_id: '',
    }

    render(<PrincipleSuggestions methods={[invalidMethod]} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|method_id/i)
  })

  it('4. Fail-closed: khi principle_id ngoài dải (ví dụ 0 hoặc 41), chặn gọi onSaveAsNote và hiển thị alert', () => {
    const onSaveAsNoteMock = jest.fn()
    const invalidMethod = {
      ...validMethod,
      principle_id: 0,
    }

    render(<PrincipleSuggestions methods={[invalidMethod]} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|principle_id/i)
  })

  it('5. Fail-closed: khi principle_id sai kiểu (chuỗi số "10"), chặn gọi onSaveAsNote và không ép kiểu ngầm', () => {
    const onSaveAsNoteMock = jest.fn()
    const invalidMethod = {
      ...validMethod,
      principle_id: '10' as any,
    }

    render(<PrincipleSuggestions methods={[invalidMethod]} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/không hợp lệ|principle_id/i)
  })

  it('6. Không fallback nhầm sang method.id khi principle_id bị thiếu', () => {
    const onSaveAsNoteMock = jest.fn()
    const methodWithoutPrincipleId = {
      id: 5,
      // principle_id bị thiếu
      method_id: 'triz-principle-5',
      title: 'Merging',
      description: 'Kết hợp',
    } as any

    render(<PrincipleSuggestions methods={[methodWithoutPrincipleId]} onSaveAsNote={onSaveAsNoteMock} />)

    const saveBtn = screen.getByRole('button', { name: /lưu vào sổ tay/i })
    fireEvent.click(saveBtn)

    expect(onSaveAsNoteMock).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
  })
})
