"use client"

// /review?id=xxx — AI复盘初稿展示 + 编辑 + 保存最终复盘 + 重新生成。
// 原始记录 (originalInterviewText) 永不覆盖；重新生成只更新 aiReviewDraft。

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, ChevronDown, Loader2, PenLine, RefreshCw, Save, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AI_STEPS, describeAiError, runAiReview } from "@/lib/review/ai"
import { saveReview, useReview } from "@/lib/review/store"
import {
  COMPANY_CATEGORIES,
  SCORE_DIMENSIONS,
  computeOverall,
  OUTCOME_LABELS,
  type QuestionReview,
  type ReviewContent,
  type ReviewOutcome,
  type ScoreMap,
  type WeaknessItem,
} from "@/lib/review/types"
import { EditableBlock, SectionBadgeTag, type SectionBadge } from "./editable-block"

export function ReviewPage() {
  const params = useSearchParams()
  const router = useRouter()
  const id = params.get("id")
  const review = useReview(id)

  const [allEdit, setAllEdit] = useState(false)
  const [content, setContent] = useState<ReviewContent | null>(null)
  const [savedVersion, setSavedVersion] = useState<ReviewContent | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [savedFlash, setSavedFlash] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  // ---- editing helpers: edit a working copy, mark edited sections -----

  const markEdited = (sections: string[]) =>
    setContent((c) =>
      c ? { ...c, editedSections: Array.from(new Set([...(c.editedSections ?? []), ...sections])) } : c,
    )

  const editText = (section: string, value: string) => {
    setContent((c) => (c ? { ...c, [section]: value } : c))
    markEdited([section])
  }

  const editScore = (key: keyof ScoreMap, value: number) => {
    setContent((c) =>
      c ? { ...c, scores: { ...c.scores, [key]: Math.max(0, Math.min(100, value)) } } : c,
    )
    markEdited(["scores"])
  }

  const editQuestion = (qid: string, patch: Partial<QuestionReview>) => {
    setContent((c) =>
      c
        ? {
            ...c,
            questionReviews: c.questionReviews.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
          }
        : c,
    )
    markEdited([`q:${qid}`])
  }

  const editItem = (list: "strengths" | "nextPreparation", idx: number, value: string) => {
    setContent((c) => {
      if (!c) return c
      const arr = [...(c[list] ?? [])]
      arr[idx] = value
      return { ...c, [list]: arr }
    })
    markEdited([list])
  }

  const editWeakness = (idx: number, patch: Partial<WeaknessItem>) => {
    setContent((c) => {
      if (!c) return c
      const arr = c.weaknesses.map((w, i) => (i === idx ? { ...w, ...patch } : w))
      return { ...c, weaknesses: arr }
    })
    markEdited(["weaknesses"])
  }

  const addItem = (list: "strengths" | "nextPreparation") => {
    setContent((c) => (c ? { ...c, [list]: [...(c[list] ?? []), ""] } : c))
    markEdited([list])
  }

  const removeItem = (list: "strengths" | "nextPreparation", idx: number) => {
    setContent((c) =>
      c ? { ...c, [list]: (c[list] ?? []).filter((_, i) => i !== idx) } : c,
    )
    markEdited([list])
  }

  // ---- active content: starts from finalReview if present, else draft ---

  const [lastSourceId, setLastSourceId] = useState<string | null>(null)
  useEffect(() => {
    if (!review) return
    if (lastSourceId === review.id) return
    const source = review.finalReview ?? review.aiReviewDraft
    setContent(source ? structuredClone(source) : null)
    setSavedVersion(review.finalReview ?? null)
    setLastSourceId(review.id)
  }, [review, lastSourceId])


  // ---- badges ----------------------------------------------------------

  const badgeFor = (section: string): SectionBadge => {
    if (savedVersion && savedVersion.editedSections?.includes(section)) return "最终版本"
    if (content?.editedSections?.includes(section)) return "已修改"
    return "AI生成"
  }

  const questionBadge = (qid: string): SectionBadge =>
    savedVersion && savedVersion.editedSections?.includes(`q:${qid}`)
      ? "最终版本"
      : content?.editedSections?.includes(`q:${qid}`)
        ? "已修改"
        : "AI生成"

  const hasFinal = Boolean(review?.finalReview)
  const overall = content ? computeOverall(content.scores) : 0
  const comparedToAi = useMemo(() => {
    if (!content) return false
    return JSON.stringify(content) !== JSON.stringify(savedVersion ?? review?.aiReviewDraft)
  }, [content, savedVersion, review?.aiReviewDraft])

  // ---- actions ----------------------------------------------------------

  const saveFinal = () => {
    if (!review || !content) return
    const next: ReviewContent = { ...content, editedSections: content.editedSections ?? [] }
    const updated = saveReview({
      ...review,
      finalReview: next,
      aiReviewDraft: review.aiReviewDraft, // untouched
      overallScore: computeOverall(next.scores),
      status: "completed",
    })
    setSavedVersion(next)
    setLastSourceId(null) // keep current content
    setAllEdit(false)
    setSavedFlash(true)
    void updated
    setTimeout(() => setSavedFlash(false), 2200)
  }

  const regenerate = async () => {
    if (!review) return
    setConfirmRegen(false)
    setRegenerating(true)
    setProgress(0)
    setRegenError(null)
    try {
      const fresh = await runAiReview(
        {
          company: review.company,
          interviewRound: review.interviewRound,
          position: review.position,
          jobDescription: review.jobDescription,
          originalInterviewText: review.originalInterviewText,
        },
        setProgress,
      )
      const updated = saveReview({
        ...review,
        aiReviewDraft: fresh, // replaces only the draft — finalReview untouched
        overallScore: computeOverall(fresh.scores),
      })
      setSavedVersion(updated.finalReview ?? null)
      setContent(structuredClone(updated.finalReview ?? fresh))
      setLastSourceId(updated.id)
      setAllEdit(false)
    } catch (err) {
      console.error("[ai] 重新生成失败:", err)
      setRegenError(describeAiError(err))
    } finally {
      setRegenerating(false)
    }
  }

  // 面试结果可随时修改（spec §十九）：单选，保存后首页卡片同步
  const outcomeOptions = Object.entries(OUTCOME_LABELS) as [ReviewOutcome, string][]
  const changeOutcome = (value: ReviewOutcome) => {
    if (!review) return
    saveReview({ ...review, outcome: value, status: review.status })
  }

  // 公司类别可随时修改：保存后首页自动移动到新分类（旧数据缺类别也可在此补充）
  const changeCategory = (value: string) => {
    if (!review) return
    saveReview({ ...review, companyCategory: value, status: review.status })
  }

  // ---- render -----------------------------------------------------------

  if (!id) return null

  if (!review || !content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3 text-[#8b8b8b]">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-[14px]">加载中…</span>
        </div>
      </div>
    )
  }

  const scoresBadge = badgeFor("scores")

  return (
    <div className="min-h-screen bg-[#fafafa] p-6 md:p-8">
      <div className="mx-auto w-full max-w-[860px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[26px] leading-[32px] font-semibold tracking-[-0.03em] text-[#0f0f12]">
                AI 复盘{hasFinal ? "（最终版本）" : "初稿"}
              </h1>
              {hasFinal ? (
                <SectionBadgeTag badge="最终版本" />
              ) : comparedToAi ? (
                <SectionBadgeTag badge="已修改" />
              ) : (
                <SectionBadgeTag badge="AI生成" />
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-[#6b7280]">
              {[review.company, review.position, review.interviewRound].filter(Boolean).map((chip, i) => (
                <span key={chip} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[#d0d0d0]">｜</span>}
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-medium text-[#3a3a3a] shadow-sm">
                    {chip}
                  </span>
                </span>
              ))}
              {!hasFinal && (
                <span className="ml-1 text-[12px] text-[#b0b0b0]">未保存，内容可直接修改</span>
              )}
            </div>

            {/* 面试结果 — 单选，保存后首页「面试记录」卡同步显示 */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[#6b7280]">
              <span className="text-[12px] text-[#b0b0b0]">面试结果</span>
              <div className="flex flex-wrap gap-1.5">
                {outcomeOptions.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeOutcome(key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] transition-colors",
                      (review.outcome ?? "pending") === key
                        ? "border-[#191775] bg-[#191775] text-white"
                        : "border-[#e3e3e3] text-[#3a3a3a] hover:border-[#9b9b9b]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 公司类别 — 单选，保存后首页记录自动移动到新分类 */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[#6b7280]">
              <span className="text-[12px] text-[#b0b0b0]">公司类别</span>
              <div className="flex flex-wrap gap-1.5">
                {COMPANY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => changeCategory(cat === review.companyCategory ? "" : cat)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] transition-colors",
                      review.companyCategory === cat
                        ? "border-[#191775] bg-[#191775] text-white"
                        : "border-[#e3e3e3] text-[#3a3a3a] hover:border-[#9b9b9b]",
                    )}
                  >
                    {cat}
                  </button>
                ))}
                {!(COMPANY_CATEGORIES as readonly string[]).includes(review.companyCategory) && (
                  <span className="text-[12px] text-[#b0b0b0]">未分类 — 点击上方选项补充</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-full border border-[#d8d8d8] px-4 py-2 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:border-[#9b9b9b]"
            >
              返回
            </button>
            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              disabled={regenerating}
              className="flex items-center gap-1.5 rounded-full border border-[#d8d8d8] px-4 py-2 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:border-[#9b9b9b] disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" /> 重新生成
            </button>
            <button
              type="button"
              onClick={() => setAllEdit((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                allEdit
                  ? "bg-[#f0f0f0] text-[#3a3a3a]"
                  : "border border-[#191775] text-[#191775] hover:bg-[#f6f6fd]",
              )}
            >
              <PenLine className="size-3.5" /> {allEdit ? "退出全部编辑" : "编辑复盘"}
            </button>
            <button
              type="button"
              onClick={saveFinal}
              className="flex items-center gap-1.5 rounded-full bg-[#191775] px-5 py-2 text-[13px] font-medium text-white shadow-[inset_0_4px_16px_1px_rgba(255,255,255,0.22),0_2px_12px_0_rgba(0,0,0,0.25)] transition-colors hover:bg-[#12125c]"
            >
              {savedFlash ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
              {hasFinal ? "更新最终复盘" : "保存最终复盘"}
            </button>
            {regenError && <span className="w-full text-[12px] text-[#b42318]">{regenError}</span>}
          </div>
        </div>

        {savedFlash && (
          <div className="flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-2.5 text-[13px] text-[#15803d]">
            <Check className="size-4" /> 最终复盘已保存，并已加入「我的面试复盘」
          </div>
        )}

        {/* Overall — 总评 */}
        <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
          <EditableBlock
            label="面试表现总评"
            value={content.overallSummary}
            onChange={(v) => editText("overallSummary", v)}
            badge={badgeFor("overallSummary")}
            forceEdit={allEdit}
            className="gap-3"
          />
        </div>

        {/* Scores — 评分 */}
        <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8b8b8b]">
              面试表现评分
            </span>
            <SectionBadgeTag badge={scoresBadge} />
          </div>

          <div className="mb-5 flex items-baseline gap-2">
            <span className="text-[40px] leading-none font-bold tracking-[-0.04em] text-[#0f0f12]">
              {overall}
            </span>
            <span className="text-[13px] text-[#8b8b8b]">综合评分（仅供参考）</span>
            {!allEdit && (
              <span className="ml-auto text-[12px] italic text-[#b0b0b0]">评分仅为辅助参考，不代表测评结论</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SCORE_DIMENSIONS.map(({ key, label }) => {
              const value = content.scores[key] ?? 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[13px] text-[#3a3a3a]">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
                    <div
                      className="h-full rounded-full bg-[#191775] transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  {allEdit ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) => editScore(key, Number(e.target.value))}
                      className="h-8 w-14 rounded-md border border-[#e3e3e3] px-2 text-right text-[13px] outline-none focus:border-[#191775]"
                    />
                  ) : (
                    <span className="w-10 text-right text-[13px] font-semibold text-[#0f0f12]">{value}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Question cards — 关键问题复盘 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-[19px] font-semibold text-[#0f0f12]">高频 / 关键问题复盘</h2>
            <span className="text-[12px] text-[#b0b0b0]">共 {content.questionReviews.length} 题</span>
          </div>
          {content.questionReviews.map((q, qi) => (
            <div key={q.id} className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef1f4] text-[11px] font-bold text-[#6b7280]">
                  {String(qi + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] font-semibold text-[#1f1f1f]">
                  面试官：{q.question}
                </span>
                <div className="ml-auto">
                  <SectionBadgeTag badge={questionBadge(q.id)} />
                </div>
              </div>

              <div className="rounded-xl bg-[#fbfbfb] px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8b8b8b]">我的原回答（原始记录摘录）</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[22px] text-[#595959]">
                  {q.myAnswer || "（原始记录中未摘录到）"}
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <EditableBlock
                  label="AI 评价"
                  value={q.aiEvaluation}
                  onChange={(v) => editQuestion(q.id, { aiEvaluation: v })}
                  badge={questionBadge(q.id)}
                  forceEdit={allEdit}
                />
                <EditableBlock
                  label="改进建议"
                  value={q.improvementSuggestion}
                  onChange={(v) => editQuestion(q.id, { improvementSuggestion: v })}
                  badge={questionBadge(q.id)}
                  forceEdit={allEdit}
                />
                <EditableBlock
                  label="推荐回答"
                  value={q.recommendedAnswer}
                  onChange={(v) => editQuestion(q.id, { recommendedAnswer: v })}
                  badge={questionBadge(q.id)}
                  forceEdit={allEdit}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Strengths / Weaknesses — 做得好的 + 需要改进 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-[#0f0f12]">做得好的地方</h2>
              <SectionBadgeTag badge={badgeFor("strengths")} />
            </div>
            <ul className="space-y-2.5">
              {content.strengths.map((s, i) =>
                allEdit ? (
                  <li key={i} className="flex gap-2">
                    <input
                      value={s}
                      onChange={(e) => editItem("strengths", i, e.target.value)}
                      className="h-8 flex-1 rounded-md border border-[#e3e3e3] px-2.5 text-[13px] outline-none focus:border-[#191775]"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem("strengths", i)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#dc2626] transition-colors hover:bg-[#fee2e2]"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ) : (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] leading-[22px] text-[#3a3a3a]">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#191775]" />
                    {s}
                  </li>
                ),
              )}
            </ul>
            {allEdit && (
              <button
                type="button"
                onClick={() => addItem("strengths")}
                className="mt-3 rounded-md border border-dashed border-[#d8d8d8] px-3 py-1.5 text-[12px] text-[#8b8b8b] transition-colors hover:border-[#191775] hover:text-[#191775]"
              >
                + 添加一条
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-[#0f0f12]">需要改进</h2>
              <SectionBadgeTag badge={badgeFor("weaknesses")} />
            </div>
            <div className="space-y-3">
              {content.weaknesses.map((w, i) =>
                allEdit ? (
                  <div key={i} className="grid gap-2 rounded-lg border border-[#f0f0f0] bg-[#fbfbfb] p-3">
                    <input
                      value={w.title}
                      onChange={(e) => editWeakness(i, { title: e.target.value })}
                      placeholder="标题"
                      className="h-8 rounded-md border border-[#e3e3e3] bg-white px-2.5 text-[13px] font-medium outline-none focus:border-[#191775]"
                    />
                    <textarea
                      value={w.detail}
                      onChange={(e) => editWeakness(i, { detail: e.target.value })}
                      placeholder="详细说明"
                      rows={2}
                      className="w-full resize-none rounded-md border border-[#e3e3e3] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#191775]"
                    />
                  </div>
                ) : (
                  <div key={i} className="rounded-lg bg-[#fbfbfb] px-4 py-3">
                    <p className="text-[13px] font-semibold text-[#1f1f1f]">① {w.title}</p>
                    <p className="mt-1 text-[13px] leading-[21px] text-[#595959]">{w.detail}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Next preparation — 下一次面试重点准备 */}
        <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#0f0f12]">下一次面试建议</h2>
            <SectionBadgeTag badge={badgeFor("nextPreparation")} />
          </div>
          <ul className="space-y-2">
            {content.nextPreparation.map((n, i) =>
              allEdit ? (
                <li key={i} className="flex gap-2">
                  <input
                    value={n}
                    onChange={(e) => editItem("nextPreparation", i, e.target.value)}
                    className="h-8 flex-1 rounded-md border border-[#e3e3e3] px-2.5 text-[13px] outline-none focus:border-[#191775]"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem("nextPreparation", i)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#dc2626] transition-colors hover:bg-[#fee2e2]"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ) : (
                <li key={i} className="flex items-start gap-2.5 text-[14px] leading-[22px] text-[#3a3a3a]">
                  <span className="mt-[6px] w-4 shrink-0 text-right text-[13px] font-bold text-[#191775]">
                    {i + 1}.
                  </span>
                  {n}
                </li>
              ),
            )}
          </ul>
          {allEdit && (
            <button
              type="button"
              onClick={() => addItem("nextPreparation")}
              className="mt-3 rounded-md border border-dashed border-[#d8d8d8] px-3 py-1.5 text-[12px] text-[#8b8b8b] transition-colors hover:border-[#191775] hover:text-[#191775]"
            >
              + 添加一条
            </button>
          )}
        </div>

        {/* Original transcript — 原始面试记录 */}
        <div className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <span className="text-[16px] font-semibold text-[#0f0f12]">原始面试记录</span>
            <span className="text-[12px] text-[#b0b0b0]">
              与 AI 复盘独立保存{review.sourceFileName ? `／来源文件：${review.sourceFileName}` : ""}
            </span>
            <ChevronDown className={cn("ml-auto size-4 text-[#8b8b8b] transition-transform", showOriginal && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showOriginal && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[#fbfbfb] px-4 py-3 text-[13px] leading-[22px] text-[#595959]">
                  {review.originalInterviewText || "（无 — 该记录未上传或粘贴原始内容）"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 页面末尾存档按钮：与顶部「保存最终复盘」相同语义 */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={saveFinal}
            className="flex items-center gap-2 rounded-full bg-[#191775] px-8 py-3 text-[14px] font-medium text-white shadow-[inset_0_4px_16px_1px_rgba(255,255,255,0.22),0_2px_12px_0_rgba(0,0,0,0.25)] transition-colors hover:bg-[#12125c]"
          >
            {savedFlash ? <Check className="size-4" /> : <Save className="size-4" />}
            {hasFinal ? "存档（更新最终复盘）" : "存档（保存为最终复盘）"}
          </button>
          {savedFlash && (
            <span className="flex items-center gap-1.5 text-[12px] text-[#10b981]">
              <Check className="size-3.5" /> 已存档，首页「面试记录」已同步
            </span>
          )}
        </div>

        <div className="pb-8 text-center text-[12px] text-[#b0b0b0]">
          AI 复盘为初稿；「保存最终复盘」后，你的修改即为最终结果。原始记录与最终复盘永不被覆盖。
        </div>
      </div>

      {/* Regenerate confirm dialog */}
      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新生成 AI 复盘？</AlertDialogTitle>
            <AlertDialogDescription>
              重新生成将创建新的 AI 复盘初稿，不会覆盖你已经保存的最终复盘。原始面试记录永远保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              type="button"
              onClick={() => setConfirmRegen(false)}
              className="h-9 rounded-md border px-4 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:bg-[#f0f0f0]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={regenerate}
              className="flex h-9 items-center gap-1.5 rounded-md bg-[#191775] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#12125c]"
            >
              <RefreshCw className="size-3.5" /> 确认重新生成
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerating overlay */}
      <AnimatePresence>
        {regenerating && (
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
                <span className="text-[15px] font-semibold text-[#0f0f12]">正在重新生成……</span>
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
