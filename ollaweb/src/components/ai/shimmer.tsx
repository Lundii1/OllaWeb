"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ShimmerProps {
  children?: ReactNode
  className?: string
  duration?: number
}

export function Shimmer({ children, className, duration = 2 }: ShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent",
        className,
      )}
      style={{
        "--shimmer-duration": `${duration}s`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
