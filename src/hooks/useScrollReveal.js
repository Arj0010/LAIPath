import { useEffect, useRef, useState } from 'react'

/**
 * useScrollReveal Hook
 * 
 * Detects when an element enters the viewport and adds an 'is-visible' class.
 * Animations run once and do not re-trigger on scroll up.
 * Respects prefers-reduced-motion.
 */
export function useScrollReveal(options = {}) {
  const elementRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element || hasAnimatedRef.current) return

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      // If reduced motion is preferred, show immediately without animation
      // Use setTimeout to ensure CSS has loaded
      setTimeout(() => {
        setIsVisible(true)
        hasAnimatedRef.current = true
        // Force visibility in case CSS hasn't loaded yet
        if (element) {
          element.style.opacity = '1'
          element.style.transform = 'none'
        }
      }, 0)
      return
    }

    // IntersectionObserver options
    const observerOptions = {
      root: null, // viewport
      rootMargin: options.rootMargin || '0px 0px -50px 0px', // Trigger when element is 50px from bottom of viewport (earlier for better sequencing)
      threshold: options.threshold || 0.15, // Trigger when 15% of element is visible
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          setIsVisible(true)
          hasAnimatedRef.current = true
          // Disconnect observer once animation has triggered
          observer.disconnect()
        }
      })
    }, observerOptions)

    observer.observe(element)

    // Cleanup
    return () => {
      observer.disconnect()
    }
  }, [options.rootMargin, options.threshold])

  return { ref: elementRef, isVisible }
}

