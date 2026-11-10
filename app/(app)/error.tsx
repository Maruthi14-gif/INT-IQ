"use client"

import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Shown when a signed-in page fails to load (for example, a dropped database connection). */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-20 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border bg-muted text-warning">
        <TriangleAlertIcon className="size-5" />
      </span>
      <h1 className="mt-5 text-xl font-medium">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page didn&rsquo;t load. It&rsquo;s usually a brief connection hiccup, so trying again normally fixes it.
      </p>
      <Button onClick={() => retry()} className="mt-6 h-10 px-4">
        <RotateCwIcon />
        Try again
      </Button>
      {error.digest && <p className="mt-4 font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>}
    </div>
  )
}
