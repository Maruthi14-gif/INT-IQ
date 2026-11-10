import * as React from "react"

/*
 * Media queries that are safe during hydration: the server render assumes `false`,
 * and React re-renders with the real answer right after. Call these in the component
 * that needs them (not through context), like useIsMobile.
 */
function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** The visitor asked their device for less motion. */
export function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

/** A mouse or trackpad. Hover effects do nothing useful on touch screens. */
export function useFinePointer() {
  return useMediaQuery("(hover: hover) and (pointer: fine)")
}
