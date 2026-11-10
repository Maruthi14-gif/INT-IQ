import "server-only"
import dns from "node:dns/promises"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import type { CompanyCheck } from "@/lib/db/schema"

/*
 * Checks that a company really exists on the open internet, using free sources only:
 * DNS, the company's own website, RDAP (domain registry), Wikidata (public records) and,
 * when GSTIN_API_KEY is set, gstinapi.in for Indian GST numbers. Every source has a short
 * timeout; a source that fails counts as "unknown", never as proof either way.
 */

const UA = "INT-IQ/1.0 (+https://int-iq.vercel.app; company verification)"
const TIMEOUT_MS = 5_000

/* ── Domains ───────────────────────────────────────────────── */

/** Second-level suffixes where the registrable domain has three labels (careers.tcs.co.in → tcs.co.in). */
const MULTI_PART_SUFFIXES = new Set([
  "co.in", "org.in", "net.in", "ac.in", "edu.in", "gov.in", "res.in", "firm.in", "gen.in", "ind.in",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "com.sg", "com.my",
  "co.jp", "com.br", "co.za", "com.cn", "com.hk",
])

export function registrableDomain(host: string) {
  const labels = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "").split(".")
  if (labels.length <= 2) return labels.join(".")
  const lastTwo = labels.slice(-2).join(".")
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo
}

/** Turns what a recruiter typed ("infosys.com", "https://www.infosys.com/careers") into a checked origin. */
export function normalizeWebsite(input: string) {
  const raw = input.trim()
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const host = url.hostname.toLowerCase()
  // A company website, not a bare address, a single word or this machine.
  if (!host.includes(".") || net.isIP(host.replace(/^\[|\]$/g, "")) || host === "localhost" || host.endsWith(".local")) return null
  return { url: `${url.protocol}//${host}`, host, domain: registrableDomain(host) }
}

/* ── Fetching a page safely (no server-side request forgery) ── */

/** Only addresses on the public internet: no loopback, private, link-local, CGNAT or reserved ranges. */
function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number)
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if ((a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return false
    return true
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v === "::" || v === "::1") return false
    if (v.startsWith("::ffff:")) return isPublicAddress(v.slice(7))
    if (/^(fe[89ab]|fc|fd|ff)/.test(v)) return false
    return true
  }
  return false
}

type Page = { status: number; html: string }

/**
 * GET a page, resolving the host first and connecting only to that checked public address
 * (pinned, so DNS can't switch it). Follows at most 3 redirects, re-checking each; reads at most 300 KB.
 */
async function fetchPage(target: URL, redirectsLeft = 3): Promise<Page> {
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("unsupported protocol")
  if (target.port && target.port !== "80" && target.port !== "443") throw new Error("unusual port")
  const addresses = await dns.lookup(target.hostname, { all: true })
  if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) throw new Error("not a public address")
  const pinned = addresses[0]
  const client = target.protocol === "https:" ? https : http

  return new Promise<Page>((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: "GET",
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        timeout: TIMEOUT_MS,
        lookup: ((_host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
          if (options?.all) callback(null, [{ address: pinned.address, family: pinned.family }])
          else callback(null, pinned.address, pinned.family)
        }) as unknown as net.LookupFunction,
      },
      (res) => {
        const status = res.statusCode ?? 0
        const location = res.headers.location
        if (status >= 300 && status < 400 && location) {
          res.resume()
          if (redirectsLeft <= 0) return reject(new Error("too many redirects"))
          let next: URL
          try {
            next = new URL(location, target)
          } catch {
            return reject(new Error("bad redirect"))
          }
          return fetchPage(next, redirectsLeft - 1).then(resolve, reject)
        }
        const chunks: Buffer[] = []
        let size = 0
        const done = () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") })
        res.on("data", (chunk: Buffer) => {
          size += chunk.length
          if (size > 300_000) {
            res.destroy()
            return done()
          }
          chunks.push(chunk)
        })
        res.on("end", done)
        res.on("error", reject)
      },
    )
    req.on("timeout", () => req.destroy(new Error("timed out")))
    req.on("error", reject)
    req.end()
  })
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim()
}

function pageTitle(html: string) {
  const site = /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']{1,120})["']/i.exec(html)?.[1]
  const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1]
  return site || title ? decodeEntities((site ?? title)!) : null
}

/* ── Matching names ────────────────────────────────────────── */

const LEGAL_WORDS = new Set([
  "pvt", "private", "ltd", "limited", "llp", "inc", "incorporated", "corp", "corporation", "company", "co",
  "technologies", "technology", "tech", "solutions", "services", "systems", "software", "labs", "india", "the", "and",
])

