# long-term-history-global-search

Session 长期历史与全局搜索的上游 handoff 系列（notes-only，无源码 patch）。

- 内容：`.agents/notes/proposed/architecture/2026-08-17-long-term-history-global-search-architecture.md`（Persistence、Session Query、document registry、label service、`history.*`、index generation、migration/rollback）
- 内容：`.agents/notes/proposed/feature/2026-08-17-history-search-client-plugins.md`（Web/TUI/CLI 体验 handoff）
- 基线：upstream/master `b150a551b8d`（dsh 0.1.1-rc.2）
- Apply：`./apply.sh <deepseek-harness-checkout>`
- Verify（staging worktree 内）：`pnpm run verify-agent-note-format && pnpm run verify-translation-pairing && pnpm run verify-md-wrap`
- Status: draft（来源 openspec change `dsh-long-term-history-global-search-v1`，fork-ready 待 verify 全绿后登记分支与 compare）
