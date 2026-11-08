// AI review generation — real DeepSeek API (OpenAI-compatible), called from the
// client. The app is a static export, so there is no server to hide a key
// behind: the key ships inside the bundle (explicit project decision).
// The mock generator below is kept as an offline/demo path and as the safety net
// used by addMissingQuestionReviews() when the model returns no question cards.

import {
  SCORE_DIMENSIONS,
  EMPTY_SCORES,
  computeOverall,
  type QuestionReview,
  type ReviewContent,
  type ScoreMap,
  type WeaknessItem,
} from "./types"

export const AI_STEPS = [
  "正在整理面试内容",
  "正在识别关键问题",
  "正在分析你的回答",
  "正在结合岗位要求进行复盘",
  "正在生成复盘结果",
] as const

export type AiStep = (typeof AI_STEPS)[number]

export interface AiInput {
  company: string
  interviewRound: string
  position: string
  jobDescription: string
  originalInterviewText: string
}

// --- DeepSeek API config --------------------------------------------------

const AI_BASE_URL = "https://api.deepseek.com"
const AI_API_KEY = "sk-797123cfa20a4b7a850f4b56792adebd"
const AI_MODEL = "deepseek-flash"
// The review JSON (up to ~10 question cards, each with a long evaluation) is
// large. Too small a budget truncates it mid-string and the JSON stops parsing,
// so the budget is generous and a "length" finish is treated as an error.
const AI_MAX_TOKENS = 8192
const AI_TIMEOUT_MS = 150000

const SYSTEM_PROMPT =
  "你是一位资深的产品/求职面试教练。你只输出 JSON，不输出 markdown 代码块、解释或任何其他文字。"

export function isRealAiConfigured(): boolean {
  return Boolean(AI_API_KEY && AI_MODEL)
}

/** Turn a thrown API/transport error into something the user can act on. */
export function describeAiError(err: unknown): string {
  const status = (err as { status?: number } | null)?.status
  if (status === 401 || status === 403) return "API Key 无效或没有权限，请检查配置。"
  if (status === 402) return "DeepSeek 账户余额不足，请充值后重试。"
  if (status === 429) return "请求过于频繁，请稍等片刻再试。"
  if (typeof status === "number" && status >= 500) return "DeepSeek 服务暂时不可用，请稍后重试。"
  const msg = err instanceof Error ? err.message : String(err)
  if (/abort/i.test(msg)) return "请求超时，请检查网络后重试。"
  if (/failed to fetch|networkerror|enotfound|econnrefused/i.test(msg))
    return "网络连接失败，请检查网络后重试。"
  if (/截断/.test(msg)) return "面试记录过长导致输出被截断，请精简后重试。"
  if (/空内容/.test(msg)) return "AI 本次没有返回内容，请重试。"
  return "AI 复盘生成失败，请稍后重试。"
}

// --- Public entrypoint ----------------------------------------------------

export async function runAiReview(
  input: AiInput,
  onProgress: (step: number) => void,
): Promise<ReviewContent> {
  // No silent mock fallback: when the model call fails the page must say so,
  // rather than hand the user a fabricated review that looks model-generated.
  return callRealApi(input, onProgress)
}

// --- Real API (Anthropic-compatible /v1/messages) -------------------------

function buildPrompt(input: AiInput): string {
  const dims = SCORE_DIMENSIONS.map(({ key, label }) => `${key} = ${label}`).join(", ")
  return `你是一位资深的产品/求职面试教练。请基于下面的面试记录，为求职者生成一份「面试复盘初稿」。

【输入信息】
- 公司：${input.company}
- 面试轮次：${input.interviewRound}
- 岗位：${input.position}
- 岗位JD：${input.jobDescription ? input.jobDescription : "（未提供）"}

【面试记录】
${input.originalInterviewText || "（未提供）"}

【要求】
1. aiEvaluation 必须逐条给出：优点 / 存在的问题 / 面试官可能关注什么 / 为什么不够好。
2. improvementSuggestion 给出下次怎么回答的具体可执行建议。
3. recommendedAnswer 生成一个更优秀的回答版本，契合「${input.position}」岗位要求。
4. 从面试记录中提取最重要的 5-10 个问题（questionReviews），问题数 = 提取出的问题数；
   每个问题卡的 myAnswer 必须是从面试记录原文摘录的求职者原话，不得改写。
5. 评分理由：结合岗位JD判断回答是否证明能力；如果回答提到具体数据、结果则相应维度分数更高。
6. 全部使用中文；不要输出"AI"之类自称。
7. 只输出 JSON，不要输出 markdown 代码块或其他文字。

【JSON 结构】
{
  "overallSummary": "一段简短文字，总结本次面试整体表现",
  "scores": { ${dims} 的每个 key 为 0-100 整数 },
  "questionReviews": [
    {
      "id": "q1",
      "question": "面试官提问（含问句原文）",
      "myAnswer": "用户原始回答摘录",
      "aiEvaluation": "优点/问题/面试官关注点/为什么不够好",
      "improvementSuggestion": "下次应如何回答",
      "recommendedAnswer": "更优秀的回答版本"
    }
  ],
  "strengths": ["做得好的一点1", "一点2", "一点3"],
  "weaknesses": [{ "title": "简短标题", "detail": "详细说明" }],
  "nextPreparation": ["下次面试准备1", "准备2"],
  "editedSections": []
}`
}

