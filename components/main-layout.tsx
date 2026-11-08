import type React from "react"
import { DesignSidebar } from "@/components/design-sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative min-h-screen">
      {/* Sidebar - Fixed position: Desktop 30%, Tablet 40%, Mobile: normal flow at top */}
      <aside className="w-full md:fixed md:left-0 md:top-0 md:w-[40%] md:h-screen lg:w-[30%] z-10">
        <DesignSidebar />
      </aside>

      <div
        className="hidden md:block fixed left-[40%] top-0 bottom-0 w-px lg:left-[30%]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, #d0d0d0 0, #d0d0d0 8px, transparent 8px, transparent 16px)",
          borderRadius: "4px",
        }}
      ></div>

      {/* Main Content - Offset by sidebar width on tablet/desktop */}
      <main className="w-full md:ml-[40%] md:w-[60%] lg:ml-[30%] lg:w-[70%] min-h-screen overflow-y-auto bg-[#fafafa]">
        {children}
      </main>
    </div>
  )
}
