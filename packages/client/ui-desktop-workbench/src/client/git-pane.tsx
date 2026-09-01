/** Agent Review Git Workspace. All mutations remain owner-authored typed intents. */

import type {
  GitBranchActionsCapabilityV1,
  GitCompareSessionCapabilityV1,
  GitDiffLayoutV2,
  GitDiffWindowCapabilityV2,
  GitDiffWindowV2,
  GitHistoryCommitV1,
  GitHistoryWindowCapabilityV1,
  GitMutationActionsCapabilityV2,
  GitMutationIntentV2,
  GitMutationPreflightV2,
  GitMutationReceiptV3,
  GitRemoteActionsCapabilityV1,
  GitStashActionsCapabilityV1,
  GitStashProjectionCapabilityV1,
  GitStatusFileWindowItemV1,
  GitStatusWindowCapabilityV1,
  GitStatusWindowV1,
  GitTagActionsCapabilityV1,
  GitTagProjectionCapabilityV1,
  GitWorktreeActionsCapabilityV2,
} from '@yeisme/dsh-git-host'
import type {
  GitReviewActionReceiptV1,
  GitReviewEvidenceCapabilityV1,
  GitReviewEvidenceSnapshotV1,
  GitReviewQueueRowV1,
  GitReviewWorktreeEvidenceV1,
} from '@yeisme/dsh-ordo-agent-ops/client-runtime'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { browserPreferenceStorage, probeCapability } from '@yeisme/dsh-plugin-contracts'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

export interface GitStatusFileV1 {
  readonly path: string
  readonly index: string
  readonly worktree: string
  readonly fileRef?: string
  readonly generated?: boolean
  readonly lowSignal?: boolean
  readonly hunkCount?: number
}

export interface GitStatusV1 {
  readonly branch: string
  readonly files: readonly GitStatusFileV1[]
  readonly repositoryRef?: string
  readonly worktreeRef?: string
  readonly revision?: string
  readonly cursor?: string
  readonly freshness?: 'fresh' | 'partial' | 'stale' | 'offline'
}

export interface GitDiffV1 { readonly path: string; readonly patch: string; readonly truncated: boolean }
export interface GitMutationReceiptV1 { readonly status: 'ok' | 'rejected'; readonly actionId: string; readonly reason?: string }
export interface GitRepositoryOptionV1 { readonly repositoryRef: string; readonly worktreeRef: string; readonly label: string; readonly agentWorktree?: boolean }
export type GitShortcutCommandId = 'git.open' | 'git.diff.next' | 'git.diff.previous' | 'git.preflight.confirm'
export interface GitShortcutBindingV1 { readonly commandId: GitShortcutCommandId; readonly key: string; readonly enabled: boolean; readonly conflictWith?: string }

export const DEFAULT_GIT_SHORTCUTS: readonly Omit<GitShortcutBindingV1, 'enabled' | 'conflictWith'>[] = [
  { commandId: 'git.open', key: 'Mod+Shift+G' },
  { commandId: 'git.diff.next', key: 'F7' },
  { commandId: 'git.diff.previous', key: 'Shift+F7' },
  { commandId: 'git.preflight.confirm', key: 'Mod+Enter' },
]

export function resolveGitShortcutBindings(occupied: Readonly<Record<string, string>> = {}): readonly GitShortcutBindingV1[] {
  return DEFAULT_GIT_SHORTCUTS.map(binding => {
    const conflictWith = occupied[binding.key]
    return conflictWith === undefined ? { ...binding, enabled: true } : { ...binding, enabled: false, conflictWith }
  })
}

export interface GitHostFace {
  readonly capabilities?: readonly string[]
  status(): Promise<GitStatusV1>
  diff?(path: string): Promise<GitDiffV1>
  diffStaged?(path: string): Promise<GitDiffV1>
  stage?(path: string): Promise<GitMutationReceiptV1>
  unstage?(path: string): Promise<GitMutationReceiptV1>
  commit?(message: string): Promise<GitMutationReceiptV1>
  readonly statusWindow?: GitStatusWindowCapabilityV1
  readonly diffWindowV2?: GitDiffWindowCapabilityV2
  readonly mutationActionsV2?: GitMutationActionsCapabilityV2
  readonly historyWindow?: GitHistoryWindowCapabilityV1
  readonly compareSession?: GitCompareSessionCapabilityV1
  readonly branchActions?: GitBranchActionsCapabilityV1
  readonly remoteActions?: GitRemoteActionsCapabilityV1
  readonly worktreeActions?: GitWorktreeActionsCapabilityV2
  readonly stashProjection?: GitStashProjectionCapabilityV1
  readonly stashActions?: GitStashActionsCapabilityV1
  readonly tagProjection?: GitTagProjectionCapabilityV1
  readonly tagActions?: GitTagActionsCapabilityV1
}

export interface GitPaneProps {
  readonly host: GitHostFace
  readonly review?: GitReviewEvidenceCapabilityV1
  readonly workspaceRef?: string
  readonly repositories?: readonly GitRepositoryOptionV1[]
  readonly shortcutBindings?: readonly GitShortcutBindingV1[]
}

type GitView = 'review' | 'changes' | 'history' | 'branches' | 'worktrees' | 'remotes' | 'stashes' | 'tags'
type GitGroup = 'merge' | 'staged' | 'changes' | 'untracked' | 'low_signal'
type GitStatusKind = 'conflict' | 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
type DiffScope = 'worktree' | 'staged'
interface GitChangeEntry { readonly key: string; readonly file: GitStatusFileV1; readonly group: GitGroup; readonly scope: DiffScope; readonly status: GitStatusKind }
interface GitTreeFolder { readonly kind: 'folder'; readonly key: string; readonly name: string; readonly children: readonly GitTreeNode[] }
interface GitTreeFile { readonly kind: 'file'; readonly key: string; readonly name: string; readonly parent: string; readonly entry: GitChangeEntry }
type GitTreeNode = GitTreeFolder | GitTreeFile

const GROUPS: readonly GitGroup[] = ['merge', 'staged', 'changes', 'untracked', 'low_signal']
const GROUP_LABEL: Readonly<Record<GitGroup, string>> = { merge: '合并冲突', staged: '已暂存更改', changes: '更改', untracked: '未跟踪文件', low_signal: '生成 / 低信号' }
const VIEWS: readonly { readonly id: GitView; readonly label: string }[] = [
  { id: 'review', label: '审查队列' }, { id: 'changes', label: '更改' }, { id: 'history', label: '历史' }, { id: 'branches', label: '分支' },
  { id: 'worktrees', label: '工作树' }, { id: 'remotes', label: '远端' }, { id: 'stashes', label: '储藏' }, { id: 'tags', label: '标签' },
]
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])
const AUTO_TREE_THRESHOLD = 5
const PAGE_LIMIT = 200

function basename(path: string): string { const parts = path.split('/').filter(Boolean); return parts.at(-1) ?? path }
function parentPath(path: string): string { const parts = path.split('/').filter(Boolean); return parts.length > 1 ? parts.slice(0, -1).join('/') : '' }
function statusKind(code: string): GitStatusKind { return code === 'A' ? 'added' : code === 'D' ? 'deleted' : code === 'R' || code === 'C' ? 'renamed' : 'modified' }
function statusToken(status: GitStatusKind): string { return status === 'conflict' ? '!' : status === 'added' || status === 'untracked' ? 'A' : status === 'deleted' ? 'D' : status === 'renamed' ? 'R' : 'M' }
function statusLabel(status: GitStatusKind): string { return status === 'conflict' ? '冲突' : status === 'added' ? '新增' : status === 'deleted' ? '删除' : status === 'renamed' ? '重命名' : status === 'untracked' ? '未跟踪' : '修改' }
function diffLineKind(line: string): 'add' | 'delete' | 'hunk' | 'meta' | 'context' {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) return 'meta'
  if (line.startsWith('+')) return 'add'; if (line.startsWith('-')) return 'delete'; if (line.startsWith('@@')) return 'hunk'; return 'context'
}

function changeEntries(file: GitStatusFileV1): readonly GitChangeEntry[] {
  const code = `${file.index}${file.worktree}`; const lowSignal = file.generated === true || file.lowSignal === true
  if (CONFLICT_CODES.has(code)) return [{ key: `merge:${file.path}`, file, group: 'merge', scope: 'worktree', status: 'conflict' }]
  if (code === '??') return [{ key: `${lowSignal ? 'low_signal' : 'untracked'}:${file.path}`, file, group: lowSignal ? 'low_signal' : 'untracked', scope: 'worktree', status: 'untracked' }]
  if (lowSignal) { const staged = file.index !== ' ' && file.index !== ''; return [{ key: `low_signal:${file.path}`, file, group: 'low_signal', scope: staged ? 'staged' : 'worktree', status: statusKind(staged ? file.index : file.worktree) }] }
  const entries: GitChangeEntry[] = []
  if (file.index !== ' ' && file.index !== '') entries.push({ key: `staged:${file.path}`, file, group: 'staged', scope: 'staged', status: statusKind(file.index) })
  if (file.worktree !== ' ' && file.worktree !== '') entries.push({ key: `changes:${file.path}`, file, group: 'changes', scope: 'worktree', status: statusKind(file.worktree) })
  return entries
}

function groupChanges(files: readonly GitStatusFileV1[]): Record<GitGroup, readonly GitChangeEntry[]> {
  const grouped: Record<GitGroup, GitChangeEntry[]> = { merge: [], staged: [], changes: [], untracked: [], low_signal: [] }
  for (const file of files) for (const entry of changeEntries(file)) grouped[entry.group].push(entry)
  for (const group of GROUPS) grouped[group].sort((a, b) => a.file.path.localeCompare(b.file.path, undefined, { numeric: true, sensitivity: 'base' }))
  return grouped
}

