"use client"

import { useEffect, useState, useRef } from "react"
import type { RefObject } from "react"

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Only starts when `start` is true (pair with useInView for scroll-triggered counters).
 */
export function useCounter(target: number, duration = 1800, start = false): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

/**
 * Returns a ref to attach to an element and a boolean `inView`
 * that becomes true once the element enters the viewport.
 */
export function useInView(threshold = 0.1): {
  ref: RefObject<HTMLDivElement | null>
  inView: boolean
} {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}
