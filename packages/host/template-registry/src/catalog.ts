/**
 * promptrepo read-only catalog adapter — the degraded-mode data source (task 2.1).
 *
 * The promptrepo SDK is Go-only (see implementation-baseline.md gap 1), so the
 * honest fallback is a direct read of the content repository's `catalog.json`
 * (`promptrepo.catalog.v0.1`). Degraded semantics are frozen: read-only, no
 * network, no compile, no sessions (those are MCP-only), digest used for
 * stale labeling. Because the catalog carries NO per-template contract
 * permissions, every rights boolean is derived fail-closed (no preview, no
 * export) until a connected MCP inspect supplies the contract.
 *
 * @module @yeisme/dsh-template-registry/catalog
 */

import { z } from 'zod'
import { TemplateMaturity, TemplateSchema, type Template } from './contracts.js'

export const TEMPLATE_REGISTRY_CATALOG_SCHEMA_VERSION = 'promptrepo.catalog.v0.1'

/** Bounded browse: the degraded pane never renders an unbounded catalog. */
export const TEMPLATE_REGISTRY_CATALOG_BROWSE_LIMIT = 256

/** Solution-level rights vocabulary observed in the live catalog. */
const KNOWN_RIGHTS_LEVELS = new Set(['internal', 'free-evaluation', 'external-attributed'])

const CatalogLocaleSchema = z.object({
  title: z.string().max(300).optional(),
  summary: z.string().max(1200).optional(),
  usage: z.string().max(4000).optional(),
})

const CatalogTemplateEntrySchema = z.object({
  role: z.string().min(1).max(64),
  locale: z.string().min(1).max(32),
  digest: z.string().min(1).max(160),
  // Owner-internal repository path: parsed for tolerance, never projected.
  path: z.string().max(512).optional(),
})

const CatalogSolutionSchema = z.object({
  package_id: z.string().min(1).max(64),
  id: z.string().min(1).max(128),
  version: z.string().min(1).max(64),
  digest: z.string().min(1).max(160),
  category: z.string().max(64).optional(),
  tags: z.array(z.string().max(128)).max(64).default([]),
  capabilities: z.array(z.string().max(64)).max(64).default([]),
  rights: z.string().max(64),
  maturity: z.string().max(64),
  locales: z.record(z.string().max(32), CatalogLocaleSchema),
  templates: z.array(CatalogTemplateEntrySchema).max(64).default([]),
})

/** Structural mirror of the content repository catalog (v0.1). */
export const PromptCatalogSchema = z.object({
  schema_version: z.literal(TEMPLATE_REGISTRY_CATALOG_SCHEMA_VERSION),
  digest: z.string().min(1).max(160),
  repository: z.object({
    id: z.string().min(1).max(64),
    name: z.string().max(200).optional(),
    default_locale: z.string().max(32).optional(),
    taxonomy_version: z.string().max(64).optional(),
  }),
  solutions: z.array(CatalogSolutionSchema).max(1024),
})

export type PromptCatalog = z.infer<typeof PromptCatalogSchema>
export type PromptCatalogSolution = z.infer<typeof CatalogSolutionSchema>

/**
 * Fail-closed catalog parse: any shape drift returns undefined instead of a
 * half-parsed catalog (the caller then reports an honest offline state).
 */
export function parsePromptCatalog(input: unknown): PromptCatalog | undefined {
  const parsed = PromptCatalogSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

/** Snapshot digest of the parsed catalog — the degraded pane's stale marker. */
export function catalogSnapshotDigest(catalog: PromptCatalog): string {
  return catalog.digest
}

function normalizeMaturity(value: string): z.infer<typeof TemplateMaturity> {
  const parsed = TemplateMaturity.safeParse(value)
  return parsed.success ? parsed.data : 'exploratory'
}

/** Template ref in the exact owner form (`promptrepo://<repo>/<pkg>/<id>@<ver>?...`). */
export function catalogTemplateRef(catalog: PromptCatalog, solution: PromptCatalogSolution, entry: { role: string; locale: string }): string {
  return `promptrepo://${catalog.repository.id}/${solution.package_id}/${solution.id}@${solution.version}?locale=${encodeURIComponent(entry.locale)}&kind=template&role=${encodeURIComponent(entry.role)}`
}

/**
 * Render the bounded degraded browse: one Template row per catalog template
 * entry, filtered by the shared browse dimensions available offline
 * (query/category/tag/capability/locale). Rows are fail-closed on rights
 * (no contract permissions exist in the catalog) and carry `source: 'catalog'`
 * plus the solution `rightsLevel` so the pane can explain the degradation.
 */
export function catalogBrowseTemplates(
  catalog: PromptCatalog,
  filter: { query?: string; category?: string; tag?: string; capability?: string; locale?: string } = {},
): Template[] {
  const query = filter.query?.trim().toLowerCase()
  const templates: Template[] = []
  for (const solution of catalog.solutions) {
    if (filter.category !== undefined && solution.category !== filter.category) continue
    if (filter.tag !== undefined && !solution.tags.includes(filter.tag)) continue
    if (filter.capability !== undefined && !solution.capabilities.includes(filter.capability)) continue
    for (const entry of solution.templates) {
      if (filter.locale !== undefined && entry.locale !== filter.locale) continue
      const locale = solution.locales[entry.locale] ?? Object.values(solution.locales)[0] ?? {}
      const title = locale.title ?? `${solution.id} (${entry.role})`
      const summary = locale.summary ?? ''
      if (query !== undefined && query !== '') {
        const haystack = `${title} ${summary} ${solution.tags.join(' ')} ${solution.capabilities.join(' ')}`.toLowerCase()
        if (!haystack.includes(query)) continue
      }
      templates.push(TemplateSchema.parse({
        ref: catalogTemplateRef(catalog, solution, entry),
        digest: entry.digest,
        title: title.slice(0, 200),
        summary: summary.slice(0, 600),
        tags: solution.tags.slice(0, 16),
        capabilities: solution.capabilities.slice(0, 16),
        // Unknown maturity degrades to exploratory (the most conservative row).
        maturity: normalizeMaturity(solution.maturity),
        // Fail-closed: the catalog has no contract permissions, so preview and
        // export stay disabled until a connected MCP inspect derives them.
        rights: { preview: false, export: false },
        source: 'catalog',
        ...(KNOWN_RIGHTS_LEVELS.has(solution.rights) ? { rightsLevel: solution.rights } : {}),
        version: solution.version,
      }))
      if (templates.length >= TEMPLATE_REGISTRY_CATALOG_BROWSE_LIMIT) return templates
    }
  }
  return templates
}

/**
 * Host-side catalog file loader. Kept dependency-free by resolving node:fs
 * lazily through process.getBuiltinModule (mirrors the transport spawn rule:
 * browser builds never pull a static node: import).
 */
export async function readPromptCatalogFile(path: string): Promise<unknown> {
  const fs = process.getBuiltinModule('node:fs/promises') as typeof import('node:fs/promises')
  return JSON.parse(await fs.readFile(path, 'utf8')) as unknown
}
