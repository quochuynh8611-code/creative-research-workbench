'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Brain,
  Loader2,
  AlertCircle,
  Sparkles,
  FolderSearch,
  Lightbulb,
  BookOpen,
  Download,
  Printer,
  FileText,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DOMAIN_LABELS, STATUS_LABELS, STAGE_LABELS, WORKFLOW_STAGES, formatDate, cn } from '@/lib/utils'
import { getSession, exportSessionMarkdown, generateAIResearchReport } from '@/lib/api-client'
import { IntakeForm } from '@/features/intake/intake-form'
import { NormalizedView } from '@/features/structuring/normalized-view'
import { WorkflowStepper } from '@/features/session/workflow-stepper'
import { PrincipleSuggestions } from '@/features/ideation/principle-suggestions'
import { CandidateSolutions } from '@/features/ideation/candidate-solutions'
import { EvidencePanel } from '@/features/retrieval/evidence-panel'
import { TrizMatrixLookup } from '@/features/triz/triz-matrix-lookup'
import { ResearchNotebook } from '@/features/notebook/research-notebook'
import type {
  AIResearchReport,
  ProblemFrame,
  WorkflowStage,
  RecommendedMethod,
  NoteDraft,
} from '@/lib/types'

const TABS = [
  { id: 'intake', label: 'Nhập vấn đề', icon: Sparkles },
  { id: 'structuring', label: 'Phân tích cấu trúc', icon: Brain },
  { id: 'retrieval', label: 'Tài liệu & Bằng chứng', icon: FolderSearch },
  { id: 'ideation', label: 'Ý tưởng & Nguyên tắc', icon: Lightbulb },
  { id: 'notebook', label: 'Ghi chép (Notebook)', icon: BookOpen },
  { id: 'synthesis', label: 'Tổng hợp & Báo cáo', icon: FileText },
]

interface SessionDetailProps {
  sessionId: string
}

