'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDocuments,
  getDocument,
  uploadDocument,
  deleteDocument,
} from '@/lib/api-client'
import type { DocumentItem, DocumentDetail } from '@/lib/types'

export function KnowledgeView(): React.ReactElement {
  const queryClient = useQueryClient()

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [goldenFilter, setGoldenFilter] = useState<boolean | undefined>(undefined)

  // Modal / Drawer state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null)
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null)

  const [deletingDoc, setDeletingDoc] = useState<DocumentItem | null>(null)
  const [viewingDocId, setViewingDocId] = useState<string | null>(null)

  // Query: Documents list
  const {
    data: documentsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['documents', { q: searchQuery, topic: topicFilter, status: statusFilter, golden: goldenFilter }],
    queryFn: () =>
      listDocuments({
        q: searchQuery || undefined,
        topic: topicFilter || undefined,
        status: statusFilter || undefined,
        golden: goldenFilter,
      }),
  })

  // Query: Selected Document Detail
  const {
    data: documentDetail,
    isLoading: isLoadingDetail,
  } = useQuery<DocumentDetail>({
    queryKey: ['document', viewingDocId],
    queryFn: () => getDocument(viewingDocId!),
    enabled: Boolean(viewingDocId),
  })

  // Mutation: Upload Document
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(file),
    onSuccess: (res) => {
      setUploadSuccessMessage(
        res.status === 'already_exists'
          ? 'Tài liệu đã tồn tại trong hệ thống (bỏ qua trùng lặp).'
          : 'Nạp tài liệu thành công!'
      )
      setUploadErrorMessage(null)
      setSelectedFile(null)
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err: any) => {
      setUploadErrorMessage(err?.response?.data?.detail ?? 'Không thể nạp tài liệu. Vui lòng thử lại.')
      setUploadSuccessMessage(null)
    },
  })

  // Mutation: Delete Document
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setDeletingDoc(null)
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail ?? 'Không thể xóa tài liệu.')
    },
  })

  const documents = documentsResponse?.data ?? []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      setUploadSuccessMessage(null)
      setUploadErrorMessage(null)
    }
  }

  const handleStartUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span>📚</span> Quản lý Cơ sở Tri thức (Knowledge Base)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Quản lý tài liệu nguồn, tài liệu chuẩn tắc và các đoạn trích dẫn phân rã (Chunks).
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setIsUploadOpen(true)
              setUploadSuccessMessage(null)
              setUploadErrorMessage(null)
              setSelectedFile(null)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <span>➕</span> Nạp tài liệu
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-96">
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu theo tên/tiêu đề..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Topic filter */}
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả chủ đề (Topics)</option>
            <option value="architecture">Chủ đề: Architecture</option>
            <option value="contradictions">Chủ đề: Contradictions</option>
            <option value="energy">Chủ đề: Energy</option>
            <option value="materials">Chủ đề: Materials</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="canonical">Canonical</option>
            <option value="draft">Draft</option>
            <option value="deprecated">Deprecated</option>
          </select>

          {/* Golden filter */}
          <select
            value={goldenFilter === undefined ? '' : goldenFilter ? 'true' : 'false'}
            onChange={(e) => {
              if (e.target.value === 'true') setGoldenFilter(true)
              else if (e.target.value === 'false') setGoldenFilter(false)
              else setGoldenFilter(undefined)
            }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả loại tài liệu</option>
            <option value="true">Chỉ tài liệu chuẩn tắc ⭐</option>
            <option value="false">Tài liệu thường</option>
          </select>
        </div>
      </div>

      {/* Main Content Area: Loading / Error / Empty / Table */}
      {isLoading ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Đang tải danh sách tài liệu...</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900">
          <p className="text-red-700 dark:text-red-300 font-medium mb-3">
            Không thể tải danh sách tài liệu. {(error as Error)?.message}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Thử lại
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
          <span className="text-4xl">📭</span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Chưa có tài liệu nào trong cơ sở tri thức
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Bắt đầu bằng việc tải lên các tài liệu nghiên cứu định dạng Markdown (.md) hoặc Text (.txt).
          </p>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm"
          >
            <span>➕</span> Nạp tài liệu
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-4">Tài liệu / Tiêu đề</th>
                  <th scope="col" className="px-6 py-4">Chủ đề (Topic)</th>
                  <th scope="col" className="px-6 py-4">Nguồn & Ngôn ngữ</th>
                  <th scope="col" className="px-6 py-4">Số Chunks</th>
                  <th scope="col" className="px-6 py-4">Trạng thái</th>
                  <th scope="col" className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <span>📄</span>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>{doc.title || doc.filename}</span>
                            {doc.golden && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ⭐ Golden Doc
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                            {doc.filename}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span data-testid={`topic-${doc.id}`} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{doc.topic || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div>{doc.source_type || 'internal'}</div>
                      <div className="text-gray-400 uppercase">{doc.language || 'vi'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">{doc.chunks_count ?? 0}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          doc.status === 'canonical'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {/* View Detail Button */}
                      <button
                        type="button"
                        data-testid={`view-doc-${doc.id}`}
                        onClick={() => setViewingDocId(doc.id)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                        title="Xem chi tiết và phân đoạn chunks"
                      >
                        👁️ Xem
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        data-testid={`delete-doc-${doc.id}`}
                        disabled={doc.golden}
                        onClick={() => setDeletingDoc(doc)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          doc.golden
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-950/50'
                        }`}
                        title={doc.golden ? 'Không thể xóa Golden Document' : 'Xóa tài liệu'}
                      >
                        🗑️ Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Upload Document */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Tải lên tài liệu Markdown
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Chọn tài liệu định dạng Markdown (.md) hoặc Text (.txt). Hệ thống sẽ tự động bóc tách frontmatter, cắt chunks (512t) và tạo vector embeddings.
            </p>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center bg-gray-50 dark:bg-gray-800/40">
              <input
                type="file"
                data-testid="file-upload-input"
                accept=".md,.txt,.markdown"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300 cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-2">
                  Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {uploadSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs font-medium">
                {uploadSuccessMessage}
              </div>
            )}

            {uploadErrorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-xs font-medium">
                {uploadErrorMessage}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={!selectedFile || uploadMutation.isPending}
                onClick={handleStartUpload}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                {uploadMutation.isPending ? 'Đang nạp...' : 'Bắt đầu nạp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 text-red-600">
              <span>⚠️</span> Xác nhận xóa tài liệu
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Bạn có chắc chắn muốn xóa tài liệu này? Toàn bộ các phân đoạn chunks và embeddings liên quan cũng sẽ bị xóa vĩnh viễn.
            </p>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300">
              {deletingDoc.title || deletingDoc.filename}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingDoc.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Drawer: Document Detail & Chunks */}
      {viewingDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>📄</span> Chi tiết tài liệu
              </h3>
              <button
                type="button"
                onClick={() => setViewingDocId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-12 text-center text-gray-500">Đang tải chi tiết tài liệu...</div>
            ) : documentDetail ? (
              <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                {/* Metadata card */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl text-xs">
                  <div>
                    <span className="text-gray-400">Tiêu đề:</span>{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">{documentDetail.title}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Tên file:</span>{' '}
                    <span className="font-mono text-gray-800 dark:text-gray-200">{documentDetail.filename}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Chủ đề:</span>{' '}
                    <span className="font-medium">{documentDetail.topic || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Trạng thái:</span>{' '}
                    <span className="font-medium">{documentDetail.status}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Content Hash (SHA-256):</span>{' '}
                    <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">{documentDetail.content_hash}</span>
                  </div>
                </div>

                {/* Chunks breakdown */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center justify-between">
                    <span>Phân đoạn văn bản (Chunks: {documentDetail.chunks?.length ?? 0})</span>
                  </h4>
                  <div className="space-y-3">
                    {documentDetail.chunks?.map((chunk, idx) => (
                      <div
                        key={chunk.id || idx}
                        className="p-3.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60 pb-1.5 font-mono">
                          <span>Chunk #{chunk.chunk_index}</span>
                          <span>{chunk.token_count} tokens</span>
                        </div>
                        <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
                          {chunk.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setViewingDocId(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
