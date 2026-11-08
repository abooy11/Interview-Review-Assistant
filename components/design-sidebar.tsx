"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRightCircle } from "lucide-react"
import { AboutModal } from "./about-modal"
import Image from "next/image"
import Link from "next/link"
import { publicPath } from "@/lib/public-path"

// Constants for company logos
const TRUSTED_COMPANIES = [
  { name: "Euphoria", icon: "EUPH" },
  { name: "Focal Point", icon: "FOCAL" },
  { name: "45 Degrees", icon: "45°" },
  { name: "CoreOS", icon: "CORE" },
  { name: "EasyTax", icon: "TAX" },
  { name: "Epicurious", icon: "EPIC" },
]

const TESTIMONIALS = [
  {
    quote:
      "From early concepts to final delivery, 面试复盘助手 delivered thoughtful design with real impact. The result feels modern, confident, and built to scale.",
    author: "Sarah L",
    role: "Co-Founder",
  },
  {
    quote:
      "Working with 面试复盘助手 was a breeze. They took our scattered ideas and turned them into a beautiful, modern website. Couldn't be happier with the result.",
    author: "Diego A",
    role: "Founder & CEO",
  },
  {
    quote:
      "面试复盘助手 made the entire process feel effortless. They brought clarity, structure, and a strong sense of direction to our product and site.",
    author: "Alex M",
    role: "Product Lead",
  },
]

// Helper for ticker items
const TickerItem = ({ item }: { item: (typeof TRUSTED_COMPANIES)[0] }) => (
  <div className="flex items-center justify-center h-8 px-6 whitespace-nowrap text-sm font-bold tracking-tight text-neutral-400">
    {item.icon} <span className="ml-2 font-normal opacity-60 uppercase text-[10px] tracking-widest">{item.name}</span>
  </div>
)

export const DesignSidebar = () => {
  const [testimonialIndex, setTestimonialIndex] = useState(0)

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length)
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
              面试复盘助手 helps tomorrow's builders craft sharper products, smarter sites, and experiences built to lead.
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
            Trusted By World Class Companies.
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
              {[...TRUSTED_COMPANIES, ...TRUSTED_COMPANIES].map((company, idx) => (
                <TickerItem key={`${company.name}-${idx}`} item={company} />
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
                {TESTIMONIALS[testimonialIndex].quote}
              </p>
              <p className="text-[13px] leading-[16.8px] text-[#595959] font-normal tracking-[-0.2px]">
                {TESTIMONIALS[testimonialIndex].author} — {TESTIMONIALS[testimonialIndex].role}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Pagination dots */}
          <div className="flex gap-1 mt-4">
            {TESTIMONIALS.map((_, i) => (
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