function compactFolder(node: GitTreeFolder): GitTreeFolder {
  let name = node.name; let children = node.children
  while (children.length === 1 && children[0]?.kind === 'folder') { name = `${name}/${children[0].name}`; children = children[0].children }
  return { ...node, name, children: children.map(child => child.kind === 'folder' ? compactFolder(child) : child) }
}

function buildTree(entries: readonly GitChangeEntry[]): readonly GitTreeNode[] {
  interface MutableFolder { name: string; key: string; folders: Map<string, MutableFolder>; files: GitTreeFile[] }
  const root: MutableFolder = { name: '', key: '', folders: new Map(), files: [] }
  for (const entry of entries) {
    const parts = entry.file.path.split('/').filter(Boolean); let current = root
    for (const part of parts.slice(0, -1)) { const key = current.key === '' ? part : `${current.key}/${part}`; let next = current.folders.get(part); if (next === undefined) { next = { name: part, key, folders: new Map(), files: [] }; current.folders.set(part, next) }; current = next }
    current.files.push({ kind: 'file', key: entry.key, name: parts.at(-1) ?? entry.file.path, parent: '', entry })
  }
  const materialize = (folder: MutableFolder): readonly GitTreeNode[] => [
    ...[...folder.folders.values()].sort((a, b) => a.name.localeCompare(b.name)).map(child => compactFolder({ kind: 'folder', key: child.key, name: child.name, children: materialize(child) })),
    ...folder.files.sort((a, b) => a.name.localeCompare(b.name)),
  ]
  return materialize(root)
}

function mapWindowFile(file: GitStatusFileWindowItemV1): GitStatusFileV1 {
  const code = file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : file.status === 'renamed' ? 'R' : file.status === 'untracked' ? '?' : file.status === 'conflict' ? 'U' : 'M'
  const staged = file.group === 'staged'
  return { path: file.pathLabel, fileRef: file.fileRef, index: file.status === 'untracked' ? '?' : staged ? code : ' ', worktree: file.status === 'untracked' ? '?' : staged ? ' ' : code, generated: file.generated, lowSignal: file.lowSignal, ...(file.hunkCount === undefined ? {} : { hunkCount: file.hunkCount }) }
}
function statusFromWindow(window: GitStatusWindowV1): GitStatusV1 { return { branch: window.branch, files: window.files.map(mapWindowFile), repositoryRef: window.repositoryRef, worktreeRef: window.worktreeRef, revision: window.revision, cursor: window.cursor, freshness: window.freshness } }
function safeId(prefix: string): string { const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; return `${prefix}:${random}` }
/**
 * G21 safe-projection 收口：client 代码不直接触碰浏览器 storage 全局
 * （SAFEPROJ/BROWSER_STORAGE_ACCESS 观测红线）。展示偏好读写经 sdk 契约
 * seam 三态探测；probe 不可用按缺省偏好降级，读写失败不抛错。
 */
function preferenceStorage() {
  const probed = probeCapability(browserPreferenceStorage)
  return probed.status === 'available' ? probed.capability : undefined
}
function readDiffLayout(workspaceRef: string): GitDiffLayoutV2 { try { return preferenceStorage()?.getItem(`dsh.git.diff-layout:${workspaceRef}`) === 'side_by_side' ? 'side_by_side' : 'unified' } catch { return 'unified' } }
function writePreference(key: string, value: string): void { try { preferenceStorage()?.setItem(key, value) } catch { /* optional presentation persistence */ } }
function riskWeight(risk: GitReviewQueueRowV1['risk']): number { return risk === 'conflict' ? 5 : risk === 'revision_drift' ? 4 : risk === 'verification_failed' ? 3 : risk === 'feedback' ? 2 : risk === 'approval' ? 1 : 0 }
function sortedQueue(rows: readonly GitReviewQueueRowV1[]): readonly GitReviewQueueRowV1[] { return [...rows].sort((a, b) => riskWeight(b.risk) - riskWeight(a.risk) || Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)) }
function readiness(evidence: GitReviewWorktreeEvidenceV1 | undefined, revision: string | undefined, agentWorktree: boolean, ordoOnline: boolean): readonly string[] {
  if (!agentWorktree) return []; if (!ordoOnline || evidence === undefined) return ['Ordo 审查证据离线']
  const reasons: string[] = []
  if (evidence.conflictCount > 0) reasons.push('仍有冲突'); if (revision === undefined || evidence.revision !== revision) reasons.push('revision 已漂移')
  if (evidence.reviewableHunkCount === 0 || evidence.reviewedHunkCount < evidence.reviewableHunkCount) reasons.push('尚未审查全部 hunk')
  if (evidence.verification !== 'passed') reasons.push('验证尚未通过'); if (evidence.feedback.some(item => item.state === 'open')) reasons.push('仍有未解决反馈')
  return reasons
}

