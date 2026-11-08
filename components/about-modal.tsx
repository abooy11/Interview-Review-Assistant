"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { useMediaQuery } from "@/hooks/use-mobile"
import Image from "next/image"
import { publicPath } from "@/lib/public-path"

export const AboutModal = () => {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const AboutContent = () => (
    <div className="flex flex-col gap-6 p-8 md:p-10">
      <div className="w-12 h-12 flex items-center justify-start">
        <Image src={publicPath("/images/logo.png")} alt="面试复盘助手" width={48} height={48} className="w-auto h-12" />
      </div>

      {/* Headline */}
      <h2 className="text-[28px] md:text-[32px] leading-[36px] md:leading-[40px] font-medium text-[#0f0f12] tracking-[-0.02em] text-balance">
        一场面试，留下三层记录。
      </h2>

      <div className="flex flex-col gap-4 text-[16px] leading-[24px] text-[#0f0f12] tracking-[-0.01em]">
        <p>
          先填公司、轮次和岗位，再上传或粘贴面试记录。原始记录单独保存，生成复盘时不会被改写。
        </p>
        <p>
          AI 初稿可以重新生成。你改过并保存的那一份是终稿，之后再生成也不会覆盖它。
        </p>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto px-6 py-3.5 bg-[#595959] text-white hover:bg-[#4a4a4a] transition-all cursor-pointer"
          style={{
            borderRadius: "42px",
          }}
        >
          <span className="text-lg tracking-[-0.6px] font-medium font-display">怎么用</span>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[520px] p-0 bg-white rounded-[24px] border-0">
            <AboutContent />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto px-6 py-3.5 bg-[#595959] text-white hover:bg-[#4a4a4a] transition-all cursor-pointer"
        style={{
          borderRadius: "42px",
        }}
      >
        <span className="text-lg tracking-[-0.6px] font-medium font-display">怎么用</span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-white rounded-t-[24px] border-0">
          <AboutContent />
        </DrawerContent>
      </Drawer>
    </>
  )
}
