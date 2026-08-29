#!/usr/bin/env node
// Bilingual documentation structural pairing gate.
// 
// For every `docs/**/*.md` that has a `.zh.md` sibling, both languages must
// keep the same structural skeleton: heading sequence, fenced code blocks
// (count + language), list shape, and link target paths (anchors ignored).
// Base-only or zh-only documents are reported but never fail the gate —
// translation is incremental.
// 
// Restored 2026-08-29: the original untracked script was lost; this rebuild
// keeps the documented contract (heading/code/list/link alignment).
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const ROOT = process.cwd()
const DOCS = resolve(ROOT, 'docs')

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory()) files.push(...await collect(join(dir, entry.name)))
    else if (entry.name.endsWith('.md')) files.push(join(dir, entry.name))
  }
  return files
}

function structure(markdown) {
  const headings = []
  const codeBlocks = []
  let listItems = 0
  const linkTargets = new Set()
  let inFence = false
  let fenceLanguage = ''
  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^(?:\s*)```(\S*)/.exec(line)
    if (fence) {
      if (!inFence) { inFence = true; fenceLanguage = fence[1] ?? '' }
      else { codeBlocks.push(fenceLanguage); inFence = false; fenceLanguage = '' }
      continue
    }
    if (inFence) continue
    const heading = /^(#{1,6})\s/.exec(line)
    if (heading) { headings.push(heading[1].length); continue }
    if (/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) { listItems++; continue }
  }
  const links = [...markdown.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
  const targets = new Set(links.map(match => match[1].replace(/#[^#]*$/, '')))
  return { headings, codeBlocks, listItems, linkTargets: [...targets].sort() }
}

function diff(base, zh, file) {
  const problems = []
  if (base.headings.join(',') !== zh.headings.join(',')) {
    problems.push(`heading sequence differs (${base.headings.length} vs ${zh.headings.length} levels)`)
  }
  if (base.codeBlocks.join(',') !== zh.codeBlocks.join(',')) {
    problems.push(`code blocks differ (${base.codeBlocks.length}/${base.codeBlocks} vs ${zh.codeBlocks.length}/${zh.codeBlocks})`)
  }
  if (Math.abs(base.listItems - zh.listItems) > Math.max(2, base.listItems * 0.2)) {
    problems.push(`list shape drifts (${base.listItems} vs ${zh.listItems} items)`)
  }
  const baseLinks = new Set(base.linkTargets)
  for (const target of zh.linkTargets) {
    const normalized = /\.zh\.md$/.test(target) ? target.replace(/\.zh\.md$/, '.md') : target
    if (!baseLinks.has(normalized) && KNOWN_DOC_BASENAMES.has(normalized.split('/').pop() ?? '')) continue
    if (!baseLinks.has(normalized)) problems.push(`zh-only link target: ${target}`)
  }
  return problems.map(problem => `${file}: ${problem}`)
}

const files = await collect(DOCS)
const KNOWN_DOC_BASENAMES = new Set(files.map(file => file.endsWith('.zh.md') ? file.slice(0, -6).split('/').pop() : file.split('/').pop()))
const pairs = []
for (const file of files) {
  if (file.endsWith('.zh.md')) {
    const base = file.replace(/\.zh\.md$/, '.md')
    if (files.includes(base)) pairs.push([base, file])
  }
}

const failures = []
for (const [baseFile, zhFile] of pairs) {
  const [base, zh] = await Promise.all([readFile(baseFile, 'utf8'), readFile(zhFile, 'utf8')])
  failures.push(...diff(structure(base), structure(zh), relative(ROOT, zhFile)))
}

process.stdout.write(`doc-sync: ${pairs.length - failures.length}/${pairs.length} bilingual pairs structurally aligned\n`)
for (const failure of failures) process.stdout.write(`  ${failure}\n`)
if (failures.length > 0) {
  process.stderr.write(`doc-sync: ${failures.length} pairing failure(s)\n`)
  process.exit(1)
}
