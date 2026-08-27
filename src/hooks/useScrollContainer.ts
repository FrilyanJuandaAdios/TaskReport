import * as React from 'react'

/**
 * The app scrolls inside `<main>`, not the document, so that a page can build
 * full-viewport sections without fighting the sticky header or the mobile nav.
 *
 * This context hands that element to any page that needs to read or drive the
 * scroll position — no `document.querySelector`, no global.
 */
const ScrollContainerContext = React.createContext<React.RefObject<HTMLElement> | null>(null)

export const ScrollContainerProvider = ScrollContainerContext.Provider

export function useScrollContainer(): React.RefObject<HTMLElement> | null {
  return React.useContext(ScrollContainerContext)
}

/**
 * Progress through the first `distance` pixels of scroll, clamped to 0…1.
 * Used to fade the Today hero as the plan comes into view.
 *
 * Reads are rAF-throttled and passive, so this never blocks the scroll thread.
 */
export function useScrollProgress(distance: number): number {
  const container = useScrollContainer()
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const element = container?.current
    if (!element || distance <= 0) return

    let frame = 0
    const read = () => {
      frame = 0
      const next = Math.min(1, Math.max(0, element.scrollTop / distance))
      setProgress((current) => (Math.abs(current - next) < 0.005 ? current : next))
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(read)
    }

    read()
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [container, distance])

  return progress
}

/** Smoothly scrolls the app container back to the top. */
export function useScrollToTop(): () => void {
  const container = useScrollContainer()
  return React.useCallback(() => {
    container?.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [container])
}
