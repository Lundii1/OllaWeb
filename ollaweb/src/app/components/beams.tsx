"use client"

import { useRef, useEffect } from "react"

interface BeamsProps {
  beamWidth?: number
  beamHeight?: number
  beamNumber?: number
  lightColor?: string
  speed?: number
  noiseIntensity?: number
  scale?: number
  rotation?: number
}

export function Beams({
  beamWidth = 3,
  beamHeight = 30,
  beamNumber = 20,
  lightColor = "#ffffff",
  speed = 2,
  noiseIntensity = 1.75,
  scale = 0.2,
  rotation = 30,
}: BeamsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let running = true

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio
        canvas.height = rect.height * window.devicePixelRatio
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
    }
    resize()
    window.addEventListener("resize", resize)

    // Simplex-like noise via a small permutation table
    const perm = new Uint8Array(512)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

    function fade(t: number) {
      return t * t * t * (t * (t * 6 - 15) + 10)
    }
    function lerp(a: number, b: number, t: number) {
      return a + t * (b - a)
    }
    function grad(hash: number, x: number, y: number) {
      const h = hash & 3
      const u = h < 2 ? x : y
      const v = h < 2 ? y : x
      return (h & 1 ? -u : u) + (h & 2 ? -v : v)
    }
    function noise2d(x: number, y: number) {
      const X = Math.floor(x) & 255
      const Y = Math.floor(y) & 255
      const xf = x - Math.floor(x)
      const yf = y - Math.floor(y)
      const u = fade(xf)
      const v = fade(yf)
      const aa = perm[perm[X] + Y]
      const ab = perm[perm[X] + Y + 1]
      const ba = perm[perm[X + 1] + Y]
      const bb = perm[perm[X + 1] + Y + 1]
      return lerp(
        lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
        lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
        v,
      )
    }

    const rad = (rotation * Math.PI) / 180
    const cosR = Math.cos(rad)
    const sinR = Math.sin(rad)

    // Pre-generate beam positions
    const beams: { offset: number; seed: number }[] = []
    for (let i = 0; i < beamNumber; i++) {
      beams.push({ offset: i / beamNumber, seed: Math.random() * 1000 })
    }

    function animate(ts: number) { if (!running || !canvas || !ctx) return; const _canvas = canvas!; const _ctx = ctx!;
      if (!running) return
      const w = canvas.width / window.devicePixelRatio
      const h = canvas.height / window.devicePixelRatio
      const t = ts * 0.001 * speed

      ctx.clearRect(0, 0, w, h)

      // Parse color to RGB
      const tempCtx = document.createElement("canvas").getContext("2d")!
      tempCtx.fillStyle = lightColor
      const parsed = tempCtx.fillStyle // normalizes to #rrggbb
      const r = parseInt(parsed.slice(1, 3), 16)
      const g = parseInt(parsed.slice(3, 5), 16)
      const b = parseInt(parsed.slice(5, 7), 16)

      ctx.save()
      // Rotate around center
      ctx.translate(w / 2, h / 2)
      ctx.rotate(rad)
      ctx.translate(-w / 2, -h / 2)

      for (const beam of beams) {
        const x = beam.offset * w
        const beamW = (beamWidth / 100) * w
        const n = noise2d(x * scale * 0.1 + beam.seed, t * 0.3)
        const n2 = noise2d(x * scale * 0.1 + beam.seed + 100, t * 0.2 + 50)
        const brightness = Math.pow((n * 0.5 + 0.5) * noiseIntensity, 2) * 0.5
        const alpha = Math.max(0, Math.min(1, brightness))

        const grad = ctx.createLinearGradient(x, 0, x, h)
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.6})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)

        ctx.fillStyle = grad
        ctx.fillRect(x - beamW / 2, 0, beamW, h)
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [beamWidth, beamHeight, beamNumber, lightColor, speed, noiseIntensity, scale, rotation])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  )
}

export default Beams

