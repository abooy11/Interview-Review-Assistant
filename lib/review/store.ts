"use client"

// localStorage-backed store for InterviewReview records.
// The app is a static export (no server), so all persistence is client-side.
// Records survive app restarts because localStorage persists under the
// Electron app's user-data dir.

import { useEffect, useState, useSyncExternalStore } from "react"
import type { InterviewReview } from "./types"

const KEY = "interview-reviews-v1"
const EVENT = "interview-reviews-changed"

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readAll(): InterviewReview[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 旧数据兼容：outcome（结果）与 companyCategory（类别）字段是后来新增的，
    // 缺失时分别补默认值，避免首页/详情对 undefined 字段报错或白屏。
    return parsed.map((r) => ({
      ...(typeof r.outcome === "string" ? r : { ...r, outcome: "pending" }),
      companyCategory: typeof r.companyCategory === "string" ? r.companyCategory : "",
    }))
  } catch {
    return []
  }
}

function writeAll(reviews: InterviewReview[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reviews))
    sortedCache = null // store changed — next read re-parses
    dispatchEvent(new Event(EVENT))
  } catch {
    // storage full / unavailable — ignore
  }
}

// --- CRUD ---------------------------------------------------------------

// Stable snapshot for useSyncExternalStore: getSnapshot must return the SAME
// reference between real store changes, or React infinite-re-renders (#185).
let sortedCache: InterviewReview[] | null = null
const EMPTY_REVIEWS: InterviewReview[] = []

export function listReviews(): InterviewReview[] {
  if (sortedCache !== null) return sortedCache
  sortedCache = readAll().sort((a, b) => b.updatedAt - a.updatedAt)
  return sortedCache
}

export function getReview(id: string): InterviewReview | null {
  return readAll().find((r) => r.id === id) ?? null
}

/** Insert or update a record (keeps createdAt on update). */
export function saveReview(review: InterviewReview): InterviewReview {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === review.id)
  const merged: InterviewReview = {
    ...review,
    createdAt: idx === -1 ? review.createdAt : all[idx].createdAt,
    updatedAt: Date.now(),
  }
  if (idx === -1) all.push(merged)
  else all[idx] = merged
  writeAll(all)
  return merged
}

export function deleteReview(id: string) {
  writeAll(readAll().filter((r) => r.id !== id))
}

/** Newest unfinished draft (pending + no AI draft) for resuming the form. */
export function findPendingDraft(): InterviewReview | null {
  const all = readAll().filter((r) => r.status === "pending" && !r.aiReviewDraft && !r.finalReview)
  if (all.length === 0) return null
  return all.sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

/** Create a new pending record from form fields (drafts use the same shape). */
export function createDraft(partial: Partial<InterviewReview>): InterviewReview {
  const now = Date.now()
  const draft: InterviewReview = {
    id: newId(),
    company: "",
    interviewRound: "",
    position: "",
    jobDescription: "",
    originalInterviewText: "",
    sourceFileName: null,
    sourceFileSize: null,
    aiReviewDraft: null,
    finalReview: null,
    overallScore: null,
    status: "pending",
    outcome: "pending",
    companyCategory: "",
    createdAt: now,
    updatedAt: now,
  }
  return {
    ...draft,
    ...partial,
    // partial.id 若为 null/undefined（表单尚未入过库），不能被 spread 覆盖成
    // undefined 写进 localStorage（JSON.stringify 会丢掉该键 → 记录无 id → 复盘跳转 ?id=undefined）
    id: partial.id || draft.id,
  }
}

// --- React hooks --------------------------------------------------------

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

/** Live-sorted list of all reviews (updates on any change). */
export function useReviews(): InterviewReview[] {
  const reviews = useSyncExternalStore(subscribe, listReviews, () => EMPTY_REVIEWS)
  return reviews
}

/** Single record by id, or null while loading / when missing. */
export function useReview(id: string | null): InterviewReview | null {
  const [review, setReview] = useState<InterviewReview | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoaded(false)
    const onChange = () => {
      setReview(getReview(id))
      setLoaded(true)
    }
    // initial read + subscribe to subsequent saves
    queueMicrotask(onChange)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [id])

  return review
}

export function useLoaded(): boolean {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (typeof window !== "undefined") setLoaded(true)
  }, [])
  return loaded
}