/** The distinctive words of a company name: "Infosys Limited" → ["infosys"]. */
function nameTokens(name: string) {
  const words = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3)
  const distinct = words.filter((w) => !LEGAL_WORDS.has(w))
  return distinct.length ? distinct : words
}

export function namesMatch(a: string, b: string) {
  const left = nameTokens(a)
  const right = new Set(nameTokens(b))
  return left.some((token) => right.has(token))
}

/* ── GST (India) ───────────────────────────────────────────── */

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** Format and check digit of a 15-character GSTIN, without any network call. */
export function gstinFormatValid(gstin: string) {
  const g = gstin.toUpperCase()
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false
  const state = Number(g.slice(0, 2))
  if (state < 1 || (state > 38 && state !== 97 && state !== 99)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const product = GST_CHARS.indexOf(g[i]) * ((i % 2) + 1)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] === g[14]
}

async function gstRegistry(gstin: string, companyName: string) {
  const key = process.env.GSTIN_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://gstinapi.in/v1/gstin/${encodeURIComponent(gstin)}`, {
      headers: { "x-api-key": key, "user-agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const record = (data.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>
    const legalName = String(record.legal_name ?? record.trade_name ?? "").trim()
    const status = String(record.status ?? "").trim()
    if (!legalName || !status) return null
    const tradeName = String(record.trade_name ?? "")
    return { status, legalName, nameMatches: namesMatch(companyName, legalName) || namesMatch(companyName, tradeName) }
  } catch {
    return null
  }
}

/* ── The other sources ─────────────────────────────────────── */

async function rdap(domain: string): Promise<{ exists: boolean | null; registeredAt: string | null }> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json", "user-agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 404) return { exists: false, registeredAt: null }
    if (!res.ok) return { exists: null, registeredAt: null }
    const data = (await res.json()) as { events?: { eventAction?: string; eventDate?: string }[] }
    const registered = data.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null
    return { exists: true, registeredAt: registered }
  } catch {
    return { exists: null, registeredAt: null }
  }
}

async function wikidata(name: string, domain: string): Promise<CompanyCheck["publicRecord"]> {
  try {
    const search = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&type=item&limit=5&format=json&search=${encodeURIComponent(name)}`,
      { headers: { "user-agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    const ids = ((await search.json()) as { search?: { id: string }[] }).search?.map((s) => s.id) ?? []
    if (!ids.length) return null
    const entities = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|labels&languages=en&format=json&ids=${ids.join("|")}`,
      { headers: { "user-agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    type Entity = { id: string; labels?: { en?: { value: string } }; claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] } }
    const all = Object.values(((await entities.json()) as { entities?: Record<string, Entity> }).entities ?? {})
    for (const entity of all) {
      for (const claim of entity.claims?.P856 ?? []) {
        const site = claim.mainsnak?.datavalue?.value
        if (!site) continue
        try {
          if (registrableDomain(new URL(site).hostname) === domain) return { id: entity.id, label: entity.labels?.en?.value ?? name }
        } catch {
          /* not a URL */
        }
      }
    }
    return null
  } catch {
    return null
  }
}

async function resolves(host: string) {
  try {
    return (await dns.lookup(host, { all: true })).length > 0
  } catch {
    return false
  }
}

async function hasMx(domain: string) {
  try {
    return (await dns.resolveMx(domain)).length > 0
  } catch {
    return false
  }
}

/** Runs every check in parallel (about 5 seconds at most). */
export async function checkCompany(input: { name: string; website: { url: string; host: string; domain: string }; gstin: string | null }): Promise<CompanyCheck> {
  const { name, website, gstin } = input
  const [dnsOk, registry, mx, publicRecord, page, gst] = await Promise.all([
    resolves(website.host),
    rdap(website.domain),
    hasMx(website.domain),
    wikidata(name, website.domain),
    fetchPage(new URL(website.url)).catch(() => null),
    gstin ? gstRegistry(gstin, name) : Promise.resolve(null),
  ])
  const title = page ? pageTitle(page.html) : null
  const text = page ? decodeEntities(page.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ")).slice(0, 20_000) : ""
  return {
    domain: website.domain,
    domainExists: dnsOk || registry.exists === true,
    website: { reachable: Boolean(page && page.status >= 200 && page.status < 400), status: page?.status ?? null, title },
    domainRegisteredAt: registry.registeredAt,
    mailServer: mx,
    nameOnWebsite: page ? namesMatch(name, `${title ?? ""} ${text} ${website.domain.split(".")[0]}`) : null,
    publicRecord,
    gst: gstin ? { gstin, formatValid: gstinFormatValid(gstin), registry: gst } : null,
    checkedAt: new Date().toISOString(),
  }
}
