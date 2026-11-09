import { Logo } from "@/components/brand/logo"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <Logo />
        <p>Built by TEAM DARKNIGHTS · © 2026 INT-IQ</p>
      </div>
    </footer>
  )
}
