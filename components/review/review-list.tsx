"use client"

// 首页「我的面试复盘」列表 — cards: 公司｜岗位｜轮次 + 综合评分 + 状态。
// 点卡片进入复盘详情（AI结果页或继续填写草稿）。

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Trash2, X } from "lucide-react"
import { deleteReview, useReviews } from "@/lib/review/store"
import { format } from "date-fns"

export function ReviewList({ title = "我的面试复盘" }: { title?: string }) {
  const reviews = useReviews()
  const router = useRouter()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const target = reviews.find((r) => r.id === confirmDeleteId) ?? null

  const open = (id: string, isDraftOnly: boolean) => {
    router.push(isDraftOnly ? "/new-review" : `/review?id=${id}`)
  }

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0f0f12]">{title}</h2>
          {reviews.length > 0 && (
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#6b7280] shadow-sm">
              {reviews.length} 条记录
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push("/new-review")}
          className="flex items-center gap-1.5 rounded-full bg-[#0f0f12] px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#191775]"
        >
          <Plus className="size-3.5" /> 新建面试复盘
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8d8d8] bg-white/60 px-6 py-10 text-center">
          <p className="text-[15px] font-medium text-[#3a3a3a]">还没有面试复盘记录</p>
          <p className="mt-1 text-[13px] text-[#8b8b8b]">
            点击右上角「新建面试复盘」，上传或粘贴面试记录，AI 帮你复盘
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => {
            const draftOnly = review.status === "pending" && !review.aiReviewDraft
            const score = review.finalReview
              ? computeOverallSafe(review.finalReview.scores)
              : review.overallScore
            return (
              <button
                key={review.id}
                type="button"
                onClick={() => open(review.id, draftOnly)}
                className="group relative block rounded-2xl border border-[#ececec] bg-white p-5 text-left shadow-sm transition-all hover:border-[#c9c9c9] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#0f0f12]">
                      {review.company || "（未填写公司）"}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-[#6b7280]">
                      {[review.position, review.interviewRound].filter(Boolean).join("｜") || "未填写岗位 / 轮次"}
                    </p>
                  </div>
                  {score != null ? (
                    <span className="flex shrink-0 items-baseline gap-0.5">
                      <span className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[#191775]">{score}</span>
                      <span className="text-[11px] text-[#b0b0b0]">分</span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-[20px] font-bold leading-none text-[#d0d0d0]">—</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={
                      review.status === "completed"
                        ? "rounded-full bg-[#e7f3ec] px-2 py-0.5 text-[11px] font-medium text-[#15803d]"
                        : "rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[11px] font-medium text-[#b45309]"
                    }
                  >
                    {review.status === "completed" ? "已完成复盘" : review.aiReviewDraft ? "待完成" : "草稿"}
                  </span>
                  <span className="text-[11px] text-[#b0b0b0]">
                    {format(new Date(review.updatedAt), "M月d日 HH:mm")}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteId(review.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation()
                        setConfirmDeleteId(review.id)
                      }
                    }}
                    className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[#c9c9c9] opacity-0 transition-all hover:bg-[#fee2e2] hover:text-[#dc2626] group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* delete confirm */}
      <AlertDialog open={Boolean(target)} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条面试复盘？</AlertDialogTitle>
            <AlertDialogDescription>
              {target
                ? `将删除「${target.company || "未命名"} · ${target.position || "未填岗位"}」的记录，包括原始面试记录和最终复盘，操作不可撤销。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="h-9 rounded-md border px-4 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:bg-[#f0f0f0]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmDeleteId) deleteReview(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
              className="h-9 flex items-center gap-1.5 rounded-md bg-[#dc2626] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#b91c1c]"
            >
              <X className="size-3.5" /> 确认删除
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** overallScore on the record may lag after edits; recompute from stored scores map. */
function computeOverallSafe(scores: Record<string, number> | null | undefined): number {
  const values = Object.values(scores ?? {})
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}
