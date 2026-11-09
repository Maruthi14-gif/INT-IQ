"use client"

import { usePathname } from "next/navigation"
import { titleForPath } from "@/components/app/nav-items"

export function TopbarTitle() {
  const pathname = usePathname()
  return <span className="text-sm font-medium">{titleForPath(pathname)}</span>
}
