import { MainLayout } from "@/components/main-layout"
import { ReviewList } from "@/components/review/review-list"

// 全部面试复盘 — 主页「面试记录」超过 8 条时，点击「更多」进入。
// 复用 ReviewList：展示全部记录，不限制数量。

export default function AllReviews() {
  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto bg-[#fafafa]">
        <div className="p-6 md:p-8">
          <ReviewList title="全部面试复盘" />
        </div>
      </div>
    </MainLayout>
  )
}