// Advance the loading UI while the request is in flight, then land on the final
// step only when a result actually arrives (an error stops the ticker instead).
function startProgress(onProgress: (step: number) => void) {
  let step = 0
  onProgress(0)
  const timer = setInterval(() => {
    step = Math.min(step + 1, AI_STEPS.length - 2)
    onProgress(step)
  }, 2600)
  return {
    finish: () => {
      clearInterval(timer)
      onProgress(AI_STEPS.length - 1)
    },
    cancel: () => clearInterval(timer),
  }
}

interface ChatChoice {
  message?: { content?: string | null }
  finish_reason?: string
}

async function requestCompletion(input: AiInput): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${AI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(input) },
        ],
        max_tokens: AI_MAX_TOKENS,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      const err = new Error(`AI API ${res.status}: ${detail.slice(0, 300)}`) as Error & {
        status?: number
      }
      err.status = res.status
      throw err
    }

    const body = (await res.json()) as { choices?: ChatChoice[] }
    const choice = body.choices?.[0]
    if (choice?.finish_reason === "length") {
      throw new Error(`AI 输出被 max_tokens(${AI_MAX_TOKENS}) 截断，JSON 不完整`)
    }
    const text = choice?.message?.content ?? ""
    if (!text.trim()) throw new Error("AI 返回了空内容")
    return text
  } finally {
    clearTimeout(timeout)
  }
}

async function callRealApi(
  input: AiInput,
  onProgress: (step: number) => void,
): Promise<ReviewContent> {
  const progress = startProgress(onProgress)
  try {
    let text: string
    try {
      text = await requestCompletion(input)
    } catch (err) {
      // One retry for transient failures (network, 429, 5xx). A 4xx such as an
      // invalid key or a bad request is surfaced immediately.
      const status = (err as { status?: number }).status
      const retryable = status === undefined || status === 429 || status >= 500
      if (!retryable) throw err
      console.warn("[ai] 请求失败，重试一次：", err)
      await sleep(1200)
      text = await requestCompletion(input)
    }
    const parsed = parseJsonFromText(text)
    const content = validateReviewContent(normalizeReviewContent(parsed, input))
    progress.finish()
    return content
  } finally {
    progress.cancel()
  }
}

// --- Mock generator -------------------------------------------------------

export interface QAPair {
  question: string
  myAnswer: string
}

