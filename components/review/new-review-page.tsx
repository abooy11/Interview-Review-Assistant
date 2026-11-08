"use client"

// /new-review — 新建面试复盘 form. Sections: 面试信息 / 面试记录 / actions.
// Draft auto-save + explicit 保存草稿; validation; AI analyzing overlay.

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { AI_STEPS, describeAiError, runAiReview } from "@/lib/review/ai"
import { createDraft, findPendingDraft, saveReview } from "@/lib/review/store"
import {
  COMPANY_CATEGORIES,
  computeOverall,
  OUTCOME_LABELS,
  type ReviewContent,
  type ReviewOutcome,
} from "@/lib/review/types"

const ROUND_OPTIONS = ["一面", "二面", "三面", "HR面", "终面", "其他"]
const OUTCOME_OPTIONS = Object.entries(OUTCOME_LABELS) as [ReviewOutcome, string][]
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB

interface FormState {
  id: string | null
  company: string
  round: string
  customRound: string
  position: string
  companyCategory: string
  jobDescription: string
  originalInterviewText: string
  sourceFileName: string | null
  sourceFileSize: number | null
  outcome: ReviewOutcome
}

const emptyForm = (): FormState => ({
  id: null,
  company: "",
  round: "",
  customRound: "",
  position: "",
  companyCategory: "",
  jobDescription: "",
  originalInterviewText: "",
  sourceFileName: null,
  sourceFileSize: null,
  outcome: "pending",
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Parse an uploaded text file into extractable content. */
async function parseFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "txt" || ext === "md") return await file.text()
  if (ext === "docx") {
    // Lazy-load mammoth only when a .docx is actually uploaded
    const mammoth = (await import("mammoth")).default
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
  }
  // 统一提示（spec §四）：不支持 PDF 等其他格式
  throw new Error("当前暂不支持该文件格式，请将文字直接粘贴到下方输入框。")
}

