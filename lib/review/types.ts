// Interview review data model — see spec §20.
// Three independently persisted layers (spec §5, §22):
//   originalInterviewText  — 用户上传/粘贴的原始记录，永不被 AI 覆盖
//   aiReviewDraft          — AI 生成的复盘初稿，可重新生成（只更新这一层）
//   finalReview            — 用户修改后的最终复盘，保存后永不覆盖

export const SCORE_DIMENSIONS = [
  { key: "product", label: "产品思维" },
  { key: "experience", label: "项目经验" },
  { key: "data", label: "数据分析" },
  { key: "business", label: "业务理解" },
  { key: "logic", label: "逻辑表达" },
  { key: "communication", label: "沟通表达" },
  { key: "fit", label: "岗位匹配度" },
] as const

export type ScoreKey = (typeof SCORE_DIMENSIONS)[number]["key"]
export type ScoreMap = Record<ScoreKey, number>

export interface QuestionReview {
  id: string
  question: string
  myAnswer: string
  aiEvaluation: string
  improvementSuggestion: string
  recommendedAnswer: string
}

export interface WeaknessItem {
  title: string
  detail: string
}

export interface ReviewContent {
  overallSummary: string
  scores: ScoreMap
  questionReviews: QuestionReview[]
  strengths: string[]
  weaknesses: WeaknessItem[]
  nextPreparation: string[]
  /** Section keys (and `q:<id>` for question cards) the user modified. */
  editedSections: string[]
}

// 公司类别 — 固定 7 类，用户在新建/详情中选择，系统不按公司名猜测。
// 旧数据没有该字段 → 展示时归入「未分类」（UNCATEGORIZED 仅作展示标签，不写入数据）。
export const COMPANY_CATEGORIES = [
  "互联网",
  "科技类",
  "国央企",
  "金融",
  "快消零售",
  "咨询",
  "事业编",
] as const
export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number]
export const UNCATEGORIZED = "未分类"

export type ReviewStatus = "pending" | "completed" // 待完成 / 已完成

// 面试结果 — 卡片第三行显示 (通过/未通过/待定)
export const OUTCOME_LABELS = {
  pass: "通过",
  fail: "未通过",
  pending: "待定",
} as const
export type ReviewOutcome = keyof typeof OUTCOME_LABELS

export interface InterviewReview {
  id: string
  company: string
  interviewRound: string
  position: string
  jobDescription: string
  originalInterviewText: string
  sourceFileName: string | null
  sourceFileSize: number | null
  aiReviewDraft: ReviewContent | null
  finalReview: ReviewContent | null
  overallScore: number | null
  status: ReviewStatus
  outcome: ReviewOutcome // 通过/未通过/待定 — 旧数据缺省为 pending
  /** 公司类别（互联网/科技类/…）；旧数据无此字段 → 空字符串，展示时归「未分类」 */
  companyCategory: string
  createdAt: number
  updatedAt: number
}

export const EMPTY_SCORES: ScoreMap = {
  product: 0,
  experience: 0,
  data: 0,
  business: 0,
  logic: 0,
  communication: 0,
  fit: 0,
}

export function computeOverall(scores: ScoreMap): number {
  const values = Object.values(scores)
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}
