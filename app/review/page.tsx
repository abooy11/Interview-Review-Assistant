import { Suspense } from "react"
import { MainLayout } from "@/components/main-layout"
import { ReviewPage } from "@/components/review/review-page"

// Review detail uses ?id= (client-side) instead of [id] route since records
// are created at runtime — static export cannot prerender user data.

export default function Review() {
  return (
    <MainLayout>
      <Suspense fallback={null}>
        <ReviewPage />
      </Suspense>
    </MainLayout>
  )
}