const gitPaneStyles = buildPanelStyles({ scope: 'dsh-git-pane', extra: `
[data-dsh-git-pane]{container:dsh-git-pane/inline-size;position:relative;display:grid;grid-template-rows:auto auto minmax(0,1fr);height:100%;min-height:0;overflow:hidden;background:var(--vk-bg-base)}
[data-dsh-git-pane] button,[data-dsh-git-pane] select,[data-dsh-git-pane] input{font:inherit}
[data-dsh-git-pane] .git-header{display:grid;gap:8px;padding:11px 12px 9px;background:var(--vk-bg-layer-1);border-bottom:1px solid var(--vk-border-l2)}
[data-dsh-git-pane] .git-title-row,[data-dsh-git-pane] .git-summary,[data-dsh-git-pane] .git-row-end{display:flex;align-items:center;gap:7px}.git-title-row{justify-content:space-between}.git-title{display:flex;align-items:baseline;gap:9px;min-width:0}.git-section-label{color:var(--vk-text-secondary);font-size:var(--vk-font-small);font-weight:650}
[data-dsh-git-pane] .git-branch,[data-dsh-git-pane] .git-summary,[data-dsh-git-pane] .git-muted{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}.git-branch{overflow:hidden;color:var(--vk-text-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:650;text-overflow:ellipsis;white-space:nowrap}
[data-dsh-git-pane] .git-context{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px}.git-context select{min-width:0;min-height:32px;padding:0 8px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}.git-context-meta{display:flex;align-items:center;gap:6px;white-space:nowrap}.git-context-count,.git-freshness{display:inline-flex;align-items:center;min-height:22px;padding:0 7px;color:var(--vk-text-secondary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l1);border-radius:999px;font-size:var(--vk-font-small)}.git-freshness[data-freshness='fresh']{color:var(--vk-state-positive)}.git-freshness[data-freshness='stale'],.git-freshness[data-freshness='offline']{color:var(--vk-state-warn)}
[data-dsh-git-pane] .git-nav{display:flex;align-items:center;gap:1px;min-width:0;padding:0 8px;background:var(--vk-bg-layer-1);border-bottom:1px solid var(--vk-border-l2);overflow:auto;scrollbar-width:none}.git-nav button{position:relative;flex:0 0 auto;min-height:36px;padding:0 9px;color:var(--vk-text-tertiary);background:transparent;border:0;cursor:pointer}.git-nav button[aria-selected='true']{color:var(--vk-text-primary)}.git-nav button[aria-selected='true']::after{position:absolute;right:8px;bottom:0;left:8px;height:2px;background:var(--vk-accent);content:''}.git-nav select{margin-left:auto;color:var(--vk-text-secondary);background:transparent;border:0}.git-view-selector{display:none;width:100%;min-height:38px;color:var(--vk-text-primary);background:var(--vk-bg-layer-1);border:0;border-bottom:1px solid var(--vk-border-l2);padding:0 10px}
[data-dsh-git-pane] .git-view{min-height:0;overflow:auto}.git-view>section{height:100%}.git-empty{display:grid;place-items:center;align-content:center;gap:8px;min-height:180px;padding:24px;color:var(--vk-text-tertiary);text-align:center}.git-empty strong{color:var(--vk-text-primary)}.git-empty p{max-width:400px;margin:0}
[data-dsh-git-pane] .git-alert,[data-dsh-git-pane] .git-notice{margin:8px 10px;padding:8px 10px;border-radius:var(--vk-radius-md);font-size:var(--vk-font-small)}.git-alert{color:var(--vk-text-primary);background:color-mix(in srgb,var(--vk-state-error) 11%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-error) 30%,transparent)}.git-notice{background:color-mix(in srgb,var(--vk-state-warn) 10%,transparent);border:1px solid color-mix(in srgb,var(--vk-state-warn) 28%,transparent)}
[data-dsh-git-pane] .git-changes-view{display:grid;grid-template-rows:auto auto auto minmax(0,1fr);height:100%;min-height:0}.git-composer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px 10px;border-bottom:1px solid var(--vk-border-l1)}.git-message{display:grid;gap:4px}.git-message span{color:var(--vk-text-secondary);font-size:var(--vk-font-small);font-weight:650}.git-message input,.git-override{min-height:32px;padding:0 9px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-md)}.git-bulk{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--vk-border-l1)}
[data-dsh-git-pane] .git-content{display:grid;min-height:0;overflow:hidden}.git-master,.git-detail{min-width:0;min-height:0;overflow:auto}.git-content[data-has-diff='true'] .git-master{display:none}.git-group{border-bottom:1px solid var(--vk-border-l1)}.git-group-heading{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;width:100%;min-height:32px;padding:0 10px;color:var(--vk-text-secondary);text-align:left;background:var(--vk-bg-layer-1);border:0;cursor:pointer}.git-group-heading:hover{background:var(--vk-fill-hover)}.git-disclosure{font-size:10px;transform:rotate(-90deg);transition:transform 120ms ease-out}.git-group-heading[aria-expanded='true'] .git-disclosure{transform:rotate(0)}.git-group-name{font-weight:650}.git-count{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-git-pane] .git-tree{padding:2px 0 4px}.git-folder-row,.git-file-row{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:5px;min-height:28px;padding:0 7px 0 calc(7px + var(--git-depth,0) * 14px);border:1px solid transparent}.git-folder-row{width:100%;color:var(--vk-text-secondary);text-align:left;background:transparent;cursor:pointer}.git-folder-row:hover,.git-file-row:hover,.git-file-row:focus-within{background:var(--vk-fill-hover)}.git-file-row[data-selected='true']{background:var(--vk-fill-selected);border-color:color-mix(in srgb,var(--vk-accent) 22%,transparent)}.git-file-main{display:flex;align-items:baseline;gap:7px;min-width:0;color:inherit;text-align:left;background:transparent;border:0;cursor:pointer}.git-file-name{overflow:hidden;color:var(--vk-text-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.git-parent{overflow:hidden;color:var(--vk-text-quaternary);font-size:var(--vk-font-small);text-overflow:ellipsis;white-space:nowrap}
[data-dsh-git-pane] .git-row-actions{display:none;gap:3px}.git-file-row:hover .git-row-actions,.git-file-row:focus-within .git-row-actions{display:flex}.git-file-row:hover .git-status-token,.git-file-row:focus-within .git-status-token{display:none}.git-action{min-height:24px;padding:0 7px;color:var(--vk-text-secondary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);cursor:pointer;font-size:var(--vk-font-small)}.git-action:disabled{opacity:.45;cursor:not-allowed}.git-status-token{width:18px;text-align:center;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}[data-status='modified']{color:var(--vk-state-warn)}[data-status='added'],[data-status='untracked']{color:var(--vk-state-positive)}[data-status='deleted'],[data-status='conflict']{color:var(--vk-state-error)}[data-status='renamed']{color:var(--vk-state-info)}
[data-dsh-git-pane] .git-detail{display:none;background:var(--vk-bg-base)}.git-content[data-has-diff='true'] .git-detail{display:grid;grid-template-rows:auto auto minmax(0,1fr)}.git-detail-header{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 9px;background:var(--vk-bg-layer-1);border-bottom:1px solid var(--vk-border-l2)}.git-detail-title{flex:1;overflow:hidden;font-weight:650;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.git-diff-toolbar{display:flex;align-items:center;gap:6px;padding:6px 9px;border-bottom:1px solid var(--vk-border-l1)}.git-diff-toolbar input{min-width:80px;flex:1;min-height:28px;color:var(--vk-text-primary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm)}.git-diff{min-height:0;overflow:auto;margin:0;padding:6px 0;background:var(--vk-bg-base);font:var(--vk-font-small)/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre}.git-diff-line{display:block;min-height:19px;padding:0 10px;color:var(--vk-text-secondary)}.git-diff-line[data-line='add']{color:var(--vk-state-positive);background:color-mix(in srgb,var(--vk-state-positive) 10%,transparent)}.git-diff-line[data-line='delete']{color:var(--vk-state-error);background:color-mix(in srgb,var(--vk-state-error) 10%,transparent)}.git-diff-line[data-line='hunk']{color:var(--vk-state-info);background:color-mix(in srgb,var(--vk-state-info) 8%,transparent)}.git-diff-line[data-line='meta']{color:var(--vk-text-quaternary)}.git-hunk{border-bottom:1px solid var(--vk-border-l1)}.git-hunk[data-selected='true']{outline:1px solid var(--vk-accent);outline-offset:-1px}.git-hunk-header{display:flex;align-items:center;gap:8px;padding:5px 9px;color:var(--vk-state-info);background:var(--vk-bg-layer-1)}.git-hunk-header code{flex:1}
[data-dsh-git-pane] .git-queue,.git-history{display:grid;align-content:start}.git-history-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;min-height:100%}.git-history-inspector{padding:10px;background:var(--vk-bg-layer-1);border-left:1px solid var(--vk-border-l2)}.git-history-inspector h3{margin:0 0 8px}.git-queue-row,.git-history-row{display:grid;align-items:center;gap:8px;min-height:44px;padding:5px 10px;color:var(--vk-text-primary);text-align:left;background:transparent;border:0;border-bottom:1px solid var(--vk-border-l1);cursor:pointer}.git-queue-row{grid-template-columns:minmax(150px,1.4fr) minmax(90px,.8fr) auto auto}.git-history-row{grid-template-columns:72px minmax(180px,1fr) minmax(90px,.6fr) 80px}.git-history-row[aria-pressed='true']{background:var(--vk-fill-selected)}.git-queue-row:hover,.git-history-row:hover{background:var(--vk-fill-hover)}.git-risk{font-size:var(--vk-font-small);font-weight:650}.git-risk[data-risk='conflict'],.git-risk[data-risk='verification_failed']{color:var(--vk-state-error)}.git-risk[data-risk='revision_drift'],.git-risk[data-risk='feedback']{color:var(--vk-state-warn)}.git-risk[data-risk='none']{color:var(--vk-state-positive)}
[data-dsh-git-pane] .git-preflight{position:absolute;z-index:4;right:0;bottom:0;width:min(380px,100%);max-height:calc(100% - 84px);overflow:auto;padding:12px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);box-shadow:var(--vk-shadow-overlay)}.git-preflight h3{margin:0 0 10px}.git-preflight dl{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;margin:0 0 10px}.git-preflight dt{color:var(--vk-text-tertiary)}.git-preflight dd{margin:0;overflow-wrap:anywhere}.git-preflight-actions{display:flex;justify-content:flex-end;gap:7px}
[data-dsh-git-pane] .git-resource-view{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:100%}.git-resource-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 16px 12px;border-bottom:1px solid var(--vk-border-l1)}.git-resource-heading h2{margin:2px 0 3px;color:var(--vk-text-primary);font-size:16px;line-height:1.25}.git-resource-heading p{max-width:620px;margin:0;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}.git-resource-kicker{color:var(--vk-text-tertiary);font-size:var(--vk-font-small);font-weight:650}.git-resource-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;min-height:0}.git-resource-list{min-width:0;overflow:auto}.git-resource-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;width:100%;min-height:52px;padding:6px 12px;color:var(--vk-text-primary);text-align:left;background:transparent;border:0;border-bottom:1px solid var(--vk-border-l1)}button.git-resource-row{cursor:pointer}.git-resource-row:hover{background:var(--vk-fill-hover)}.git-resource-row[aria-pressed='true'],.git-resource-row[data-current='true']{background:var(--vk-fill-selected)}.git-resource-marker{display:grid;place-items:center;width:24px;height:24px;color:var(--vk-text-secondary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);font:700 var(--vk-font-small)/1 ui-monospace,SFMono-Regular,Menlo,monospace}.git-resource-copy{min-width:0}.git-resource-copy strong,.git-resource-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-resource-copy strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.git-resource-copy small{margin-top:3px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}.git-resource-badge{display:inline-flex;align-items:center;min-height:22px;padding:0 7px;color:var(--vk-text-secondary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:999px;font-size:var(--vk-font-small);white-space:nowrap}.git-resource-badge[data-agent='true']{color:var(--vk-state-info)}.git-resource-inline-empty{padding:18px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}
[data-dsh-git-pane] .git-resource-inspector{min-width:0;overflow:auto;padding:14px;background:var(--vk-bg-layer-1);border-left:1px solid var(--vk-border-l2)}.git-resource-inspector h3{margin:0 0 5px;font-size:14px}.git-resource-inspector>p{margin:0 0 14px;color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}.git-resource-inspector dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 10px;margin:0 0 14px}.git-resource-inspector dt{color:var(--vk-text-tertiary);font-size:var(--vk-font-small)}.git-resource-inspector dd{min-width:0;margin:0;overflow:hidden;color:var(--vk-text-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--vk-font-small);text-overflow:ellipsis;white-space:nowrap}.git-resource-actions{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;padding:0;list-style:none}.git-resource-actions li{display:inline-flex;align-items:center;min-height:26px;padding:0 8px;color:var(--vk-text-secondary);background:var(--vk-bg-layer-2);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);font-size:var(--vk-font-small)}.git-resource-policy{padding-top:10px;border-top:1px solid var(--vk-border-l1);color:var(--vk-text-tertiary);font-size:var(--vk-font-small);line-height:1.5}
@container dsh-git-pane (min-width:760px){[data-dsh-git-pane] .git-content{grid-template-columns:minmax(280px,36%) minmax(0,1fr)}[data-dsh-git-pane] .git-master{display:block!important;border-right:1px solid var(--vk-border-l2)}[data-dsh-git-pane] .git-detail{display:grid}.git-back{display:none}}
@container dsh-git-pane (max-width:559px){[data-dsh-git-pane] .git-nav{display:none}[data-dsh-git-pane] .git-view-selector{display:block}[data-dsh-git-pane] .git-context{grid-template-columns:minmax(0,1fr)}[data-dsh-git-pane] .git-context-meta{justify-content:space-between}[data-dsh-git-pane] .git-queue-row{grid-template-columns:1fr auto}.git-queue-meta{display:none}[data-dsh-git-pane] .git-history-layout,.git-resource-layout{grid-template-columns:1fr}.git-history-inspector,.git-resource-inspector{border-top:1px solid var(--vk-border-l2);border-left:0}.git-history-row{grid-template-columns:60px 1fr}.git-history-meta{display:none}[data-dsh-git-pane] .git-resource-heading{padding:12px}.git-resource-row{min-height:56px}.git-resource-inspector{padding:12px}[data-dsh-git-pane] .git-preflight{inset:74px 0 0;width:auto;max-height:none}}
@media(pointer:coarse){[data-dsh-git-pane] .git-folder-row,[data-dsh-git-pane] .git-file-row,[data-dsh-git-pane] .git-action,[data-dsh-git-pane] .git-nav button,[data-dsh-git-pane] .git-context select,[data-dsh-git-pane] .git-view-selector{min-height:44px}[data-dsh-git-pane] .git-row-actions{display:flex}[data-dsh-git-pane] .git-status-token{display:none}}
@media(prefers-reduced-motion:reduce){[data-dsh-git-pane] *{scroll-behavior:auto!important;transition:none!important}}
` })

