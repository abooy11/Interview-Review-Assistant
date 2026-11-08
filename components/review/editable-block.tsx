"use client"

// Reusable labelled preview/edit block used all over the AI review page.
// Preview mode: body text + optional 「编辑」/「保存修改」 action.
// Edit mode: rendered by the parent (all-edit mode) or inline (single edit).

import { useState } from "react"
import { Pencil, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type SectionBadge = "AI生成" | "已修改" | "最终版本"

export function SectionBadgeTag({ badge }: { badge: SectionBadge }) {
  const styles: Record<SectionBadge, string> = {
    AI生成: "bg-[#eef1f4] text-[#6b7280]",
    已修改: "bg-[#fdf3e3] text-[#b45309]",
    最终版本: "bg-[#e7f3ec] text-[#15803d]",
  }
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", styles[badge])}>{badge}</span>
}

interface EditableBlockProps {
  label: string
  value: string
  onChange: (v: string) => void
  badge?: SectionBadge
  /** true → always render as textarea (all-edit mode) */
  forceEdit?: boolean
  multiline?: boolean
  placeholder?: string
  className?: string
}

export function EditableBlock({
  label,
  value,
  onChange,
  badge = "AI生成",
  forceEdit = false,
  multiline = true,
  placeholder = "请输入内容…",
  className,
}: EditableBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const showEdit = forceEdit || editing

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }
  const saveEdit = () => {
    onChange(draft.trim())
    setEditing(false)
  }
  const cancelEdit = () => setEditing(false)

  const field = showEdit ? (
    multiline ? (
      <textarea
        // forceEdit（全部编辑模式）: value 直接受控于父组件内容并实时回传；
        // 否则用本地 draft，点击「保存修改」时才交给父组件。
        value={forceEdit ? value : draft}
        onChange={(e) => (forceEdit ? onChange(e.target.value) : setDraft(e.target.value))}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-[#e3e3e3] bg-white px-3 py-2 text-[14px] leading-[22px] text-[#1f1f1f] outline-none transition-colors focus:border-[#191775]"
      />
    ) : (
      <input
        value={forceEdit ? value : draft}
        onChange={(e) => (forceEdit ? onChange(e.target.value) : setDraft(e.target.value))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e3e3e3] bg-white px-3 py-2 text-[14px] leading-[22px] text-[#1f1f1f] outline-none transition-colors focus:border-[#191775]"
      />
    )
  ) : (
    <p className="whitespace-pre-wrap text-[14px] leading-[24px] text-[#3a3a3a]">{value || <span className="text-[#b0b0b0]">（空）</span>}</p>
  )

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8b8b8b]">{label}</span>
        <SectionBadgeTag badge={badge} />
        <div className="ml-auto flex items-center gap-1">
          {!forceEdit && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[#6b7280] transition-colors hover:bg-[#f0f0f0] hover:text-[#191775]"
            >
              <Pencil className="size-3" /> 编辑
            </button>
          )}
          {!forceEdit && editing && (
            <>
              <button
                type="button"
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-md bg-[#191775] px-2.5 py-1 text-[12px] text-white transition-colors hover:bg-[#12125c]"
              >
                <Check className="size-3" /> 保存修改
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[#6b7280] transition-colors hover:bg-[#f0f0f0]"
              >
                <X className="size-3" /> 取消
              </button>
            </>
          )}
        </div>
      </div>
      {field}
    </div>
  )
}
