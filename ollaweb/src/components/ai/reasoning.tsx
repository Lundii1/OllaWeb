"use client"

import { useControllableState } from "@radix-ui/react-use-controllable-state"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { createContext, memo, useContext, useEffect, useState } from "react"
import { Streamdown } from "streamdown"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { Shimmer } from "@/components/ai/shimmer"

interface ReasoningContextValue {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
  startTime: number | null
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning")
  }
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

const MS_IN_S = 1000

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    })
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: undefined,
    })

    const [startTime, setStartTime] = useState<number | null>(null)

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now())
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
        setStartTime(null)
      }
    }, [isStreaming, startTime, setDuration])

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen)
    }

    return (
      <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration, startTime }}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    )
  },
)

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number, startTime?: number | null) => ReactNode
}

const formatElapsed = (seconds: number) => {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins} minute${mins !== 1 ? 's' : ''}`
}

const LiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / MS_IN_S))
    }, MS_IN_S)
    return () => clearInterval(interval)
  }, [startTime])
  return <Shimmer duration={1}>Thinking for {formatElapsed(elapsed)}...</Shimmer>
}

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number, startTime?: number | null) => {
  if (isStreaming && startTime) {
    return <LiveTimer startTime={startTime} />
  }
  if (duration === undefined || duration === 0) {
    return <p>Thought for a few seconds</p>
  }
  return <p>Thought for {formatElapsed(duration)}</p>
}

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration, startTime } = useReasoning()

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {getThinkingMessage(isStreaming, duration, startTime)}
            <ChevronDownIcon
              className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
            />
          </>
        )}
      </CollapsibleTrigger>
    )
  },
)

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string
}

export const ReasoningContent = memo(({ className, children }: ReasoningContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-4 text-sm",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
  >
    <Streamdown>{children}</Streamdown>
  </CollapsibleContent>
))

Reasoning.displayName = "Reasoning"
ReasoningTrigger.displayName = "ReasoningTrigger"
ReasoningContent.displayName = "ReasoningContent"

/** Demo component for preview */
export default function ReasoningDemo() {
  return (
    <div className="w-full max-w-2xl p-6">
      <Reasoning defaultOpen={true} duration={12}>
        <ReasoningTrigger />
        <ReasoningContent>
          Let me think through this step by step... First, I need to consider the user's
          requirements. They want a solution that is both efficient and maintainable. Looking at the
          codebase, I can see several potential approaches: 1. **Refactor the existing module** -
          This would minimize disruption 2. **Create a new abstraction layer** - More work but
          cleaner long-term 3. **Use a library solution** - Fastest but adds a dependency After
          weighing the tradeoffs, I believe option 2 provides the best balance of maintainability
          and performance.
        </ReasoningContent>
      </Reasoning>
    </div>
  )
}
