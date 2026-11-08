import { MainLayout } from "@/components/main-layout"
import { HomeDashboard } from "@/components/review/home-dashboard"

// 首页：求职总览（已投递公司去重统计 + 分类统计）+ 按行业分类的面试记录。
// 原有图片入口（8 个面试卡位 + Nexus/Aurora/Forge 项目卡）已移除。

export default function Home() {
  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto bg-[#fafafa]">
        <div className="p-6 md:p-8">
          <HomeDashboard />
        </div>
      </div>
    </MainLayout>
  )
}