export function SessionDetail({ sessionId }: SessionDetailProps) {
  const [activeTab, setActiveTab] = useState<string>('intake')
  const [hasInitializedTab, setHasInitializedTab] = useState<boolean>(false)
  const [localProblemFrame, setLocalProblemFrame] = useState<ProblemFrame | null>(null)
  const [recommendedMethods, setRecommendedMethods] = useState<RecommendedMethod[]>([])
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [aiReport, setAiReport] = useState<AIResearchReport | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [hasCopied, setHasCopied] = useState<boolean>(false)

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  // Smart initial tab determination based on persisted session state
  useEffect(() => {
    if (session && !hasInitializedTab) {
      if (session.problem_frame) {
        const stage = session.workflow_state || session.current_stage
        if (stage === 'retrieval') {
          setActiveTab('retrieval')
        } else if (stage === 'ideation') {
          setActiveTab('ideation')
        } else if (stage === 'synthesis') {
          setActiveTab('synthesis')
        } else {
          setActiveTab('structuring')
        }
      } else {
        setActiveTab('intake')
      }
      setHasInitializedTab(true)
    }
  }, [session, hasInitializedTab])

  // Reset tab initialization flag if sessionId changes
  useEffect(() => {
    setHasInitializedTab(false)
    setLocalProblemFrame(null)
    setNoteDraft(null)
    setExportError(null)
    setAiReport(null)
    setIsGeneratingReport(false)
    setReportError(null)
    setHasCopied(false)
  }, [sessionId])

  const effectiveProblemFrame = localProblemFrame || session?.problem_frame || null

  const handleProblemFrameCreated = (frame: ProblemFrame) => {
    setLocalProblemFrame(frame)
    setActiveTab('structuring')
  }

  const handleSaveAsNote = (draft: NoteDraft) => {
    setNoteDraft(draft)
    setActiveTab('notebook')
  }

  const handlePrintPdf = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleExportMarkdown = async () => {
    if (isExporting) return
    setIsExporting(true)
    setExportError(null)
    try {
      const blob = await exportSessionMarkdown(sessionId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session_${sessionId}.md`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setExportError(err?.message || 'Có lỗi xảy ra khi xuất file Markdown')
    } finally {
      setIsExporting(false)
    }
  }

  const handleGenerateAIReport = async () => {
    if (isGeneratingReport) return
    setIsGeneratingReport(true)
    setReportError(null)
    try {
      const report = await generateAIResearchReport(sessionId)
      setAiReport(report)
    } catch (err: any) {
      setReportError(err?.message || 'Có lỗi xảy ra khi tạo Báo cáo AI')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleCopyMarkdown = async () => {
    if (!aiReport?.markdown_content) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(aiReport.markdown_content)
      }
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard', err)
    }
  }

  const handleDownloadReportMarkdown = () => {
    if (!aiReport?.markdown_content) return
    const blob = new Blob([aiReport.markdown_content], { type: 'text/markdown;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai_research_report_${sessionId}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          Đang tải thông tin phiên nghiên cứu #{sessionId}...
        </p>
      </div>
    )
  }

  if (isError || !session) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </Link>
        <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">
            Không thể tải dữ liệu phiên nghiên cứu
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {(error as any)?.message || 'Phiên nghiên cứu không tồn tại hoặc hệ thống gặp sự cố kết nối.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentStage: WorkflowStage = (session.workflow_state || session.current_stage || 'intake') as WorkflowStage
  const stageIndex = WORKFLOW_STAGES.indexOf(currentStage as any) >= 0 ? WORKFLOW_STAGES.indexOf(currentStage as any) : 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Back button */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại danh sách phiên</span>
      </Link>

      {/* Session Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {session.title}
            </h1>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                session.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : session.status === 'paused'
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {STATUS_LABELS[session.status] || session.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Lĩnh vực: <strong className="text-foreground font-medium">{DOMAIN_LABELS[session.domain] || session.domain}</strong>
            </span>
            <span>•</span>
            <span>Tạo lúc: {formatDate(session.created_at)}</span>
            {session.tags && session.tags.length > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  {session.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-accent text-accent-foreground rounded text-[11px]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start md:self-auto no-print">
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Đang xuất...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Xuất Markdown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-all shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            <span>In / Lưu PDF</span>
          </button>
        </div>
      </div>

      {/* Export Error Alert */}
      {exportError && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-destructive hover:underline text-[11px] font-medium"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Workflow Stepper */}
      <WorkflowStepper
        sessionId={sessionId}
        currentStage={currentStage}
        onSelectStage={(stage) => {
          if (
            stage === 'intake' ||
            stage === 'structuring' ||
            stage === 'retrieval' ||
            stage === 'ideation' ||
            stage === 'synthesis'
          ) {
            setActiveTab(stage)
          }
        }}
        onNextStepSuccess={(res) => {
          if (res.recommended_methods && res.recommended_methods.length > 0) {
            setRecommendedMethods(res.recommended_methods)
          }
          const nextStage = res.current_state || res.workflow_state
          if (
            nextStage === 'intake' ||
            nextStage === 'structuring' ||
            nextStage === 'retrieval' ||
            nextStage === 'ideation' ||
            nextStage === 'synthesis'
          ) {
            setActiveTab(nextStage)
          }
        }}
      />

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'intake' && (
          <IntakeForm
            sessionId={sessionId}
            domain={typeof session.domain === 'string' ? session.domain : undefined}
            initialProblemFrame={effectiveProblemFrame}
            onProblemFrameCreated={handleProblemFrameCreated}
          />
        )}

        {activeTab === 'structuring' && (
          effectiveProblemFrame ? (
            <NormalizedView
              problemFrame={effectiveProblemFrame}
              onEditIntake={() => setActiveTab('intake')}
              onProceedToRetrieval={() => setActiveTab('retrieval')}
            />
          ) : (
            <div className="text-center py-16 px-4 rounded-xl border border-dashed border-border text-muted-foreground space-y-4">
              <Brain className="w-12 h-12 mx-auto opacity-40 text-primary" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Chưa có phân tích cấu trúc bài toán
                </h3>
                <p className="text-sm max-w-md mx-auto">
                  Hãy hoàn thành bước <strong>Nhập vấn đề (Problem Intake)</strong> để hệ thống tự động chuẩn hóa và nhận diện mâu thuẫn TRIZ.
                </p>
              </div>
              <div>
                <button
                  onClick={() => setActiveTab('intake')}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Nhập vấn đề ngay
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'retrieval' && (
          <EvidencePanel
            sessionId={sessionId}
            initialQuery={
              effectiveProblemFrame?.normalized_statement ||
              effectiveProblemFrame?.raw_statement ||
              session.title
            }
            domain={typeof session.domain === 'string' ? session.domain : undefined}
            onSaveAsNote={handleSaveAsNote}
          />
        )}

        {activeTab === 'ideation' && (
          <div className="space-y-8">
            <TrizMatrixLookup
              onSelectPrinciple={() => setActiveTab('notebook')}
              onSaveAsNote={handleSaveAsNote}
            />
            <PrincipleSuggestions
              methods={recommendedMethods}
              onSelectPrinciple={() => setActiveTab('notebook')}
              onSaveAsNote={handleSaveAsNote}
            />
            <CandidateSolutions
              sessionId={sessionId}
              onSaveAsNote={handleSaveAsNote}
            />
          </div>
        )}

        {activeTab === 'notebook' && (
          <ResearchNotebook
            sessionId={session.id}
            initialDraft={noteDraft}
            onClearDraft={() => setNoteDraft(null)}
          />
        )}

        {activeTab === 'synthesis' && (
          <div className="space-y-6">
            {/* Header / CTA Banner */}
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-bold text-foreground">
                    Trình Tạo Báo Cáo Nghiên Cứu AI (Synthesis Engine)
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tự động tổng hợp toàn diện bối cảnh mâu thuẫn TRIZ, trích dẫn tri thức và đánh giá các phương án giải pháp. Báo cáo ở chế độ <strong>Xem trước (Preview)</strong> và tuân thủ nguyên tắc <em>Zero Auto-Overwrite</em> (không tự ý ghi đè cơ sở dữ liệu).
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateAIReport}
                  disabled={isGeneratingReport}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                >
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tổng hợp báo cáo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{aiReport ? 'Tạo lại Báo cáo AI' : 'Tạo Báo cáo AI'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {reportError && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reportError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReportError(null)}
                  className="text-destructive hover:underline text-[11px] font-medium shrink-0"
                >
                  Đóng
                </button>
              </div>
            )}

            {/* Report Content or Empty State */}
            {isGeneratingReport ? (
              <div className="p-12 rounded-2xl border border-border bg-card/50 text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Đang tổng hợp tri thức và phân tích đa chiều...
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    AI đang trích xuất các mâu thuẫn kỹ thuật, liên kết tài liệu và đánh giá giải pháp ứng viên.
                  </p>
                </div>
              </div>
            ) : aiReport ? (
              <div className="space-y-6">
                {/* Report Header Card */}
                <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-bold text-foreground">
                          {aiReport.report_title}
                        </h2>
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5',
                            aiReport.provenance === 'ai_synthesis'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              aiReport.provenance === 'ai_synthesis'
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                            )}
                          />
                          {aiReport.provenance === 'ai_synthesis'
                            ? 'AI Synthesis'
                            : 'Rule-Based Fallback'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Mã phiên: <code className="text-foreground">{aiReport.session_id}</code> • Nguồn: {aiReport.provider}/{aiReport.model} • Độ trễ: {aiReport.latency_ms}ms
                      </p>
                    </div>

                    {/* Report Action Buttons */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={handleCopyMarkdown}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all shadow-sm cursor-pointer"
                      >
                        {hasCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Đã sao chép!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Sao chép Markdown</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadReportMarkdown}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Tải file .md</span>
                      </button>
                    </div>
                  </div>

                  {aiReport.fallback_reason && (
                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Báo cáo được tạo bằng quy tắc dự phòng (Fallback reason: {aiReport.fallback_reason})
                    </div>
                  )}

                  {/* Section Breakdown */}
                  <div className="space-y-6 pt-2">
                    {/* 1. Executive Summary */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        1. Tóm Tắt Điều Hành (Executive Summary)
                      </h3>
                      <div className="p-4 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground leading-relaxed">
                        {aiReport.executive_summary}
                      </div>
                    </div>

                    {/* 2. Problem Background */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        2. Bối Cảnh & Định Khung Mâu Thuẫn (Problem Background)
                      </h3>
                      <div className="p-4 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-line">
                        {aiReport.problem_background}
                      </div>
                    </div>

                    {/* 3. Evidence Synthesis */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        3. Tổng Hợp Tri Thức & Bằng Chứng (Evidence Synthesis)
                      </h3>
                      <div className="p-4 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-line">
                        {aiReport.evidence_synthesis}
                      </div>
                    </div>

                    {/* 4. Solution Assessment */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        4. Đánh Giá Giải Pháp Sáng Tạo (Solution Assessment)
                      </h3>
                      <div className="p-4 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-line">
                        {aiReport.solution_assessment}
                      </div>
                    </div>

                    {/* 5. Action Plan */}
                    {aiReport.action_plan && aiReport.action_plan.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          5. Kế Hoạch Hành Động Đề Xuất (Action Plan)
                        </h3>
                        <ul className="p-4 rounded-xl bg-accent/40 border border-border/50 text-xs text-foreground space-y-1.5">
                          {aiReport.action_plan.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary font-semibold shrink-0">•</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-2xl border border-dashed border-border text-center space-y-3">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-semibold text-foreground">
                  Chưa có báo cáo tổng hợp nào được tạo
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Nhấn nút <strong>Tạo Báo cáo AI</strong> ở trên để tự động phân tích và tạo báo cáo nghiên cứu hoàn chỉnh cho phiên này.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
