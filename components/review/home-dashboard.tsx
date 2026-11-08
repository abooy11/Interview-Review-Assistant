"use client"

// 首页「求职总览 + 行业分类面试记录」。
// 结构：类别 → 公司 → 面试轮次（同一家公司多轮聚合，不重复展示）。
// 公司数量统一按「公司名称 trim 去重」统计；分类完全以用户在新建/详情中选择的
// companyCategory 为准（不做名称猜测）；旧数据无类别 → 归「未分类」分组。

import Link from "next/link"
import { ArrowUpRight, Briefcase, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useReviews } from "@/lib/review/store"
import {
  COMPANY_CATEGORIES,
  OUTCOME_LABELS,
  UNCATEGORIZED,
} from "@/lib/review/types"

// 轮次排序：一面~九面按序号，其他（HR面/终面/自定义）排在编号轮次之后
const ROUND_ORDER: Record<string, number> = {
  一面: 1,
  二面: 2,
  三面: 3,
  四面: 4,
  五面: 5,
  六面: 6,
  七面: 7,
  八面: 8,
  九面: 9,
}

// 面试结果配色（pass 绿 / pending 橙 / fail 红）
const OUTCOME_STYLE: Record<string, string> = {
  pass: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  fail: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]",
  pending: "border-[#fed7aa] bg-[#fff7ed] text-[#b45309]",
}

/** 统计/分组用的公司键：trim 后去重；空公司归「未填写公司」（统计时不计入） */
function companyKey(r: { company: string }): string {
  return (r.company ?? "").trim() || "未填写公司"
}

/** 只有草稿（未生成 AI 复盘）的记录点击后回到新建页继续填写 */
function isDraftOnly(r: { status: string; aiReviewDraft?: unknown; finalReview?: unknown }): boolean {
  return r.status === "pending" && !r.aiReviewDraft && !r.finalReview
}