/** Extract 面试官/我 Q&A pairs from free-form transcript text. */
export function parseQAPairs(text: string): QAPair[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const pairs: QAPair[] = []
  let current: QAPair | null = null

  const questionRe =
    /^(?:面试官|面试员|HR|面试|Q|问|提问|Interviewer)\s*[:：]\s*(.+)$/
  const answerRe = /^(?:我|候选人|面试者|A|答|回答|Candidate)\s*[:：]\s*(.+)$/

  const flush = () => {
    if (current && current.question && current.myAnswer) pairs.push(current)
    current = null
  }

  for (const line of lines) {
    if (!line) continue
    const q = line.match(questionRe)
    if (q) {
      flush()
      current = { question: q[1], myAnswer: "" }
      continue
    }
    const a = line.match(answerRe)
    if (a) {
      if (current) current.myAnswer = a[1]
      else current = { question: "", myAnswer: a[1] }
      continue
    }
    // Continuation of the current speaker's paragraph
    if (current) current.myAnswer += (current.myAnswer ? "\n" : "") + line
  }
  flush()

  // Fallback: no structured markers — pair up non-empty paragraphs.
  if (pairs.length === 0) {
    const chunks = text.split(/\r?\n\s*\r?\n/).map((c) => c.trim()).filter(Boolean)
    for (let i = 0; i < chunks.length; i += 2) {
      const q = chunks[i]
      if (!q) continue
      const pair: QAPair = { question: q, myAnswer: chunks[i + 1] ?? "" }
      pairs.push(pair)
    }
  }
  // Last-resort fallback: whole text as a single answer
  if (pairs.length === 0 && text.trim()) {
    pairs.push({ question: "面试问题", myAnswer: text.trim() })
  }
  return pairs
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

interface MockCtx {
  hasData: boolean
  hasUsers: boolean
  hasBusiness: boolean
  hasStructure: boolean
  hasProjectExperience: boolean
  hasJdKeyword: boolean
  answerLength: number
  pairCount: number
}

function analyze(input: AiInput): MockCtx {
  const text = input.originalInterviewText
  const pairs = parseQAPairs(text)
  const answers = pairs.map((p) => p.myAnswer).join("\n")
  const jd = input.jobDescription
  const jdLoop = Boolean(jd && jd.trim().length > 0)

  const has = (re: RegExp, s: string) => re.test(s)

  return {
    hasData: has(/数据|增长|转化|指标|GMV|ROI|DAU|留存|漏斗|result|metric/gi, text + jd),
    hasUsers: has(/用户|需求|场景|痛点|体验|调研/gi, text + jd),
    hasBusiness: has(/商业|营收|收入|付费|变现|成本|盈利|商业化/gi, text + jd),
    hasStructure: has(/首先|其次|最后|第一|第二|总结|我认为|一方面|另一方面/gi, answers),
    hasProjectExperience: has(/项目|负责|主导|核心|上线|推动|落地|案例|迭代/gi, answers),
    hasJdKeyword: jdLoop && text.length > 0,
    answerLength: answers.length,
    pairCount: pairs.length,
  }
}

function clampScore(n: number): number {
  return Math.max(42, Math.min(95, Math.round(n)))
}

function mockScores(ctx: MockCtx): ScoreMap {
  const base = 68 + Math.min(6, Math.floor(ctx.answerLength / 400))
  const s = (x: number, y: number, z: number) => clampScore(base + x * 8 + y * 6 + z * 4)

  return {
    product: s(ctx.hasUsers ? 1 : 0, ctx.hasBusiness ? 0.5 : 0, 1),
    experience: s(ctx.hasProjectExperience ? 1 : 0, 0, ctx.pairCount > 3 ? 1 : 0),
    data: s(ctx.hasData ? 1 : 0, ctx.hasBusiness ? 0.5 : 0, -1),
    business: s(ctx.hasBusiness ? 1 : 0, 0, -1),
    logic: s(ctx.hasStructure ? 1 : 0, 0, 0),
    communication: s(ctx.answerLength > 800 ? 1 : 0.5, 0, 0),
    fit: s(ctx.hasJdKeyword ? 1 : 0, ctx.hasData ? 0.5 : 0, 0),
  }
}

function mockEvaluation(q: string, answer: string, ctx: MockCtx): string {
  // 原始记录中没有对应回答时，不编造分析（spec §十四）
  if (!answer || !answer.trim()) return "从当前面试记录中无法判断。"
  const points: string[] = []
  points.push(
    ctx.answerLength > 400 && answer.length > 80
      ? `回答有具体内容支撑，结合「${q.slice(0, 18)}${q.length > 18 ? "…" : ""}」展现了实际经历`
      : "回答较为简短，个人经历展示不足",
  )
  if (ctx.hasData) points.push("提到数据指标，面试官可以据此判断结果导向意识")
  else points.push("缺少量化数据支撑，面试官难以评估真实产出")
  if (ctx.hasJdKeyword) points.push("岗位JD强调的能力要求在当前回答中覆盖有限")
  else points.push("未主动对齐岗位JD中的能力要求")
  return points.join("。") + "。"
}

function mockImprovement(q: string, ctx: MockCtx): string {
  const bullets: string[] = []
  bullets.push("先用一句话给出结论（做了什么+结果），再展开细节")
  if (!ctx.hasData) bullets.push("补充 1-2 个可量化的结果（如提升了 XX%，覆盖 XX 用户）")
  if (ctx.hasJdKeyword) bullets.push("对齐JD中的能力要求，说明自己与岗位的匹配点")
  bullets.push(`回答最后回到对本岗位的理解：「${q.slice(0, 14)}…」背后的能力按 3 个维度讲`)
  return bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")
}

function mockRecommendedAnswer(q: string, ctx: MockCtx): string {
  const kw = ctx.hasJdKeyword ? "（我理解这个岗位强调落地与结果）" : ""
  return `这个问题我应该这样回答：${kw}先说结论——我在类似场景下做过「我把项目目标拆成 X 个阶段，最终转化率提升了 X%」；接着说过程——我当时怎么定义问题、做了什么决策、踩了什么坑；最后说结果——业务/用户层面发生了什么变化，以及我沉淀的方法，以及它如何在「${q.slice(0, 12)}…」这个问题上复用。${ctx.hasData ? "我会主动带上数据，避免只讲感受。" : "下次我会补上量化指标，让回答更有说服力。"}`
}

function mockWeaknesses(ctx: MockCtx): WeaknessItem[] {
  const items: WeaknessItem[] = []
  if (!ctx.hasData) {
    items.push({
      title: "数据支撑不足",
      detail: "多个回答只描述了做法，没有说明具体结果。面试官对产出ROI的信任度会被削弱。",
    })
  }
  if (!ctx.hasStructure) {
    items.push({
      title: "回答结构不够稳定",
      detail: "部分问题存在想到哪说到哪的情况，缺少「结论-过程-结果」的稳定框架。",
    })
  }
  if (!ctx.hasBusiness) {
    items.push({
      title: "商业化理解不足",
      detail: "面对商业化相关问题，更多关注用户体验，没有充分考虑收入和业务目标。",
    })
  }
  if (items.length === 0) {
    items.push({
      title: "高端问题准备不足",
      detail: "对战略性/开放性问题回答较浅，需要更多站在业务全局思考。",
    })
  }
  return items.slice(0, 3)
}

function mockStrengths(ctx: MockCtx): string[] {
  const s: string[] = []
  if (ctx.hasProjectExperience) s.push("项目经历比较丰富，能够结合真实项目回答问题")
  if (ctx.hasUsers) s.push("对用户需求分析比较具体，有用户视角")
  if (ctx.hasData) s.push("能主动引用数据说明问题，具备数据意识")
  if (ctx.answerLength > 800) s.push("表达比较自然，能够展开说明细节")
  if (s.length === 0) s.push("表达自然坦诚，对不熟悉的问题不回避")
  if (ctx.hasJdKeyword) s.push("了解岗位能力要求，有初步对齐意识")
  return s.slice(0, 5)
}

function mockNextPreparation(ctx: MockCtx): string[] {
  const tips: string[] = []
  if (!ctx.hasData) tips.push("准备 3 个带量化结果的项目案例")
  if (ctx.hasBusiness) tips.push("梳理商业化指标与体验之间的权衡框架")
  else tips.push("准备商业化产品相关问题（收入、成本、转化）")
  if (ctx.hasJdKeyword) tips.push("围绕JD能力要求准备 2 个故事")
  tips.push("为自我介绍准备 60 秒版本和 3 分钟版本")
  tips.push("准备 3 个失败案例及反思")
  return tips.slice(0, 5)
}

function mockReviewContent(input: AiInput): ReviewContent {
  const ctx = analyze(input)
  const pairs = parseQAPairs(input.originalInterviewText)
  const scores = mockScores(ctx)

  // Pick up to 8 most important questions (early ones weighted higher).
  const ranked = pairs
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => {
      const score = (p: { myAnswer: string; i: number }) => p.myAnswer.length + (p.i < 3 ? 2000 : 0)
      return score(b) - score(a)
    })
    .slice(0, 8)
    .sort((a, b) => a.i - b.i)

  const questionReviews: QuestionReview[] = ranked.map((p, idx) => ({
    id: `q${idx + 1}`,
    question: p.question || `第 ${idx + 1} 个问题`,
    myAnswer: p.myAnswer,
    aiEvaluation: mockEvaluation(p.question, p.myAnswer, ctx),
    improvementSuggestion: mockImprovement(p.question, ctx),
    recommendedAnswer: mockRecommendedAnswer(p.question, ctx),
  }))

  const overall = computeOverall(scores)
  return {
    overallSummary: `本次面试整体表现${
      overall >= 78 ? "较好" : overall >= 66 ? "中规中矩" : "一般"
    }，项目经历${ctx.hasProjectExperience ? "与岗位匹配度较高" : "还有提升空间"}；${
      !ctx.hasData ? "数据分析和" : ""
    }商业化问题上的回答较为笼统，部分问题缺少具体数据支撑。`,
    scores,
    questionReviews,
    strengths: mockStrengths(ctx),
    weaknesses: mockWeaknesses(ctx),
    nextPreparation: mockNextPreparation(ctx),
    editedSections: [],
  }
}

