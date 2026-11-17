/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ConfirmationModal } from '../confirmation-modal'

describe('ConfirmationModal (Batch C30 PR 2)', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Xác nhận xóa giải pháp',
    description: 'Bạn có chắc chắn muốn xóa giải pháp "Vật liệu composite"? Thao tác này không thể hoàn tác.',
    confirmLabel: 'Xác nhận xóa',
    cancelLabel: 'Hủy bỏ',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isLoading: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('GIVEN isOpen=false THEN does not render anything', () => {
    render(<ConfirmationModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Xác nhận xóa giải pháp')).not.toBeInTheDocument()
  })

  test('GIVEN isOpen=true THEN renders title, description and action buttons', () => {
    render(<ConfirmationModal {...defaultProps} />)
    expect(screen.getByText('Xác nhận xóa giải pháp')).toBeInTheDocument()
    expect(
      screen.getByText(/Bạn có chắc chắn muốn xóa giải pháp "Vật liệu composite"\?/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận xóa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy bỏ' })).toBeInTheDocument()
  })

  test('GIVEN user clicks cancel button THEN onCancel is called and onConfirm is NOT called', () => {
    render(<ConfirmationModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    expect(defaultProps.onConfirm).not.toHaveBeenCalled()
  })

  test('GIVEN user clicks confirm button THEN onConfirm is called', () => {
    render(<ConfirmationModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  test('GIVEN isLoading=true THEN buttons are disabled', () => {
    render(<ConfirmationModal {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('button', { name: /Đang xóa|Xác nhận/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hủy bỏ' })).toBeDisabled()
  })
})