export function HomeDashboard() {
  const reviews = useReviews()

  // --- 按类别 → 公司 分组 ----------------------------------------------
  const categoryCompanies = new Map<string, Map<string, typeof reviews>>()
  for (const r of reviews) {
    const cat = (COMPANY_CATEGORIES as readonly string[]).includes(r.companyCategory)
      ? r.companyCategory
      : "" // 空/旧数据/非法值 → 未分类
    let companies = categoryCompanies.get(cat)
    if (!companies) {
      companies = new Map()
      categoryCompanies.set(cat, companies)
    }
    const key = companyKey(r)
    const recs = companies.get(key)
    if (recs) recs.push(r)
    else companies.set(key, [r])
  }

  // --- 统计（公司名称去重，空公司不计入） --------------------------------
  const totalCompanies = new Set(
    reviews.map(companyKey).filter((k) => k !== "未填写公司"),
  ).size
  const unclassifiedCount = new Set(
    [...(categoryCompanies.get("") ?? new Map()).keys()].filter((k) => k !== "未填写公司"),
  ).size

  const catOrder = (cat: string): number => {
    const idx = (COMPANY_CATEGORIES as readonly string[]).indexOf(cat)
    return idx === -1 ? 999 : idx
  }
  const categories = [...categoryCompanies.keys()].sort(
    (a, b) => catOrder(a) - catOrder(b) || a.localeCompare(b, "zh"),
  )

  const showUnclassified = categoryCompanies.has("")
  const stats = COMPANY_CATEGORIES.map((cat) => ({
    cat,
    count: new Set(
      [...(categoryCompanies.get(cat) ?? new Map()).keys()].filter((k) => k !== "未填写公司"),
    ).size,
  }))

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {/* ===== 求职总览 ===== */}
      <section className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em] text-[#0f0f12]">
          <Briefcase className="size-5 text-[#191775]" />
          求职总览
        </h2>

        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] text-[#6b7280]">已投递公司</span>
            <span className="text-[38px] font-bold leading-none tracking-[-0.03em] text-[#0f0f12]">
              {totalCompanies}
            </span>
            <span className="text-[14px] text-[#6b7280]">家</span>
          </div>

          {/* 分类统计（公司数 = 各类别下公司去重） */}
          <div className="flex flex-wrap items-center gap-2">
            {stats.map(({ cat, count }) => (
              <span
                key={cat}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px]",
                  count > 0
                    ? "border-[#e3e3e3] bg-[#fafafa] text-[#3a3a3a]"
                    : "border-[#f0f0f0] text-[#c9c9c9]",
                )}
              >
                {cat} <b className="font-semibold">{count}</b>
              </span>
            ))}
            {showUnclassified && unclassifiedCount > 0 && (
              <span className="rounded-full border border-[#e3e3e3] bg-[#fafafa] px-3 py-1 text-[12px] text-[#3a3a3a]">
                {UNCATEGORIZED} <b className="font-semibold">{unclassifiedCount}</b>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ===== 面试记录（按类别分组） ===== */}
      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0f0f12]">面试记录</h2>
          <Link
            href="/all-reviews"
            className="flex items-center gap-1.5 rounded-full border border-[#d8d8d8] px-5 py-2 text-[13px] font-medium text-[#3a3a3a] transition-colors hover:border-[#9b9b9b]"
          >
            全部面试复盘<ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d8d8] bg-white/60 px-6 py-10 text-center">
            <p className="text-[15px] font-medium text-[#3a3a3a]">还没有面试复盘记录</p>
            <p className="mt-1 text-[13px] text-[#8b8b8b]">
              点击左侧「新建面试复盘」，上传或粘贴面试记录，AI 帮你复盘
            </p>
            <Link
              href="/new-review"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#0f0f12] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#191775]"
            >
              <Building2 className="size-3.5" /> 新建面试复盘
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {categories.map((cat) => {
              const companies = categoryCompanies.get(cat)!
              const catLabel = cat || UNCATEGORIZED
              const companyList = [...companies.entries()].sort(([a], [b]) =>
                a.localeCompare(b, "zh"),
              )
              return (
                <div key={cat || UNCATEGORIZED} className="rounded-2xl border border-[#ececec] bg-white p-6 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-[#1f1f1f]">{catLabel}</h3>
                    <span className="text-[12px] text-[#b0b0b0]">{companyList.length} 家公司</span>
                  </div>

                  <div>
                    {companyList.map(([name, recs]) => {
                      // 公司内记录排序：一面~九面在前，其余按更新时间倒序
                      const sorted = [...recs].sort(
                        (a, b) =>
                          (ROUND_ORDER[a.interviewRound] ?? 99) - (ROUND_ORDER[b.interviewRound] ?? 99) ||
                          b.updatedAt - a.updatedAt,
                      )
                      // 主记录（公司名/岗位行点击目标）：有最终复盘优先，其次最新一条
                      const primary = [...recs].sort(
                        (a, b) =>
                          Number(Boolean(b.finalReview)) - Number(Boolean(a.finalReview)) ||
                          b.updatedAt - a.updatedAt,
                      )[0]
                      return (
                        <div
                          key={name}
                          className="flex flex-col gap-1.5 border-b border-[#f0f0f0] py-3 last:border-b-0"
                        >
                          {/* 第一、二行：公司 + 岗位 */}
                          <div className="flex items-center gap-2">
                            <Link
                              href={isDraftOnly(primary) ? "/new-review" : `/review?id=${primary.id}`}
                              className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#0f0f12] transition-colors hover:text-[#191775]"
                            >
                              {name}
                            </Link>
                            <span className="min-w-0 truncate text-[12px] text-[#8b8b8b]">
                              {primary.position || "未填写岗位"}
                            </span>
                          </div>

                          {/* 第三行：各轮次 → 点按进入对应复盘详情 */}
                          <div className="flex flex-wrap gap-1.5">
                            {sorted.map((r) => (
                              <Link
                                key={r.id}
                                href={isDraftOnly(r) ? "/new-review" : `/review?id=${r.id}`}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-opacity hover:opacity-80",
                                  OUTCOME_STYLE[r.outcome] ?? OUTCOME_STYLE.pending,
                                )}
                              >
                                {r.interviewRound || "面试"} · {OUTCOME_LABELS[r.outcome] ?? "待定"}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