export async function mockGenerateReview(
  input: AiInput,
  onProgress: (step: number) => void,
): Promise<ReviewContent> {
  // Simulated pacing so the loading UI feels like analysis steps (spec §6).
  for (let step = 0; step < AI_STEPS.length; step++) {
    onProgress(step)
    await sleep(500 + step * 260)
  }
  return mockReviewContent(input)
}

// --- Normalization / validation ------------------------------------------

function addMissingQuestionReviews(content: ReviewContent, input: AiInput): ReviewContent {
  if (content.questionReviews.length > 0) return content
  const qa = parseQAPairs(input.originalInterviewText)
  const ctx = analyze(input)
  const fallback: QuestionReview[] = qa.slice(0, 5).map((p, idx) => ({
    id: `q${idx + 1}`,
    question: p.question || "关键问题",
    myAnswer: p.myAnswer,
    aiEvaluation: mockEvaluation(p.question, p.myAnswer, ctx),
    improvementSuggestion: mockImprovement(p.question, ctx),
    recommendedAnswer: mockRecommendedAnswer(p.question, ctx),
  }))
  return fallback.length
    ? { ...content, questionReviews: fallback }
    : {
        ...content,
        questionReviews: [
          {
            id: "q1",
            question: "请先介绍一下你自己",
            myAnswer: input.originalInterviewText,
            aiEvaluation: mockEvaluation("自我介绍", input.originalInterviewText, ctx),
            improvementSuggestion: mockImprovement("自我介绍", ctx),
            recommendedAnswer: mockRecommendedAnswer("自我介绍", ctx),
          },
        ],
      }
}

