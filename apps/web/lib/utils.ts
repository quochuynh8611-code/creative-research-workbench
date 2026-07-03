import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export const DOMAIN_LABELS: Record<string, string> = {
  technical: 'Kỹ thuật',
  business: 'Kinh doanh',
  education: 'Giáo dục',
  personal: 'Cá nhân',
  research: 'Nghiên cứu',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  active: 'Đang làm',
  archived: 'Lưu trữ',
}

export const STAGE_LABELS: Record<string, string> = {
  intake: 'Nhập vấn đề',
  structuring: 'Phân tích cấu trúc',
  retrieval: 'Truy xuất tài liệu',
  ideation: 'Sinh ý tưởng',
  evaluation: 'Đánh giá',
  synthesis: 'Tổng hợp',
}

export const WORKFLOW_STAGES = [
  'intake',
  'structuring',
  'retrieval',
  'ideation',
  'evaluation',
  'synthesis',
] as const
