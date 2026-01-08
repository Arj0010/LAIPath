import { useEffect, useRef } from 'react'

/**
 * useParallax Hook
 * 
 * Adds subtle parallax motion to decorative background elements.
 * Moves elements slightly slower than scroll (translateY only).
 * Disabled on mobile and when prefers-reduced-motion is set.
 */
export function useParallax(speed = 0.3) {
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Check if mobile (disable parallax on mobile)
    const isMobile = window.innerWidth <= 768
    
    // Check for prefers-reduced-motion
    const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const prefersReducedMotion = prefersReducedMotionQuery.matches
    
    if (isMobile || prefersReducedMotion) {
      return // Disable parallax - no cleanup needed
    }

    let ticking = false
    let lastScrollY = window.scrollY

    const updateParallax = () => {
      if (!element) return

      const scrollY = window.scrollY
      
      // Calculate parallax offset (moves slower than scroll)
      // speed of 0.15 means element moves 15% of scroll distance
      // Clamp to 0-30px range for subtle movement (starts at 0, max 30px)
      const rawOffset = scrollY * speed
      const parallaxOffset = Math.max(0, Math.min(30, rawOffset))

      // Apply translateY transform (moves slower than content scrolls)
      element.style.transform = `translateY(${parallaxOffset}px)`
      
      lastScrollY = scrollY
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    
    // Initial update
    updateParallax()

    // Cleanup
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (element) {
        element.style.transform = ''
      }
    }
  }, [speed])

  return elementRef
}

