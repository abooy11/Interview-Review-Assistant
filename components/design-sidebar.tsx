"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRightCircle } from "lucide-react"
import { AboutModal } from "./about-modal"
import Image from "next/image"
import Link from "next/link"
import { publicPath } from "@/lib/public-path"

const REVIEW_MARKS = [
  { name: "原始记录", icon: "01" },
  { name: "AI 初稿", icon: "02" },
  { name: "最终复盘", icon: "03" },
  { name: "关键问题", icon: "04" },
  { name: "面试评分", icon: "05" },
  { name: "下次准备", icon: "06" },
]

const NOTES = [
  {
    quote: "原始记录单独保存。重新生成只换初稿，不会改掉已经存好的终稿。",
    author: "原始记录",
    role: "不会被覆盖",
  },
  {
    quote: "同一家公司的多轮面试归在一起，首页按行业看投递和结果。",
    author: "求职总览",
    role: "按公司去重",
  },
  {
    quote: "总评、关键问题和下一次要准备的内容都能改，改完再存成终稿。",
    author: "最终复盘",
    role: "以你改过的为准",
  },
]

// Helper for ticker items
const TickerItem = ({ item }: { item: (typeof REVIEW_MARKS)[0] }) => (
  <div className="flex items-center justify-center h-8 px-6 whitespace-nowrap text-sm font-bold tracking-tight text-neutral-400">
    {item.icon} <span className="ml-2 font-normal opacity-60 uppercase text-[10px] tracking-widest">{item.name}</span>
  </div>
)

export const DesignSidebar = () => {
  const [testimonialIndex, setTestimonialIndex] = useState(0)

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % NOTES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <nav className="flex flex-col justify-between w-full h-full bg-[#f5f5f5] p-9 pr-12 overflow-hidden font-sans select-none">
      {/* Top Content */}
      <div className="flex flex-col gap-6 w-full">
        <div className="w-10 h-10 flex items-center justify-start cursor-pointer hover:scale-105 transition-transform">
          <Image
            src={publicPath("/images/logo.png")}
            alt="面试复盘助手"
            width={40}
            height={40}
            className="w-auto h-10"
          />
        </div>

        {/* Text + Button Section */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-[38px] leading-[44px] text-[#0f0f12] text-balance font-semibold tracking-[-0.04em]">
              面试复盘助手
            </h1>
            <p className="text-[16px] leading-[22.4px] text-[#0f0f12] opacity-80 font-normal tracking-[-0.4px] text-balance">
              把一场面试收成能留下的复盘。原始记录、初稿和终稿分开保存。
            </p>
          </div>

          <div className="flex flex-col xl:flex-row items-start gap-3">
            <Link
              href="/new-review"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0f0f12] text-white shadow-[inset_0_4px_16px_1px_rgba(255,255,255,0.22),0_2px_12px_0_rgba(0,0,0,0.25)] hover:bg-[#191775] transition-all cursor-pointer group"
              style={{
                borderRadius: "42px",
              }}
            >
              <span className="text-lg tracking-[-0.6px] font-medium font-display whitespace-nowrap">
                新建面试复盘
              </span>
              <ArrowRightCircle size={20} className="transition-transform duration-300 group-hover:-rotate-45" />
            </Link>
            <AboutModal />
          </div>
        </div>
      </div>

      {/* Bottom Content */}
      <div className="flex flex-col gap-10 w-full mt-auto pt-10">
        {/* Ticker Section */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[24px] leading-[28.8px] font-normal text-[#0f0f12] tracking-[-0.01em]">
            一份复盘里有这些
          </h3>

          <div className="relative h-8 w-full overflow-hidden mt-2">
            <motion.div
              className="flex absolute left-0 top-0 h-full"
              animate={{ x: ["0%", "-50%"] }}
              transition={{
                duration: 20,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              }}
            >
              {[...REVIEW_MARKS, ...REVIEW_MARKS].map((mark, idx) => (
                <TickerItem key={`${mark.name}-${idx}`} item={mark} />
              ))}
            </motion.div>
            {/* Gradient Fades for Ticker */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#f5f5f5] to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#f5f5f5] to-transparent z-10" />
          </div>
        </div>

        {/* Testimonial Section */}
        <div className="h-28 w-full max-w-[288px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={testimonialIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="flex flex-col gap-2"
            >
              <p className="text-[13px] leading-[16.8px] text-black font-normal tracking-[-0.2px] text-balance italic">
                {NOTES[testimonialIndex].quote}
              </p>
              <p className="text-[13px] leading-[16.8px] text-[#595959] font-normal tracking-[-0.2px]">
                {NOTES[testimonialIndex].author} — {NOTES[testimonialIndex].role}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Pagination dots */}
          <div className="flex gap-1 mt-4">
            {NOTES.map((_, i) => (
              <button
                key={i}
                onClick={() => setTestimonialIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === testimonialIndex ? "bg-black w-3" : "bg-neutral-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