function GitViewSwitcher({ view, reviewAvailable, onChange }: { readonly view: GitView; readonly reviewAvailable: boolean; readonly onChange: (view: GitView) => void }): ReactNode {
  const views = reviewAvailable ? VIEWS : VIEWS.filter(item => item.id !== 'review')
  return <><nav className="git-nav" role="tablist" aria-label="Git 视图">{views.slice(0, 5).map(item => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => { onChange(item.id) }}>{item.label}</button>)}<select aria-label="更多 Git 视图" value={views.slice(0, 5).some(item => item.id === view) ? '' : view} onChange={event => { if (event.target.value !== '') onChange(event.target.value as GitView) }}><option value="">更多</option>{views.slice(5).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></nav><select className="git-view-selector" aria-label="选择 Git 视图" value={view} onChange={event => { onChange(event.target.value as GitView) }}>{views.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></>
}

function TreeNodes(props: { readonly nodes: readonly GitTreeNode[]; readonly depth: number; readonly expandedFolders: ReadonlySet<string>; readonly onToggleFolder: (key: string) => void; readonly renderFile: (node: GitTreeFile, depth: number) => ReactNode }): ReactNode {
  return props.nodes.map(node => node.kind === 'file' ? props.renderFile(node, props.depth) : <div key={node.key} role="treeitem" aria-expanded={props.expandedFolders.has(node.key)}><button type="button" className="git-folder-row" aria-label={node.name} style={{ '--git-depth': props.depth } as CSSProperties} onClick={() => { props.onToggleFolder(node.key) }} onKeyDown={event => { if (event.key === 'ArrowRight' && !props.expandedFolders.has(node.key)) { event.preventDefault(); props.onToggleFolder(node.key) }; if (event.key === 'ArrowLeft' && props.expandedFolders.has(node.key)) { event.preventDefault(); props.onToggleFolder(node.key) } }}><span aria-hidden="true">{props.expandedFolders.has(node.key) ? '▾' : '▸'}</span><span>{node.name}</span><span /></button>{props.expandedFolders.has(node.key) && <div role="group"><TreeNodes {...props} nodes={node.children} depth={props.depth + 1} /></div>}</div>)
}

function CapabilityPlaceholder({ view, onBack }: { readonly view: Exclude<GitView, 'changes' | 'review' | 'history'>; readonly onBack: () => void }): ReactNode {
  const label = VIEWS.find(item => item.id === view)?.label ?? view
  return <div className="git-empty"><strong>{label}</strong><p>当前 Git host 尚未提供该视图的数据能力。入口保留，能力接入后会在这里显示真实 owner projection。</p><button type="button" className="vk-btn" onClick={onBack}>返回更改</button></div>
}

type GitResourceViewId = Exclude<GitView, 'changes' | 'review' | 'history'>

const RESOURCE_COPY: Readonly<Record<GitResourceViewId, { readonly title: string; readonly description: string; readonly marker: string }>> = {
  branches: { title: '分支', description: '查看当前分支与 owner 已公布的安全操作。', marker: 'B' },
  worktrees: { title: '工作树', description: '在一个 Git 面板中切换普通工作树与 Agent 工作树。', marker: 'W' },
  remotes: { title: '远端', description: '保留 fetch、pull 与 push 的能力边界，不在浏览器保存凭据或 URL。', marker: 'R' },
  stashes: { title: '储藏', description: '查看 owner 发布的储藏引用，危险操作继续经过预检。', marker: 'S' },
  tags: { title: '标签', description: '查看标签投影与仓库签名策略。', marker: 'T' },
}

const RESOURCE_ACTION_LABELS: Readonly<Record<GitResourceViewId, Readonly<Record<string, string>>>> = {
  branches: { list: '查看分支', create: '新建分支', switch: '切换分支', delete: '删除分支' },
  worktrees: { list: '查看工作树', create: '新建工作树', remove: '移除工作树' },
  remotes: { fetch: 'Fetch', pull: 'Pull', push: 'Push' },
  stashes: { create: '创建储藏', apply: '应用储藏', pop: '弹出储藏', drop: '删除储藏' },
  tags: { create: '新建标签', delete: '删除标签', push: '推送标签' },
}

function GitResourceView(props: {
  readonly view: GitResourceViewId
  readonly status: GitStatusV1 | undefined
  readonly repositoryOptions: readonly GitRepositoryOptionV1[]
  readonly selectedRepository: GitRepositoryOptionV1 | undefined
  readonly branchActions: GitBranchActionsCapabilityV1 | undefined
  readonly remoteActions: GitRemoteActionsCapabilityV1 | undefined
  readonly worktreeActions: GitWorktreeActionsCapabilityV2 | undefined
  readonly stashProjection: GitStashProjectionCapabilityV1 | undefined
  readonly stashActions: GitStashActionsCapabilityV1 | undefined
  readonly tagProjection: GitTagProjectionCapabilityV1 | undefined
  readonly tagActions: GitTagActionsCapabilityV1 | undefined
  readonly totalChanges: number
  readonly onSelectRepository: (repository: GitRepositoryOptionV1) => void
  readonly onBack: () => void
}): ReactNode {
  const copy = RESOURCE_COPY[props.view]
  const actions = props.view === 'branches' ? props.branchActions?.actions
    : props.view === 'worktrees' ? props.worktreeActions?.actions
      : props.view === 'remotes' ? props.remoteActions?.actions
        : props.view === 'stashes' ? props.stashActions?.actions
          : props.tagActions?.actions
  const projectionAvailable = props.view === 'worktrees' ? props.repositoryOptions.length > 0
    : props.view === 'stashes' ? props.stashProjection !== undefined
      : props.view === 'tags' ? props.tagProjection !== undefined
        : props.view === 'branches' ? props.status?.branch !== undefined
          : false
  if (actions === undefined && !projectionAvailable) return <CapabilityPlaceholder view={props.view} onBack={props.onBack} />

  const selected = props.selectedRepository ?? props.repositoryOptions.find(item => item.repositoryRef === props.status?.repositoryRef && item.worktreeRef === props.status?.worktreeRef)
  const freshness = props.view === 'stashes' ? props.stashProjection?.freshness : props.view === 'tags' ? props.tagProjection?.freshness : props.status?.freshness
  const refs = props.view === 'stashes' ? props.stashProjection?.stashRefs ?? [] : props.view === 'tags' ? props.tagProjection?.tagRefs ?? [] : []
  const resourceCount = props.view === 'branches' ? (props.status?.branch === undefined ? 0 : 1) : props.view === 'worktrees' ? props.repositoryOptions.length : refs.length
  const policy = props.view === 'worktrees' ? 'Git Pane 只切换工作树上下文，不会释放 Ordo writer lease。'
    : props.view === 'branches' ? '脏工作树切换仍由 Git owner 预检，默认优先新建工作树。'
      : props.view === 'remotes' ? '远端名称、URL 和凭据由仓库 owner 保管，不进入浏览器投影。'
        : props.view === 'stashes' ? 'Pop 与 Drop 属于破坏性动作，必须经过 owner preflight 与 receipt。'
          : `新标签默认为 ${props.tagActions?.defaultKind ?? 'annotated'}，签名遵循 ${props.tagActions?.signing ?? 'repository config'}。`

  return <section className="git-resource-view" aria-label={copy.title}>
    <header className="git-resource-heading"><div><span className="git-resource-kicker">Git 资源</span><h2>{copy.title}</h2><p>{copy.description}</p></div>{freshness !== undefined && <span className="git-freshness" data-freshness={freshness}>{freshness}</span>}</header>
    <div className="git-resource-layout"><div className="git-resource-list">
      {props.view === 'branches' && <div className="git-resource-row" data-current="true"><span className="git-resource-marker">B</span><span className="git-resource-copy"><strong>{props.status?.branch ?? '未知分支'}</strong><small>{props.totalChanges} 个待处理文件</small></span><span className="git-resource-badge">当前</span></div>}
      {props.view === 'worktrees' && props.repositoryOptions.map(item => { const active = item.repositoryRef === selected?.repositoryRef && item.worktreeRef === selected?.worktreeRef; return <button key={`${item.repositoryRef}:${item.worktreeRef}`} type="button" className="git-resource-row" aria-pressed={active} onClick={() => { props.onSelectRepository(item) }}><span className="git-resource-marker">{item.agentWorktree === true ? 'A' : 'W'}</span><span className="git-resource-copy"><strong>{item.label}</strong><small>{active ? `${props.status?.branch ?? '正在读取分支'} · ${props.totalChanges} 个更改` : item.agentWorktree === true ? 'Agent 工作树 · owner 安全投影' : '可切换工作树'}</small></span><span className="git-resource-badge" data-agent={item.agentWorktree === true}>{item.agentWorktree === true ? 'Agent' : active ? '当前' : '可切换'}</span></button> })}
      {props.view === 'remotes' && <div className="git-resource-row"><span className="git-resource-marker">R</span><span className="git-resource-copy"><strong>仓库远端</strong><small>安全上下文由 Git owner 管理</small></span><span className="git-resource-badge">{actions?.length ?? 0} 个动作</span></div>}
      {(props.view === 'stashes' || props.view === 'tags') && refs.map((ref, index) => <div key={ref} className="git-resource-row"><span className="git-resource-marker">{copy.marker}</span><span className="git-resource-copy"><strong>{ref}</strong><small>{props.view === 'stashes' ? `储藏 ${index + 1}` : '仓库标签'}</small></span><span className="git-resource-badge">{props.view === 'stashes' ? 'stash' : 'tag'}</span></div>)}
      {((props.view === 'worktrees' && props.repositoryOptions.length === 0) || ((props.view === 'stashes' || props.view === 'tags') && refs.length === 0)) && <div className="git-resource-inline-empty">当前没有可显示的{copy.title}投影。</div>}
    </div><aside className="git-resource-inspector"><h3>{copy.title}详情</h3><p>已发布能力与当前安全上下文。</p><dl><dt>当前分支</dt><dd>{props.status?.branch ?? 'unknown'}</dd><dt>当前工作树</dt><dd>{selected?.label ?? props.status?.worktreeRef ?? 'unknown'}</dd><dt>资源数</dt><dd>{resourceCount}</dd><dt>更改</dt><dd>{props.totalChanges}</dd></dl><h3>已发布动作</h3>{actions !== undefined && actions.length > 0 ? <ul className="git-resource-actions">{actions.map(action => <li key={action}>可用 · {RESOURCE_ACTION_LABELS[props.view][action] ?? action}</li>)}</ul> : <p>当前只有可读投影。</p>}<div className="git-resource-policy">{policy}</div><button type="button" className="vk-btn" onClick={props.onBack}>返回更改</button></aside></div>
  </section>
}

function ReviewQueueView({ snapshot, loading, error, onRefresh, onSelect }: { readonly snapshot: GitReviewEvidenceSnapshotV1 | undefined; readonly loading: boolean; readonly error: string | undefined; readonly onRefresh: () => void; readonly onSelect: (row: GitReviewQueueRowV1) => void }): ReactNode {
  if (loading) return <div className="git-empty" role="status"><strong>正在读取审查队列…</strong></div>
  if (error !== undefined) return <div className="git-alert" role="alert">{error}</div>
  const rows = sortedQueue(snapshot?.rows ?? [])
  if (rows.length === 0) return <div className="git-empty"><strong>没有待审查 Agent 变更</strong><p>队列会按冲突、revision、验证、反馈和审批风险排序。</p><button type="button" className="vk-btn" onClick={onRefresh}>刷新</button></div>
  return <section className="git-queue" aria-label="审查队列">{snapshot?.freshness !== 'fresh' && <p className="git-notice">队列为 {snapshot?.freshness}，治理动作已禁用，等待 owner reconcile。</p>}{rows.map(row => <button key={row.queueRef} type="button" className="git-queue-row" onClick={() => { onSelect(row) }}><span><strong>{row.taskLabel ?? row.branch}</strong><br /><span className="git-muted">{row.agentLabel ?? '未关联 Agent'} · {row.branch}</span></span><span className="git-queue-meta">{row.leaseActive ? `lease ${row.leaseRef ?? 'active'}` : '无 lease'}</span><span className="git-queue-meta">{row.reviewedHunkCount}/{row.reviewableHunkCount}</span><span className="git-risk" data-risk={row.risk}>{row.risk}</span></button>)}</section>
}

function HistoryView({ commits, loading, error, onBack, selectedRefs, compareSessionRef, canCompare, onSelect, onCreateCompare }: { readonly commits: readonly GitHistoryCommitV1[]; readonly loading: boolean; readonly error: string | undefined; readonly onBack: () => void; readonly selectedRefs: readonly string[]; readonly compareSessionRef: string | undefined; readonly canCompare: boolean; readonly onSelect: (commit: GitHistoryCommitV1) => void; readonly onCreateCompare: () => void }): ReactNode {
  if (loading) return <div className="git-empty" role="status"><strong>正在读取历史…</strong></div>
  if (error !== undefined) return <div className="git-alert" role="alert">{error}</div>
  if (commits.length === 0) return <div className="git-empty"><strong>历史</strong><p>当前 Git host 尚未提供该视图的数据能力。入口保留，能力接入后会在这里显示真实 owner projection。</p><button type="button" className="vk-btn" onClick={onBack}>返回更改</button></div>
  const selected = commits.filter(commit => selectedRefs.includes(commit.commitRef))
  return <section className="git-history-layout" aria-label="提交历史"><div className="git-history">{commits.map(commit => <button type="button" key={commit.commitRef} className="git-history-row" aria-pressed={selectedRefs.includes(commit.commitRef)} onClick={() => { onSelect(commit) }}><code>{commit.graph}</code><span><strong>{commit.message}</strong><br /><span className="git-muted">{commit.refs.join(' · ')}</span></span><span className="git-history-meta">{commit.author}</span><span className="git-history-meta">+{commit.additions}/-{commit.deletions}</span></button>)}</div><aside className="git-history-inspector"><h3>提交 Inspector</h3>{selected.length === 0 ? <p className="git-muted">选择提交查看详情；选择两个提交可固定 Compare Session。</p> : selected.map(commit => <p key={commit.commitRef}><code>{commit.commitRef.slice(0, 12)}</code><br />{commit.message}<br /><span className="git-muted">{commit.author} · {commit.authoredAt}</span></p>)}<button type="button" className="vk-btn" disabled={!canCompare || selected.length !== 2} onClick={onCreateCompare}>固定比较</button>{compareSessionRef !== undefined && <p className="git-notice">Compare Session {compareSessionRef} 已按 workspace 保存安全 presentation state。</p>}</aside></section>
}

export function GitPane({ host, review, workspaceRef = 'workspace:current', repositories = [], shortcutBindings = resolveGitShortcutBindings() }: GitPaneProps) {
  const reviewAvailable = review?.capability === 'GitReviewEvidenceCapabilityV1'
  const [view, setView] = useState<GitView>(() => reviewAvailable ? 'review' : 'changes')
  const [discoveredRepositories, setDiscoveredRepositories] = useState<readonly GitRepositoryOptionV1[]>([])
  const repositoryOptions = repositories.length > 0 ? repositories : discoveredRepositories
  const [selectedRepository, setSelectedRepository] = useState<GitRepositoryOptionV1 | undefined>(repositories[0])
  const [status, setStatus] = useState<GitStatusV1>(); const [statusWindow, setStatusWindow] = useState<GitStatusWindowV1>(); const [statusCursorStack, setStatusCursorStack] = useState<readonly (string | undefined)[]>([undefined])
  const [error, setError] = useState<string>(); const [loading, setLoading] = useState(true); const [message, setMessage] = useState(''); const [overrideReason, setOverrideReason] = useState(''); const [feedbackText, setFeedbackText] = useState(''); const [busy, setBusy] = useState(false)
  const [diff, setDiff] = useState<GitDiffV1>(); const [diffV2, setDiffV2] = useState<GitDiffWindowV2>(); const [diffLayout, setDiffLayout] = useState<GitDiffLayoutV2>(() => readDiffLayout(workspaceRef)); const [diffLoading, setDiffLoading] = useState(false); const [diffError, setDiffError] = useState<string>(); const [selectedEntry, setSelectedEntry] = useState<GitChangeEntry>(); const [selectedHunk, setSelectedHunk] = useState(0)
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<GitGroup>>(() => new Set(GROUPS.filter(group => group !== 'low_signal'))); const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<string>>(() => new Set())
  const [reviewSnapshot, setReviewSnapshot] = useState<GitReviewEvidenceSnapshotV1>(); const [reviewLoading, setReviewLoading] = useState(reviewAvailable); const [reviewError, setReviewError] = useState<string>()
  const [history, setHistory] = useState<readonly GitHistoryCommitV1[]>([]); const [historyRevision, setHistoryRevision] = useState<string>(); const [historySelection, setHistorySelection] = useState<readonly string[]>([]); const [compareSessionRef, setCompareSessionRef] = useState<string>(); const [historyLoading, setHistoryLoading] = useState(false); const [historyError, setHistoryError] = useState<string>()
  const [preflight, setPreflight] = useState<GitMutationPreflightV2>(); const [pendingIntent, setPendingIntent] = useState<GitMutationIntentV2>(); const [undoReceipt, setUndoReceipt] = useState<GitMutationReceiptV3>()

  const typed = (host.capabilities ?? []).includes('GitTypedActionsCapabilityV1') && host.stage !== undefined && host.unstage !== undefined && host.commit !== undefined
  const grouped = useMemo(() => groupChanges(status?.files ?? []), [status]); const totalChanges = statusWindow?.total ?? status?.files.length ?? 0; const stagedCount = grouped.staged.length
  const repositoryRef = selectedRepository?.repositoryRef ?? status?.repositoryRef; const worktreeRef = selectedRepository?.worktreeRef ?? status?.worktreeRef
  const currentReview = reviewSnapshot?.rows.find(row => row.repositoryRef === repositoryRef && row.worktreeRef === worktreeRef); const agentWorktree = selectedRepository?.agentWorktree === true || currentReview?.agentRef !== undefined
  const readinessReasons = readiness(currentReview, status?.revision, agentWorktree, reviewSnapshot?.freshness === 'fresh'); const governanceDisabled = agentWorktree && (reviewSnapshot?.freshness !== 'fresh' || review === undefined)
  const shortcutEnabled = useCallback((commandId: GitShortcutCommandId): boolean => shortcutBindings.find(binding => binding.commandId === commandId)?.enabled !== false, [shortcutBindings])
  const shortcutConflicts = shortcutBindings.filter(binding => !binding.enabled)

  useEffect(() => {
    if (repositories.length > 0 || host.statusWindow?.repositories === undefined) return
    let current = true
    void host.statusWindow.repositories().then(options => {
      if (!current) return
      const mapped = options.map(option => ({ repositoryRef: option.repositoryRef, worktreeRef: option.worktreeRef, label: option.label, agentWorktree: option.agentWorktree }))
      setDiscoveredRepositories(mapped)
      setSelectedRepository(selected => selected ?? mapped[0])
    }, () => {})
    return () => { current = false }
  }, [host.statusWindow, repositories.length])

  const refresh = useCallback((cursor?: string) => {
    setLoading(true); setError(undefined)
    if (host.statusWindow !== undefined && selectedRepository !== undefined) { void host.statusWindow.snapshot({ repositoryRef: selectedRepository.repositoryRef, worktreeRef: selectedRepository.worktreeRef, limit: PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) }).then(window => { setStatusWindow(window); setStatus(statusFromWindow(window)); setLoading(false) }, caught => { setError(caught instanceof Error ? caught.message : String(caught)); setLoading(false) }); return }
    void host.status().then(next => { setStatus(next); setStatusWindow(undefined); setLoading(false) }, caught => { setError(caught instanceof Error ? caught.message : String(caught)); setLoading(false) })
  }, [host, selectedRepository])
  useEffect(() => { refresh(statusCursorStack.at(-1)) }, [refresh, statusCursorStack])
  useEffect(() => {
    if (host.statusWindow?.subscribe === undefined || selectedRepository === undefined) return
    // G21 dispose 收口：窗口订阅收纳进具名 unsubscribe 句柄，cleanup 显式释放。
    const subscription = { unsubscribe: host.statusWindow.subscribe({ repositoryRef: selectedRepository.repositoryRef, worktreeRef: selectedRepository.worktreeRef }, event => {
      if (event.kind === 'changed' && (statusWindow === undefined || event.sequence === statusWindow.sequence + 1)) refresh(statusCursorStack.at(-1))
      else setStatus(current => current === undefined ? current : { ...current, freshness: 'stale' })
    }) }
    return () => { subscription.unsubscribe() }
  }, [host.statusWindow, refresh, selectedRepository, statusCursorStack, statusWindow])

  const refreshReview = useCallback(() => { if (review === undefined) return; setReviewLoading(true); setReviewError(undefined); void review.snapshot({ workspaceRef, limit: PAGE_LIMIT }).then(next => { setReviewSnapshot(next); setReviewLoading(false) }, caught => { setReviewError(caught instanceof Error ? caught.message : String(caught)); setReviewLoading(false) }) }, [review, workspaceRef])
  useEffect(() => { refreshReview() }, [refreshReview])
  useEffect(() => {
    if (review?.subscribe === undefined) return
    // G21 dispose 收口：审查队列订阅收纳进具名 unsubscribe 句柄，cleanup 显式释放。
    const subscription = { unsubscribe: review.subscribe({ workspaceRef }, event => {
      if (event.kind === 'changed' && (reviewSnapshot === undefined || event.sequence === reviewSnapshot.sequence + 1)) refreshReview()
      else setReviewSnapshot(current => current === undefined ? current : { ...current, freshness: 'stale' })
    }) }
    return () => { subscription.unsubscribe() }
  }, [refreshReview, review, reviewSnapshot, workspaceRef])
  useEffect(() => { if (view !== 'history' || host.historyWindow === undefined || repositoryRef === undefined || worktreeRef === undefined) return; setHistoryLoading(true); setHistoryError(undefined); void host.historyWindow.window({ repositoryRef, worktreeRef, limit: PAGE_LIMIT }).then(window => { setHistory(window.commits); setHistoryRevision(window.revision); setHistoryLoading(false) }, caught => { setHistoryError(caught instanceof Error ? caught.message : String(caught)); setHistoryLoading(false) }) }, [host.historyWindow, repositoryRef, view, worktreeRef])
  const createCompare = async (): Promise<void> => {
    if (host.compareSession === undefined || repositoryRef === undefined || worktreeRef === undefined || historyRevision === undefined || historySelection.length !== 2) return
    try {
      const selected = history.filter(commit => historySelection.includes(commit.commitRef))
      if (selected.length !== 2) return
      const session = await host.compareSession.create({ repositoryRef, worktreeRef, baseRef: selected[1]!.commitRef, targetRef: selected[0]!.commitRef, revision: historyRevision, layout: diffLayout, pinned: true })
      setCompareSessionRef(session.sessionRef)
      writePreference(`dsh.git.compare:${workspaceRef}`, JSON.stringify({ sessionRef: session.sessionRef, repositoryRef: session.repositoryRef, worktreeRef: session.worktreeRef, baseRef: session.baseRef, targetRef: session.targetRef, revision: session.revision, layout: session.layout, pinned: session.pinned }))
    } catch (caught) { setHistoryError(caught instanceof Error ? caught.message : String(caught)) }
  }

  const runV1 = useCallback(async (action: () => Promise<GitMutationReceiptV1>): Promise<boolean> => { setBusy(true); setError(undefined); try { const receipt = await action(); if (receipt.status !== 'ok') { setError(receipt.reason ?? `${receipt.actionId} 未完成`); return false }; refresh(); return true } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); return false } finally { setBusy(false) } }, [refresh])

  const openDiff = useCallback((entry: GitChangeEntry, layout: GitDiffLayoutV2 = diffLayout) => {
    setSelectedEntry(entry); setDiff(undefined); setDiffV2(undefined); setDiffError(undefined); setSelectedHunk(0)
    if (host.diffWindowV2 !== undefined && repositoryRef !== undefined && worktreeRef !== undefined && entry.file.fileRef !== undefined) { setDiffLoading(true); void host.diffWindowV2.window({ repositoryRef, worktreeRef, fileRef: entry.file.fileRef, layout, limit: PAGE_LIMIT }).then(next => { setDiffV2(next); setDiffLoading(false) }, caught => { setDiffError(caught instanceof Error ? caught.message : String(caught)); setDiffLoading(false) }); return }
    const read = entry.scope === 'staged' ? host.diffStaged : host.diff
    if (read === undefined || entry.group === 'untracked') { setDiffError(entry.group === 'untracked' ? '未跟踪文件暂不支持差异预览。' : '当前 Git host 尚未提供已暂存差异。'); return }
    setDiffLoading(true); void read.call(host, entry.file.path).then(next => { setDiff(next); setDiffLoading(false) }, caught => { setDiffError(caught instanceof Error ? caught.message : String(caught)); setDiffLoading(false) })
  }, [diffLayout, host, repositoryRef, worktreeRef])

  const changeLayout = (layout: GitDiffLayoutV2): void => { setDiffLayout(layout); writePreference(`dsh.git.diff-layout:${workspaceRef}`, layout); if (selectedEntry !== undefined) openDiff(selectedEntry, layout) }
  const dispatchReview = async (intent: Parameters<NonNullable<GitReviewEvidenceCapabilityV1['dispatch']>>[0]): Promise<GitReviewActionReceiptV1 | undefined> => { if (review?.dispatch === undefined || governanceDisabled) return undefined; setBusy(true); try { const receipt = await review.dispatch(intent); if (receipt.status !== 'ok') setError(receipt.reason ?? `${receipt.action} 未完成`); else refreshReview(); return receipt } finally { setBusy(false) } }
  const requestPreflight = async (intent: GitMutationIntentV2): Promise<void> => { if (host.mutationActionsV2 === undefined) return; setBusy(true); setError(undefined); try { const next = await host.mutationActionsV2.preflight(intent); setPendingIntent(intent); setPreflight(next) } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) } finally { setBusy(false) } }
  const confirmPreflight = useCallback(async (): Promise<void> => {
    if (host.mutationActionsV2 === undefined || pendingIntent === undefined || preflight?.allowed !== true) return
    setBusy(true)
    try {
      const reason = overrideReason.trim()
      if (pendingIntent.action === 'commit.preflight' && reason !== '' && review?.dispatch !== undefined && currentReview !== undefined) {
        const override = await review.dispatch({ action: 'commit.override', repositoryRef: currentReview.repositoryRef, worktreeRef: currentReview.worktreeRef, expectedRevision: currentReview.revision, idempotencyKey: safeId('override'), reason })
        if (override.status !== 'ok') { setError(override.reason ?? 'Ordo 未接受提交覆盖证据'); return }
      }
      const action = pendingIntent.action === 'commit.preflight' ? 'commit.execute' : pendingIntent.action === 'discard.preflight' ? 'discard.execute' : pendingIntent.action
      const receipt = await host.mutationActionsV2.execute({ ...pendingIntent, action, previewDigest: preflight.previewDigest, ...(reason === '' ? {} : { overrideReason: reason }) })
      if (receipt.status !== 'ok') { setError(receipt.reason ?? `${receipt.action} 未完成`); return }
      if (receipt.action === 'discard.undo') setUndoReceipt(undefined)
      else if (receipt.backupRef !== undefined) setUndoReceipt(receipt)
      setPreflight(undefined); setPendingIntent(undefined); if (receipt.action === 'commit.execute') setMessage(''); refresh(); refreshReview()
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) } finally { setBusy(false) }
  }, [currentReview, host.mutationActionsV2, overrideReason, pendingIntent, preflight, refresh, refreshReview, review])

  useEffect(() => { const onKey = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g' && shortcutEnabled('git.open')) { event.preventDefault(); setView(reviewAvailable ? 'review' : 'changes') }
    if (event.key === 'F7' && shortcutEnabled(event.shiftKey ? 'git.diff.previous' : 'git.diff.next')) { event.preventDefault(); const count = diffV2?.hunks.length ?? 0; setSelectedHunk(current => Math.max(0, Math.min(count - 1, current + (event.shiftKey ? -1 : 1)))) }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && preflight?.allowed === true && shortcutEnabled('git.preflight.confirm')) { event.preventDefault(); void confirmPreflight() }
  }; window.addEventListener('keydown', onKey); return () => { window.removeEventListener('keydown', onKey) } }, [confirmPreflight, diffV2?.hunks.length, preflight?.allowed, reviewAvailable, shortcutEnabled])

  const toggleGroup = (group: GitGroup): void => { setExpandedGroups(current => { const next = new Set(current); if (next.has(group)) next.delete(group); else next.add(group); return next }) }
  const toggleFolder = (key: string): void => { setExpandedFolders(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  const renderFile = (node: GitTreeFile, depth: number): ReactNode => {
    const entry = node.entry; const selected = selectedEntry?.key === entry.key; const canReadDiff = entry.group !== 'untracked' && (host.diffWindowV2 !== undefined || (entry.scope === 'staged' ? host.diffStaged !== undefined : host.diff !== undefined)); const canGovern = !busy && !governanceDisabled && status?.freshness !== 'stale' && status?.freshness !== 'offline'
    return <div key={node.key} className="git-file-row" role="treeitem" data-selected={selected} style={{ '--git-depth': depth } as CSSProperties}><span /><button type="button" className="git-file-main" title={entry.file.path} onClick={() => { openDiff(entry) }}><span className="git-file-name">{node.name}</span>{node.parent !== '' && <span className="git-parent">{node.parent}</span>}</button><span className="git-row-end"><span className="git-status-token" data-status={entry.status} title={statusLabel(entry.status)}>{statusToken(entry.status)}</span><span className="git-row-actions"><button type="button" className="git-action" disabled={!canReadDiff} onClick={() => { openDiff(entry) }}>差异</button>{typed && entry.group !== 'staged' && <button type="button" className="git-action" disabled={!canGovern} onClick={() => { void runV1(() => host.stage!(entry.file.path)) }}>暂存</button>}{typed && entry.group === 'staged' && <button type="button" className="git-action" disabled={!canGovern} onClick={() => { void runV1(() => host.unstage!(entry.file.path)) }}>取消暂存</button>}{host.mutationActionsV2?.actions.includes('discard.preflight') === true && entry.file.fileRef !== undefined && entry.scope === 'worktree' && entry.status !== 'untracked' && repositoryRef !== undefined && worktreeRef !== undefined && <button type="button" className="git-action" disabled={!canGovern} onClick={() => { void requestPreflight({ action: 'discard.preflight', repositoryRef, worktreeRef, expectedRevision: status?.revision ?? 'revision:unknown', fileRefs: [entry.file.fileRef!], idempotencyKey: safeId('discard') }) }}>丢弃</button>}</span></span></div>
  }

  const groups = GROUPS.filter(group => grouped[group].length > 0)
  const resourceView = view === 'branches' || view === 'worktrees' || view === 'remotes' || view === 'stashes' || view === 'tags' ? view : undefined

  return <Surface kind="workspace" data-dsh-git-pane data-git-capability={host.mutationActionsV2 !== undefined ? 'review-workbench' : typed ? 'typed' : 'status-only'}><style>{gitPaneStyles}</style>
    <SurfaceContextBar
      className="git-header"
      title="Git 工作区"
      context={status?.branch ?? '正在读取分支…'}
      status={<span className="git-context-meta"><span className="git-context-count">{totalChanges} 更改 · {stagedCount} 已暂存</span><span className="git-freshness" data-freshness={status?.freshness ?? 'legacy'}>{status?.freshness ?? 'legacy'}</span></span>}
      actions={<><label className="ys-field git-context">{repositoryOptions.length > 0 ? <select aria-label="仓库与工作树" value={selectedRepository === undefined ? '' : `${selectedRepository.repositoryRef}|${selectedRepository.worktreeRef}`} onChange={event => { const next = repositoryOptions.find(item => `${item.repositoryRef}|${item.worktreeRef}` === event.target.value); setSelectedRepository(next); setStatusCursorStack([undefined]); setSelectedEntry(undefined) }}>{repositoryOptions.map(item => <option key={`${item.repositoryRef}:${item.worktreeRef}`} value={`${item.repositoryRef}|${item.worktreeRef}`}>{item.label}</option>)}</select> : <span className="git-summary">当前仓库</span>}</label><Button type="button" size="sm" variant="toolbar" aria-label="刷新 Git 状态" disabled={busy || loading} onClick={() => { refresh(); refreshReview() }}>刷新</Button></>}
    />
    <GitViewSwitcher view={view} reviewAvailable={reviewAvailable} onChange={setView} /><div className="git-view">
      {view === 'review' && <ReviewQueueView snapshot={reviewSnapshot} loading={reviewLoading} error={reviewError} onRefresh={refreshReview} onSelect={row => { const option = repositoryOptions.find(item => item.repositoryRef === row.repositoryRef && item.worktreeRef === row.worktreeRef) ?? { repositoryRef: row.repositoryRef, worktreeRef: row.worktreeRef, label: row.branch, agentWorktree: true }; setSelectedRepository(option); setView('changes') }} />}
      {view === 'history' && <HistoryView commits={history} loading={historyLoading} error={historyError} onBack={() => { setView('changes') }} selectedRefs={historySelection} compareSessionRef={compareSessionRef} canCompare={host.compareSession !== undefined} onSelect={commit => { setHistorySelection(current => current.includes(commit.commitRef) ? current.filter(ref => ref !== commit.commitRef) : [commit.commitRef, ...current].slice(0, 2)) }} onCreateCompare={() => { void createCompare() }} />}
      {resourceView !== undefined && <GitResourceView view={resourceView} status={status} repositoryOptions={repositoryOptions} selectedRepository={selectedRepository} branchActions={host.branchActions} remoteActions={host.remoteActions} worktreeActions={host.worktreeActions} stashProjection={host.stashProjection} stashActions={host.stashActions} tagProjection={host.tagProjection} tagActions={host.tagActions} totalChanges={totalChanges} onSelectRepository={next => { setSelectedRepository(next); setStatusCursorStack([undefined]); setSelectedEntry(undefined) }} onBack={() => { setView('changes') }} />}
      {view === 'changes' && <section className="git-changes-view">{stagedCount > 0 && <form className="git-composer" onSubmit={event => { event.preventDefault(); const trimmed = message.trim(); if (trimmed === '' || stagedCount === 0) return; if (host.mutationActionsV2 !== undefined && repositoryRef !== undefined && worktreeRef !== undefined) { const reason = overrideReason.trim(); if (readinessReasons.length > 0 && reason === '') return; void requestPreflight({ action: 'commit.preflight', repositoryRef, worktreeRef, expectedRevision: status?.revision ?? 'revision:unknown', idempotencyKey: safeId('commit'), message: trimmed, ...(reason === '' ? {} : { overrideReason: reason }) }); return }; if (typed && host.commit !== undefined) void runV1(() => host.commit!(trimmed)).then(ok => { if (ok) setMessage('') }) }}><label className="git-message ys-field"><span>提交说明</span><input value={message} placeholder="描述本次更改" aria-label="提交说明" disabled={busy || (!typed && host.mutationActionsV2 === undefined)} onChange={event => { setMessage(event.target.value) }} /></label><Button type="submit" size="sm" variant="primary" disabled={busy || message.trim() === '' || (readinessReasons.length > 0 && overrideReason.trim() === '')}>提交 {stagedCount}</Button></form>}
        <div className="git-bulk"><button type="button" className="git-action" disabled={host.mutationActionsV2 === undefined || repositoryRef === undefined || worktreeRef === undefined || governanceDisabled} onClick={() => { void requestPreflight({ action: 'stage.all', repositoryRef: repositoryRef!, worktreeRef: worktreeRef!, expectedRevision: status?.revision ?? 'revision:unknown', idempotencyKey: safeId('stage-all') }) }}>全部暂存 {grouped.changes.length + grouped.untracked.length}</button><button type="button" className="git-action" disabled={host.mutationActionsV2 === undefined || stagedCount === 0 || governanceDisabled || repositoryRef === undefined || worktreeRef === undefined} onClick={() => { void requestPreflight({ action: 'unstage.all', repositoryRef: repositoryRef!, worktreeRef: worktreeRef!, expectedRevision: status?.revision ?? 'revision:unknown', idempotencyKey: safeId('unstage-all') }) }}>全部取消暂存 {stagedCount}</button>{statusWindow !== undefined && <><button type="button" className="git-action" disabled={statusCursorStack.length <= 1} onClick={() => { setStatusCursorStack(current => current.slice(0, -1)) }}>上一页</button><button type="button" className="git-action" disabled={statusWindow.nextCursor === undefined} onClick={() => { setStatusCursorStack(current => [...current, statusWindow.nextCursor]) }}>下一页</button><span className="git-muted">{statusWindow.loaded}/{statusWindow.total}</span></>}</div>
        {shortcutConflicts.length > 0 && <div className="git-notice">快捷键冲突：{shortcutConflicts.map(binding => `${binding.key} → ${binding.conflictWith ?? 'unknown'}`).join('；')}。冲突 binding 已禁用，请在 registry 中重映射。</div>}
        {currentReview?.agentRef !== undefined && <div className="git-notice">Agent {currentReview.agentLabel ?? currentReview.agentRef} 当前{currentReview.paused ? '已暂停' : '运行中'}。<button type="button" className="git-action" disabled={governanceDisabled || review?.dispatch === undefined} onClick={() => { if (repositoryRef !== undefined && worktreeRef !== undefined) void dispatchReview({ action: currentReview.paused ? 'agent.resume' : 'agent.pause', repositoryRef, worktreeRef, expectedRevision: currentReview.revision, idempotencyKey: safeId(currentReview.paused ? 'resume' : 'pause') }) }}>{currentReview.paused ? '恢复' : '暂停'}</button></div>}
        {readinessReasons.length > 0 && <div className="git-notice"><strong>Agent 提交门禁：</strong>{readinessReasons.join('、')}。<input className="git-override" aria-label="覆盖理由" placeholder="填写可审计覆盖理由" value={overrideReason} onChange={event => { setOverrideReason(event.target.value) }} /></div>}{undoReceipt?.backupRef !== undefined && <div className="git-notice">已创建可恢复备份 {undoReceipt.backupRef}，截止 {undoReceipt.undoExpiresAt ?? 'owner 清理前'}。<button type="button" className="git-action" onClick={() => { const backupRef = undoReceipt.backupRef; if (host.mutationActionsV2 !== undefined && repositoryRef !== undefined && worktreeRef !== undefined && backupRef !== undefined) void requestPreflight({ action: 'discard.undo', repositoryRef, worktreeRef, expectedRevision: status?.revision ?? 'revision:unknown', backupRef, idempotencyKey: safeId('undo') }) }}>撤销</button></div>}
        <div className="git-content" data-has-diff={selectedEntry !== undefined}><div className="git-master">{!typed && host.mutationActionsV2 === undefined && <SurfaceState className="git-alert" phase="disabled" title="当前仅支持查看状态。" description="暂存、取消暂存和提交需要 GitTypedActionsCapabilityV1。" data-dsh-git-contract />}{governanceDisabled && <SurfaceState className="git-notice" phase="disabled" title="Ordo 离线" description="Git 与差异仍可查看，reviewed、feedback、Pause/Resume、Commit 和 Discard 已禁用。" />}{status?.freshness === 'stale' && <SurfaceState className="git-notice" phase="stale" title="状态窗口已 stale" description="保留最后安全内容并禁用 mutation，等待 reconcile。" />}{loading && groups.length === 0 && <SurfaceState className="git-empty" phase="loading" title="正在读取 Git 状态…" />}{error !== undefined && groups.length === 0 && <SurfaceState className="git-alert" phase="error" title={error} />}{!loading && error === undefined && groups.length === 0 && <SurfaceState className="git-empty" phase="empty" title="工作区干净" description="当前分支没有待提交更改。" action={<Button type="button" size="sm" variant="toolbar" onClick={() => { refresh() }}>刷新</Button>} />}{groups.map(group => { const entries = grouped[group]; const expanded = expandedGroups.has(group); const useTree = entries.length > AUTO_TREE_THRESHOLD; const nodes = useTree ? buildTree(entries) : entries.map(entry => ({ kind: 'file', key: entry.key, name: basename(entry.file.path), parent: parentPath(entry.file.path), entry }) satisfies GitTreeFile); return <section key={group} className="git-group" data-git-group={group}><button type="button" className="git-group-heading" aria-expanded={expanded} onClick={() => { toggleGroup(group) }}><span className="git-disclosure">▾</span><span className="git-group-name">{GROUP_LABEL[group]}</span><span className="git-count">{entries.length}</span></button>{expanded && <div className="git-tree" role="tree" aria-label={GROUP_LABEL[group]} data-tree-mode={useTree ? 'tree' : 'list'}><TreeNodes nodes={nodes} depth={0} expandedFolders={expandedFolders} onToggleFolder={toggleFolder} renderFile={renderFile} /></div>}</section> })}</div>
          <aside className="git-detail" aria-label="Git 差异">{selectedEntry === undefined ? <div className="git-empty"><strong>选择一个文件查看差异</strong></div> : <><header className="git-detail-header"><button type="button" className="git-action git-back" onClick={() => { setSelectedEntry(undefined); setDiff(undefined); setDiffV2(undefined); setDiffError(undefined) }}>返回</button><span className="git-detail-title">{selectedEntry.file.path}</span><span className="git-status-token" data-status={selectedEntry.status}>{statusToken(selectedEntry.status)}</span></header><div className="git-diff-toolbar"><button type="button" className="git-action" aria-pressed={diffLayout === 'unified'} onClick={() => { changeLayout('unified') }}>单栏</button><button type="button" className="git-action" aria-pressed={diffLayout === 'side_by_side'} onClick={() => { changeLayout('side_by_side') }}>对照</button><span className="git-muted">F7 / Shift+F7</span>{diffV2 !== undefined && review?.dispatch !== undefined && <><input aria-label="审查反馈" placeholder="给 Agent 的修改反馈" value={feedbackText} onChange={event => { setFeedbackText(event.target.value) }} /><button type="button" className="git-action" disabled={governanceDisabled || feedbackText.trim() === '' || diffV2.hunks[selectedHunk] === undefined} onClick={() => { const hunk = diffV2.hunks[selectedHunk]; const summary = feedbackText.trim(); if (hunk !== undefined && summary !== '') void dispatchReview({ action: 'feedback.create', repositoryRef: diffV2.repositoryRef, worktreeRef: diffV2.worktreeRef, expectedRevision: diffV2.currentRevision, idempotencyKey: safeId('feedback'), fileRef: diffV2.fileRef, hunkRef: hunk.hunkRef, summary }).then(() => { setFeedbackText('') }) }}>发送反馈</button></>}</div>{diffLoading && <div className="git-empty" role="status"><strong>正在读取差异…</strong></div>}{diffError !== undefined && <div className="git-alert" role="alert">{diffError}</div>}{diffV2?.secretRisk === 'secret_suspected' && <div className="git-alert">疑似 credential：未经确认不得分享或导出，diff 原文不会写入日志或持久化。</div>}{!diffLoading && diffError === undefined && diffV2 !== undefined && <div className="git-diff">{diffV2.binary ? <div className="git-empty"><strong>二进制文件</strong><p>使用 owner 提供的安全预览或外部打开动作。</p></div> : diffV2.hunks.map((hunk, index) => <section key={hunk.hunkRef} className="git-hunk" data-selected={selectedHunk === index}><header className="git-hunk-header"><code>{hunk.header}</code>{review?.dispatch !== undefined && <button type="button" className="git-action" disabled={governanceDisabled || diffV2.targetRevision !== diffV2.currentRevision} onClick={() => { void dispatchReview({ action: 'review.hunk', repositoryRef: diffV2.repositoryRef, worktreeRef: diffV2.worktreeRef, expectedRevision: diffV2.currentRevision, idempotencyKey: safeId('review'), fileRef: diffV2.fileRef, hunkRef: hunk.hunkRef }) }}>标记已审查</button>}</header>{hunk.lines.map((line, lineIndex) => <span key={`${hunk.hunkRef}:${lineIndex}`} className="git-diff-line" data-line={diffLineKind(line)}>{line}{'\n'}</span>)}</section>)}</div>}{!diffLoading && diffError === undefined && diff !== undefined && <pre className="git-diff" data-dsh-git-diff>{diff.patch === '' ? <span className="git-diff-line" data-line="context">{diff.path} 没有可显示的差异。</span> : diff.patch.split('\n').map((line, index) => <span key={`${index}:${line}`} className="git-diff-line" data-line={diffLineKind(line)}>{line}{'\n'}</span>)}{diff.truncated && <span className="git-notice">差异过大，当前仅显示已加载部分。</span>}</pre>}</>}</aside></div>
      </section>}
    </div>{preflight !== undefined && <aside className="git-preflight" aria-label="Git 操作预检"><h3>操作预检</h3><dl><dt>动作</dt><dd>{preflight.action}</dd><dt>目标</dt><dd>{preflight.targetCount}</dd><dt>分支</dt><dd>{preflight.branch}</dd><dt>作者</dt><dd>{preflight.author ?? 'repository config'}</dd><dt>签名</dt><dd>{preflight.signing}</dd><dt>Hooks</dt><dd>{preflight.hooks}</dd><dt>验证</dt><dd>{preflight.verification}</dd><dt>Digest</dt><dd>{preflight.previewDigest}</dd><dt>风险</dt><dd>{preflight.risks.join('、') || '无'}</dd></dl>{preflight.reason !== undefined && <p className="git-alert">{preflight.reason}</p>}<div className="git-preflight-actions"><button type="button" className="vk-btn" onClick={() => { setPreflight(undefined); setPendingIntent(undefined) }}>取消</button><button type="button" className="vk-btn" data-primary="true" disabled={!preflight.allowed || busy} onClick={() => { void confirmPreflight() }}>确认</button></div></aside>}
  </Surface>
}

export default GitPane
