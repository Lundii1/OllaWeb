"use client"

import {
  type RiveParameters,
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
} from "@rive-app/react-webgl2"
import type { FC } from "react"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type PersonaState = "idle" | "listening" | "thinking" | "speaking" | "asleep"

interface PersonaProps {
  state: PersonaState
  variant?: "halo"
  onLoad?: RiveParameters["onLoad"]
  onLoadError?: RiveParameters["onLoadError"]
  onReady?: () => void
  onPause?: RiveParameters["onPause"]
  onPlay?: RiveParameters["onPlay"]
  onStop?: RiveParameters["onStop"]
  className?: string
}

const stateMachine = "default"

const haloSource = {
  source: "https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv",
  dynamicColor: true,
  hasModel: true,
}

const getCurrentTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    if (document.documentElement.classList.contains("dark")) {
      return "dark"
    }
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
  }
  return "light"
}

const useTheme = (enabled: boolean) => {
  const [theme, setTheme] = useState<"light" | "dark">(getCurrentTheme)

  useEffect(() => {
    if (!enabled) return

    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    let mql: MediaQueryList | null = null
    if (window.matchMedia) {
      mql = window.matchMedia("(prefers-color-scheme: dark)")
      mql.addEventListener("change", () => setTheme(getCurrentTheme()))
    }
    return () => {
      observer.disconnect()
      mql?.removeEventListener("change", () => setTheme(getCurrentTheme()))
    }
  }, [enabled])

  return theme
}

interface PersonaWithModelProps {
  rive: ReturnType<typeof useRive>["rive"]
  source: typeof haloSource
  children: React.ReactNode
}

const PersonaWithModel = memo(({ rive, source, children }: PersonaWithModelProps) => {
  const theme = useTheme(source.dynamicColor)
  const viewModel = useViewModel(rive, { useDefault: true })
  const viewModelInstance = useViewModelInstance(viewModel, { rive, useDefault: true })
  const viewModelInstanceColor = useViewModelInstanceColor("color", viewModelInstance)

  useEffect(() => {
    if (!(viewModelInstanceColor && source.dynamicColor)) return
    const [r, g, b] = theme === "dark" ? [255, 255, 255] : [0, 0, 0]
    viewModelInstanceColor.setRgb(r, g, b)
  }, [viewModelInstanceColor, theme, source.dynamicColor])

  return <>{children}</>
})

PersonaWithModel.displayName = "PersonaWithModel"

export const Persona: FC<PersonaProps> = memo(
  ({
    variant = "halo",
    state = "idle",
    onLoad,
    onLoadError,
    onReady,
    onPause,
    onPlay,
    onStop,
    className,
  }) => {
    const source = haloSource

    const callbacksRef = useRef({
      onLoad,
      onLoadError,
      onReady,
      onPause,
      onPlay,
      onStop,
    })
    callbacksRef.current = { onLoad, onLoadError, onReady, onPause, onPlay, onStop }

    const stableCallbacks = useMemo(
      () => ({
        onLoad: ((loadedRive: Parameters<NonNullable<RiveParameters["onLoad"]>>[0]) =>
          callbacksRef.current.onLoad?.(loadedRive)) as RiveParameters["onLoad"],
        onLoadError: ((err: Parameters<NonNullable<RiveParameters["onLoadError"]>>[0]) =>
          callbacksRef.current.onLoadError?.(err)) as RiveParameters["onLoadError"],
        onReady: () => callbacksRef.current.onReady?.(),
        onPause: ((event: Parameters<NonNullable<RiveParameters["onPause"]>>[0]) =>
          callbacksRef.current.onPause?.(event)) as RiveParameters["onPause"],
        onPlay: ((event: Parameters<NonNullable<RiveParameters["onPlay"]>>[0]) =>
          callbacksRef.current.onPlay?.(event)) as RiveParameters["onPlay"],
        onStop: ((event: Parameters<NonNullable<RiveParameters["onStop"]>>[0]) =>
          callbacksRef.current.onStop?.(event)) as RiveParameters["onStop"],
      }),
      [],
    )

    const { rive, RiveComponent, container } = useRive(
      {
        src: source.source,
        stateMachines: stateMachine,
        autoplay: true,
        onLoad: stableCallbacks.onLoad,
        onLoadError: stableCallbacks.onLoadError,
        onRiveReady: stableCallbacks.onReady,
        onPause: stableCallbacks.onPause,
        onPlay: stableCallbacks.onPlay,
        onStop: stableCallbacks.onStop,
      },
      {
        useDevicePixelRatio: true,
        customDevicePixelRatio: 3,
        shouldResizeCanvasToContainer: true,
        useOffscreenRenderer: true,
      },
    )

    useEffect(() => {
      if (!rive) return

      const resizeAtHighDensity = () => {
        rive.resizeDrawingSurfaceToCanvas(3)
      }

      resizeAtHighDensity()

      if (!container || typeof ResizeObserver === "undefined") return
      const observer = new ResizeObserver(resizeAtHighDensity)
      observer.observe(container)

      return () => observer.disconnect()
    }, [rive, container])

    const listeningInput = useStateMachineInput(rive, stateMachine, "listening")
    const thinkingInput = useStateMachineInput(rive, stateMachine, "thinking")
    const speakingInput = useStateMachineInput(rive, stateMachine, "speaking")
    const asleepInput = useStateMachineInput(rive, stateMachine, "asleep")

    useEffect(() => {
      if (listeningInput) listeningInput.value = state === "listening"
      if (thinkingInput) thinkingInput.value = state === "thinking"
      if (speakingInput) speakingInput.value = state === "speaking"
      if (asleepInput) asleepInput.value = state === "asleep"
    }, [state, listeningInput, thinkingInput, speakingInput, asleepInput])

    return (
      <PersonaWithModel rive={rive} source={source}>
        <RiveComponent className={cn("shrink-0 [image-rendering:auto]", className)} />
      </PersonaWithModel>
    )
  },
)

Persona.displayName = "Persona"
