import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

const NAV = [
  { href: "#candidates", label: "For candidates" },
  { href: "#recruiters", label: "For recruiters" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="INT-IQ home" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <ThemeToggle />
          <Link href="/sign-in" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Sign in
          </Link>
          <Button asChild className="h-9 px-4">
            <Link href="/sign-in">Start practicing</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