export function NewReviewPage() {
  const router = useRouter()

  // Resume the newest unfinished draft (spec §17).
  // 直接从 localStorage 读取（mount 时执行一次），而不是 useReviews()：
  // useSyncExternalStore 在 hydration 中返回空快照，effect 先跑一次后
  // resumedRef 置位，真实数据再到达时不会再触发恢复 —— 会导致草稿永远无法恢复。
  const [form, setForm] = useState<FormState>(emptyForm)
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true
    const resume = findPendingDraft()
    if (!resume) return
    const storedRound = resume.interviewRound ?? ""
    setForm({
      id: resume.id,
      company: resume.company,
      // 恢复轮次：已知选项原样恢复；自定义轮次归入「其他」；旧数据为空则保持未选
      round: ROUND_OPTIONS.includes(storedRound) ? storedRound : storedRound ? "其他" : "",
      customRound: storedRound,
      position: resume.position,
      companyCategory: resume.companyCategory ?? "",
      jobDescription: resume.jobDescription,
      originalInterviewText: resume.originalInterviewText,
      sourceFileName: resume.sourceFileName,
      sourceFileSize: resume.sourceFileSize,
      outcome: resume.outcome ?? "pending",
    })
  }, [])

  const [errors, setErrors] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null)
  const [saveFlash, setSaveFlash] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [parsedFromFile, setParsedFromFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // --- Draft persistence ----------------------------------------------

  const persistDraft = useCallback(
    (f: FormState) => {
      const record = createDraft({
        id: f.id ?? undefined,
        company: f.company,
        interviewRound: f.round === "其他" ? f.customRound : f.round,
        position: f.position,
        jobDescription: f.jobDescription,
        originalInterviewText: f.originalInterviewText,
        sourceFileName: f.sourceFileName,
        sourceFileSize: f.sourceFileSize,
        outcome: f.outcome,
        companyCategory: f.companyCategory,
      })
      const saved = saveReview(record)
      setForm((prev) => (prev.id === saved.id ? prev : { ...prev, id: saved.id }))
      return saved
    },
    [],
  )

  // Auto-save draft (debounced) whenever the form changes
  useEffect(() => {
    if (analyzing) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const hasContent = Boolean(
        form.company || form.round || form.position || form.jobDescription || form.originalInterviewText,
      )
      if (!hasContent) return
      persistDraft(form)
      setAutoSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }))
    }, 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [form, analyzing, persistDraft])

  // --- File upload -----------------------------------------------------

  const handleFile = async (file: File) => {
    setFileError(null)
    if (file.size > MAX_FILE_BYTES) {
      setFileError("文件过大（>15MB），请粘贴文本内容")
      return
    }
    try {
      const text = await parseFile(file)
      setForm((f) => ({
        ...f,
        originalInterviewText: f.originalInterviewText ? `${f.originalInterviewText}\n\n${text}` : text,
        sourceFileName: file.name,
        sourceFileSize: file.size,
      }))
      setParsedFromFile(true)
    } catch (err) {
      if (err instanceof Error) setFileError(err.message)
      else setFileError("文件读取失败")
    }
  }

  // --- Validation + AI ------------------------------------------------

  const validate = (): string[] => {
    const errs: string[] = []
    if (!form.company.trim()) errs.push("请输入公司名称")
    if (!form.position.trim()) errs.push("请输入面试岗位")
    if (!form.round) {
      errs.push("请选择面试轮次")
    } else if (form.round === "其他" && !form.customRound.trim()) {
      errs.push("请填写自定义面试轮次")
    }
    if (!form.companyCategory) errs.push("请选择公司类别")
    if (!form.originalInterviewText.trim()) errs.push("请上传面试记录或粘贴面试记录内容")
    return errs
  }

  const hasError = (
    key: keyof Pick<FormState, "company" | "round" | "position" | "companyCategory" | "originalInterviewText">,
  ) =>
    errors.some((e) =>
      e.includes(
        {
          company: "公司",
          round: "轮次",
          position: "岗位",
          companyCategory: "公司类别",
          originalInterviewText: "面试记录",
        }[key],
      ),
    )

  const startAnalysis = async () => {
    const errs = validate()
    if (errs.length) {
      setErrors(errs)
      return
    }
    setErrors([])
    setAiError(null)
    const roundValue = form.round === "其他" ? form.customRound : form.round
    const record = persistDraft(form)
    setAnalyzing(true)
    setProgress(0)
    try {
      const content: ReviewContent = await runAiReview(
        {
          company: form.company,
          interviewRound: roundValue,
          position: form.position,
          jobDescription: form.jobDescription,
          originalInterviewText: form.originalInterviewText,
        },
        setProgress,
      )
      const updated = saveReview({
        ...record,
        aiReviewDraft: content,
        overallScore: computeOverall(content.scores),
        status: "pending",
      })
      router.push(`/review?id=${updated.id}`)
    } catch (err) {
      // 任何异常都不崩溃页面：提示 + 保留表单内容，可再次点击重试
      console.error("[ai] 生成 AI 复盘失败:", err)
      setAiError(describeAiError(err))
    } finally {
      setAnalyzing(false)
    }
  }

  const saveDraftNow = () => {
    persistDraft(form)
    setAutoSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }))
    setSaveFlash(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setSaveFlash(false), 2200)
  }

  // 取消前检查：填写了内容 → 确认框；否则直接返回
  const cancel = () => {
    const hasContent = Boolean(
      form.company || form.round || form.position || form.jobDescription || form.originalInterviewText,
    )
    if (hasContent) setConfirmCancel(true)
    else router.push("/")
  }

  const removeFile = () =>
    setForm((f) => ({ ...f, sourceFileName: null, sourceFileSize: null }))

  const roundValue = form.round === "其他" ? form.customRound : form.round

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa] p-6 md:p-8">
      <div className="mx-auto w-full max-w-[840px] space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.03em] text-[#0f0f12]">
              新建面试复盘
            </h1>
            <p className="mt-1 text-[14px] text-[#8b8b8b]">
              填写面试信息 → 上传或粘贴记录 → AI 生成复盘初稿 → 修改后保存最终复盘
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {autoSavedAt && (
              <span className="flex items-center gap-1.5 text-[12px] text-[#10b981]">
                <Check className="size-3.5" /> 草稿已自动保存 {autoSavedAt}
              </span>
            )}
            {/* 返回：复用 cancel()，已填写内容时走同一个确认弹窗 */}
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-1.5 rounded-full border border-[#d8d8d8] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:border-[#9b9b9b] hover:text-[#0f0f12]"
            >
              <ArrowLeft className="size-3.5" /> 返回
            </button>
          </div>
        </div>

        {/* Validation errors */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-1.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3"
            >
              {errors.map((e) => (
                <span key={e} className="flex items-center gap-2 text-[13px] text-[#b91c1c]">
                  <AlertCircle className="size-3.5 shrink-0" /> {e}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI 生成失败提示（spec §十二）：不崩溃，保留已填写内容，可重试 */}
        <AnimatePresence>
          {aiError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3"
            >
              <AlertCircle className="size-4 shrink-0 text-[#c2410c]" />
              <span className="flex-1 text-[13px] text-[#9a3412]">
                {aiError} 已填写的公司、轮次、岗位和面试记录都已自动保存，点击「开始 AI 复盘」可重新生成。
              </span>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="rounded-full border border-[#d8d8d8] px-3 py-1 text-[12px] text-[#3a3a3a] transition-colors hover:border-[#9b9b9b]"
              >
                关闭
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 1 — 面试信息 */}
        <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-3 text-[18px] font-semibold text-[#0f0f12]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f0f12] text-[11px] font-bold text-white">1</span>
            面试信息
            <span className="text-[12px] font-normal text-[#b0b0b0]">带 * 为必填</span>
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-[13px] font-medium text-[#3a3a3a]">
                公司名称 <span className="text-[#dc2626]">*</span>
              </label>
              <input
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="例如：百度、字节跳动、吉利汽车"
                className={cn(
                  "h-10 w-full rounded-lg border border-[#e3e3e3] bg-white px-3 text-[14px] outline-none transition-colors focus:border-[#191775]",
                  errors.some((e) => e.includes("公司")) && "border-[#dc2626]",
                )}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-[13px] font-medium text-[#3a3a3a]">
                面试轮次 <span className="text-[#dc2626]">*</span>
              </label>
              <div
                className={cn(
                  "flex flex-wrap gap-1.5",
                  errors.some((e) => e.includes("轮次")) && "rounded-lg ring-1 ring-[#dc2626] p-1.5",
                )}
              >
                {ROUND_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set("round", opt === form.round ? "" : opt)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] transition-all",
                      form.round === opt
                        ? "border-[#191775] bg-[#191775] text-white"
                        : "border-[#e3e3e3] text-[#3a3a3a] hover:border-[#9b9b9b]",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {form.round === "其他" && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    value={form.customRound}
                    onChange={(e) => set("customRound", e.target.value)}
                    placeholder="自定义轮次，例如：笔试、电话面"
                    className={cn(
                      "h-10 w-full rounded-lg border border-[#e3e3e3] bg-white px-3 text-[14px] outline-none transition-colors focus:border-[#191775]",
                      errors.some((e) => e.includes("轮次")) && "border-[#dc2626]",
                    )}
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="grid gap-2">
              <label className="text-[13px] font-medium text-[#3a3a3a]">
                面试岗位 <span className="text-[#dc2626]">*</span>
              </label>
              <input
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
                placeholder="例如：产品经理、B端产品经理"
                className={cn(
                  "h-10 w-full rounded-lg border border-[#e3e3e3] bg-white px-3 text-[14px] outline-none transition-colors focus:border-[#191775]",
                  errors.some((e) => e.includes("岗位")) && "border-[#dc2626]",
                )}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-[13px] font-medium text-[#3a3a3a]">面试结果</label>
              <div className="flex flex-wrap gap-1.5">
                {OUTCOME_OPTIONS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("outcome", key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] transition-all",
                      form.outcome === key
                        ? "border-[#191775] bg-[#191775] text-white"
                        : "border-[#e3e3e3] text-[#3a3a3a] hover:border-[#9b9b9b]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#b0b0b0]">结果之后可以在复盘详情中随时修改</span>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="text-[13px] font-medium text-[#3a3a3a]">
                公司类别 <span className="text-[#dc2626]">*</span>
              </label>
              <div
                className={cn(
                  "flex flex-wrap gap-1.5",
                  errors.some((e) => e.includes("公司类别")) && "rounded-lg ring-1 ring-[#dc2626] p-1.5",
                )}
              >
                {COMPANY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set("companyCategory", cat === form.companyCategory ? "" : cat)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] transition-all",
                      form.companyCategory === cat
                        ? "border-[#191775] bg-[#191775] text-white"
                        : "border-[#e3e3e3] text-[#3a3a3a] hover:border-[#9b9b9b]",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#b0b0b0]">所属行业类别，之后可以在复盘详情中随时修改</span>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="text-[13px] font-medium text-[#3a3a3a]">岗位介绍 / JD</label>
              <textarea
                value={form.jobDescription}
                onChange={(e) => set("jobDescription", e.target.value)}
                rows={5}
                placeholder="粘贴岗位JD或岗位介绍，AI将结合岗位要求分析本次面试表现。"
                className="w-full resize-y rounded-lg border border-[#e3e3e3] bg-white px-3 py-2.5 text-[14px] leading-[22px] outline-none transition-colors focus:border-[#191775]"
              />
            </div>
          </div>
        </div>

        {/* Section 2 — 面试记录 */}
        <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-3 text-[18px] font-semibold text-[#0f0f12]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f0f12] text-[11px] font-bold text-white">2</span>
            面试记录
            <span className="text-[12px] font-normal text-[#b0b0b0]">原始记录将单独保存，不会被AI总结覆盖</span>
          </h2>

          {/* Upload zone */}
          {!form.sourceFileName ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d8d8d8] bg-[#fbfbfb] px-6 py-8 transition-colors hover:border-[#191775] hover:bg-[#f6f6fd]",
                errors.some((e) => e.includes("面试记录")) && "border-[#dc2626]",
              )}
            >
              <UploadCloud className="size-7 text-[#8b8b8b]" />
              <span className="text-[14px] font-medium text-[#3a3a3a]">上传面试记录</span>
              <span className="text-[12px] text-[#b0b0b0]">
                支持 .txt / .docx / .md 文件解析，其他格式请将文字直接粘贴到下方输入框
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-[#e3e3e3] bg-[#fbfbfb] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef1f4]">
                <FileText className="size-4.5 text-[#6b7280]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#1f1f1f]">{form.sourceFileName}</p>
                <p className="text-[12px] text-[#8b8b8b]">{formatSize(form.sourceFileSize ?? 0)}</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-md border border-[#e3e3e3] px-2.5 py-1.5 text-[12px] text-[#3a3a3a] transition-colors hover:border-[#9b9b9b]"
              >
                <RefreshCw className="size-3.5" /> 重新上传
              </button>
              <button
                type="button"
                onClick={removeFile}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-[#dc2626] transition-colors hover:bg-[#fee2e2]"
              >
                <Trash2 className="size-3.5" /> 删除
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ""
            }}
          />
          {fileError && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#dc2626]">
              <AlertCircle className="size-3.5" /> {fileError}
            </p>
          )}
          {parsedFromFile && !fileError && form.sourceFileName && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#10b981]">
              <Check className="size-3.5" /> 已从文件读取内容，可继续编辑下面的文本框
            </p>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#eee]" />
            <span className="text-[12px] text-[#b0b0b0]">或者直接粘贴面试记录</span>
            <span className="h-px flex-1 bg-[#eee]" />
          </div>

          <textarea
            value={form.originalInterviewText}
            onChange={(e) => set("originalInterviewText", e.target.value)}
            rows={12}
            placeholder={"请粘贴面试录音转写、面试笔记或面试问答记录……\n\n面试官：为什么想做产品经理？\n我：因为我之前主要学习品牌设计……\n面试官：你为什么从设计转产品？\n我：……"}
            className={cn(
              "w-full resize-y rounded-lg border border-[#e3e3e3] bg-white px-3 py-2.5 text-[14px] leading-[24px] outline-none transition-colors focus:border-[#191775]",
              errors.some((e) => e.includes("面试记录")) && "border-[#dc2626]",
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={cancel}
            className="rounded-full border border-[#d8d8d8] px-6 py-2.5 text-[14px] font-medium text-[#3a3a3a] transition-colors hover:border-[#9b9b9b]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={saveDraftNow}
            className="rounded-full border border-[#d8d8d8] px-6 py-2.5 text-[14px] font-medium text-[#3a3a3a] transition-colors hover:border-[#9b9b9b]"
          >
            保存草稿
          </button>
          <AnimatePresence>
            {saveFlash && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[12px] text-[#10b981]"
              >
                <Check className="size-3.5" /> 草稿已保存
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={startAnalysis}
            disabled={analyzing}
            className="ml-auto flex items-center gap-2 rounded-full bg-[#191775] px-7 py-3 text-[14px] font-medium text-white shadow-[inset_0_4px_16px_1px_rgba(255,255,255,0.22),0_2px_12px_0_rgba(0,0,0,0.25)] transition-colors hover:bg-[#12125c] disabled:opacity-60"
          >
            {analyzing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> AI 正在分析…
              </>
            ) : (
              "开始 AI 复盘"
            )}
          </button>
        </div>

        {/* 取消确认（spec §九）：已填写内容 → 弹窗确认 */}
        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>当前内容尚未保存，确定退出吗？</AlertDialogTitle>
              <AlertDialogDescription>
                退出前会保留已自动保存的草稿；如果你正在编辑的内容没有保存，退出后将丢失。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="h-9 rounded-md border px-4 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:bg-[#f0f0f0]"
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="h-9 rounded-md bg-[#191775] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#12125c]"
              >
                确认退出
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Analyzing overlay */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0f12]/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              className="w-[320px] rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#0f0f12]">正在分析本次面试……</span>
                <Loader2 className="size-5 animate-spin text-[#191775]" />
              </div>
              <div className="space-y-2.5">
                {AI_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-2.5 text-[13px]">
                    {i < progress ? (
                      <Check className="size-4 text-[#10b981]" />
                    ) : i === progress ? (
                      <Loader2 className="size-4 animate-spin text-[#191775]" />
                    ) : (
                      <span className="size-4 rounded-full border border-[#e3e3e3]" />
                    )}
                    <span className={cn(i <= progress ? "text-[#1f1f1f]" : "text-[#b0b0b0]")}>{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