function normalizeReviewContent(parsed: Record<string, unknown>, input: AiInput): ReviewContent {
  const scoresRaw = (parsed.scores ?? {}) as Record<string, unknown>
  const scores = SCORE_DIMENSIONS.reduce<ScoreMap>((acc, { key }) => {
    const v = Number(scoresRaw[key])
    acc[key] = clampScore(Number.isFinite(v) ? v : 70)
    return acc
  }, { ...EMPTY_SCORES })

  const content: ReviewContent = {
    overallSummary: String(parsed.overallSummary ?? "本次面试表现见下方分项。"),
    scores,
    questionReviews: Array.isArray(parsed.questionReviews)
      ? parsed.questionReviews.map((q, i) => ({
          id: String((q as Record<string, unknown>).id ?? `q${i + 1}`),
          question: String((q as Record<string, unknown>).question ?? ""),
          myAnswer: String((q as Record<string, unknown>).myAnswer ?? ""),
          aiEvaluation: String((q as Record<string, unknown>).aiEvaluation ?? ""),
          improvementSuggestion: String((q as Record<string, unknown>).improvementSuggestion ?? ""),
          recommendedAnswer: String((q as Record<string, unknown>).recommendedAnswer ?? ""),
        }))
      : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses.map((w) => ({
          title: String((w as Record<string, unknown>).title ?? "注意点"),
          detail: String((w as Record<string, unknown>).detail ?? ""),
        }))
      : [],
    nextPreparation: Array.isArray(parsed.nextPreparation) ? parsed.nextPreparation.map(String) : [],
    editedSections: [],
  }
  return addMissingQuestionReviews(content, input)
}

function validateReviewContent(content: ReviewContent): ReviewContent {
  if (content.strengths.length === 0) content.strengths = ["表达能力较好"]
  if (content.weaknesses.length === 0)
    content.weaknesses = [{ title: "提升空间", detail: "补充更多可量化的项目结果。" }]
  if (content.nextPreparation.length === 0)
    content.nextPreparation = ["准备 3 个带结果的项目案例"]
  return content
}

function parseJsonFromText(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("AI 返回内容中未找到 JSON")
  const obj = JSON.parse(body.slice(start, end + 1))
  if (typeof obj !== "object" || obj === null) throw new Error("AI 返回非对象 JSON")
  return obj as Record<string, unknown>
}
