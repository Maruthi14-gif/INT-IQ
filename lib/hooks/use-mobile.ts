import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/** For event handlers: the current answer, read on demand. */
export function isMobileNow() {
  return window.matchMedia(QUERY).matches
}

/**
 * Each component that renders differently on phones calls this itself. During hydration React
 * uses the server answer (desktop) and then re-renders, so the HTML always matches. Passing the
 * value down through context instead broke that for parts that hydrate later inside <Suspense>.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false, // server render: assume desktop
  )
}
