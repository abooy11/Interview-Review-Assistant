"use client"

import type React from "react"
import { useState } from "react"
import { Clock } from "lucide-react"
import { motion } from "framer-motion"
import { SERVICES_OPTIONS, BUDGET_OPTIONS } from "@/lib/project-data"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, ease: "easeOut" },
}

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    service: "",
    message: "",
    budget: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted:", formData)
    alert("Thank you for your message! This is a demo form.")
  }

  return (
    <motion.div className="border-t border-gray-100 pt-16" {...fadeInUp}>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-black mb-2">Contact Form</h2>
        <p className="text-sm text-[#595959]">Let us build your next showstopping project.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-normal text-black">Name</label>
            <input
              type="text"
              placeholder="Jane Smith"
              className="w-full h-10 px-4 bg-[#bbbbbb26] rounded-full border-none text-sm focus:outline-none focus:ring-1 focus:ring-black/10 transition-shadow"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-normal text-black">Email</label>
            <input
              type="email"
              placeholder="jane@company.com"
              className="w-full h-10 px-4 bg-[#bbbbbb26] rounded-full border-none text-sm focus:outline-none focus:ring-1 focus:ring-black/10 transition-shadow"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-normal text-black">Service</label>
          <div className="relative">
            <select
              className="w-full h-10 px-4 pr-10 bg-[#bbbbbb26] rounded-full border-none text-sm appearance-none focus:outline-none text-[#999999]"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              required
            >
              <option value="" disabled>
                Select...
              </option>
              {SERVICES_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="text-black">
                  {opt}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#999999"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 6L 8 10.5L 12.5 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-normal text-black">What help do you need?</label>
          <textarea
            placeholder="Describe your project..."
            className="w-full h-24 px-4 py-3 bg-[#bbbbbb26] rounded-2xl border-none text-sm resize-none focus:outline-none focus:ring-1 focus:ring-black/10 transition-shadow"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-normal text-black">What is your budget?</label>
          <div className="relative">
            <select
              className="w-full h-10 px-4 pr-10 bg-[#bbbbbb26] rounded-full border-none text-sm appearance-none focus:outline-none text-[#999999]"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              required
            >
              <option value="" disabled>
                Select...
              </option>
              {BUDGET_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="text-black">
                  {opt}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#999999"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 6L 8 10.5L 12.5 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-5 mt-8">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-[#595959]" />
            <span className="text-sm text-[#595959]">12 hours typical response</span>
          </div>
          <button
            type="submit"
            className="w-full md:w-[240px] h-10 bg-[#0f0f12] text-white rounded-full font-semibold text-sm hover:bg-[#1a1a21] transition-colors cursor-pointer"
          >
            Submit
          </button>
        </div>
      </form>
    </motion.div>
  )
}
