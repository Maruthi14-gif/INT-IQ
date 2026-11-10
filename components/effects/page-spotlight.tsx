import { Spotlight } from "@/components/effects/spotlight"

/**
 * Warm light falling on a page header. Put it first inside a `relative` page wrapper;
 * it reaches out to the content padding and fades out below the header and at the sides,
 * so narrow pages don't show its edges.
 */
export function PageSpotlight() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-4 -top-4 h-[520px] [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,black_55%,transparent),linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] sm:-inset-x-6 sm:-top-6 lg:-inset-x-8 lg:-top-8"
    >
      <Spotlight />
    </div>
  )
}
