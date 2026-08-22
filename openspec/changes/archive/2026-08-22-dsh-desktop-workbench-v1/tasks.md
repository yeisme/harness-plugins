## M0：底座与合规

- [x] 0.1 [Owner: Harness Plugins；Scope: OpenSpec] 创建 `dsh-desktop-workbench-v1` proposal/design/tasks/spec。Acceptance: `openspec validate dsh-desktop-workbench-v1 --strict --no-interactive` 通过；Validation: `openspec validate dsh-desktop-workbench-v1 --strict --no-interactive`。
- [x] 0.2 [Owner: Harness Plugins；Scope: `packages/host/dsh-session-manager/`] 初始化 host package 骨架：package.json、tsconfig、src/index.ts、tests。Acceptance: typecheck/test/build 通过；Validation: `pnpm --filter @yeisme/dsh-session-manager run typecheck && pnpm --filter @yeisme/dsh-session-manager run test && pnpm --filter @yeisme/dsh-session-manager run build`。
- [x] 0.3 [Owner: Harness Plugins；Scope: `packages/host/dsh-file-host/`] 初始化 file host 骨架。Acceptance: typecheck/test/build 通过；Validation: 同上 filter。
- [x] 0.4 [Owner: Harness Plugins；Scope: `packages/host/dsh-terminal-host/`] 初始化 terminal host 骨架。Acceptance: typecheck/test/build 通过；Validation: 同上 filter。
- [x] 0.5 [Owner: Harness Plugins；Scope: `packages/client/ui-desktop-workbench/`] 初始化 client package 骨架与 Session Sidebar 占位。Acceptance: typecheck/test/build 通过；Validation: `pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run typecheck && pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run test && pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run build`。
- [x] 0.6 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-desktop-workbench/`] 初始化 bundle：package.json、cordis.patch.yml、README、src。Acceptance: `dsh --profile web --dump-config` 可看到贡献；Validation: 本地 profile conformance。
- [x] 0.7 [Owner: Harness Plugins；Scope: THIRD_PARTY_NOTICES] 新增 `THIRD_PARTY_NOTICES.md`，记录 dsh-session-manager/dsh-codex-ui/dsh-archive-manager/dsh-notify-center/dsh-task-notify 的复制来源与 License。Acceptance: 每个来源都有名称、URL、License；Validation: `git diff --check`。
- [x] 0.8 [Owner: Harness Plugins；Scope: source-independence] 为所有新 package 增加 source-independence scan，禁止 import 社区包/私有 API。Acceptance: 负向 fixture 失败、正常包通过；Validation: 各 package test。

## M1：会话管理可用

- [x] 1.1 Session Sidebar 接入 `SessionManagerHostV1` seam adapter；真实 DSH `useSessions`/`useWorkspaces`/`ctx.*` 接线在 M5 本地 profile 验证。
- [x] 1.2 完成列表、搜索、工作区分组、未读、归档/回收站、继续/暂停/fork UI 与 host 合同。
- [x] 1.3 完成 `SessionLabelsEventV1` 数据模型与事件创建 helper；真实 DSH host 写入在 M5 接线。
- [x] 1.4 增加 SessionSidebar 与 host adapter focused tests；demo 在 M4/M5 补齐。

## M2：文件树与预览可用

- [x] 2.1 完成 `FileEntryV1` 目录树组件与文件选择（复用 `@yeisme/dsh-file-document` FileDocumentPanel + useFileTree）。
- [x] 2.2 完成文本/图片预览；PDF iframe/Office 占位降级（FileDocumentPanel 已支持）。
- [x] 2.3 接入 Workbench Core shell 与 ComposedDesktopWorkbench；Pane open routing 在 M4 统一接入。
- [x] 2.4 增加 FilePane 与 ComposedDesktopWorkbench component tests；demo 在 M4/M5 补齐。

## M3：终端可用

- [x] 3.1 接入 `TerminalHostV1` seam + `TerminalPane` UI；真实 DSH terminal seam/xterm 接线在 M5 本地 profile 验证。
- [x] 3.2 完成多 Tab、关闭、输入、运行/退出状态展示；detach/reconnect/replay 在 M5 接入真实 PTY 后验证。
- [x] 3.3 增加 TerminalPane/ComposedDesktopWorkbench focused tests；真实 integration 在 M5。

## M4：多 Pane 与事件整合

- [x] 4.1 通过 `createDesktopWorkbenchRegistry` 注册 Session/File/Terminal/Media/Notification/Search 模块。
- [x] 4.2 新增 `apply()` 通过官方 `shell.overlay` slot 装配 ComposedDesktopWorkbench。
- [x] 4.3 完成 NotificationCenter 与 GlobalSearch；跨 Pane artifact handoff 使用现有 `@yeisme/dsh-pane-protocol` 合同，UI 接线在 M5 真实 profile 验证。
- [x] 4.4 本 change 涉及的新 package typecheck/test/build 全部通过。

## M5：真实 DSH Profile 与发布

- [x] 5.1 在隔离真实 `dsh web` profile 安装 bundle 并通过 Web boot；Playwright 浏览器场景因当前 checkout 无 runner 延后。
- [x] 5.2 已写入 `temp/integration-test-runs/2026-08-19T03-13-00-000Z-000000-dsh-desktop-workbench-m5-boot/`。
- [x] 5.3 完成 README、OpenSpec strict validate 与 `pnpm pack --dry-run`。
