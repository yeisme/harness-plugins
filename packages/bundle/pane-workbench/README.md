# @yeisme/dsh-pane-workbench

可安装的 DSH Web profile bundle，提供安全的 Pane Workbench overlay。它只通过官方
`shell.overlay` list slot 装载其 thin `./client` face（实现仍在
`@yeisme/dsh-client-ui-pane-workbench`），不修改 DSH
核心，不占用 `sidebar`、`conversation` 或 `details`，也不读取或 patch Web Shell DOM。

## 安装与移除

```sh
dsh plugin --profile web add @yeisme/dsh-pane-workbench
dsh --profile web --dump-config
dsh plugin --profile web remove @yeisme/dsh-pane-workbench
```

本地 checkout 可以使用：

```sh
dsh plugin --profile web add ./packages/bundle/pane-workbench
```

移除 bundle 会同时移除 profile row；client disposer 会 orphan-recover 已存在的
view，并清理 overlay、drag/resize session 与 listeners。它不会删除 canonical
session/task/run 数据，也不会执行任何 owner mutation。

## 当前能力

- Right/Bottom 两个可收起 region，窄容器投影为单组 sheet；canonical layout 在
  wide/compact/sheet 往返中保持不变。
- local-only component factory、capability gating、safe typed projection 与
  provider unload 后的 orphaned recovery。
- Tab keyboard/pointer interaction、resize preview、persistence redaction 和
  lifecycle cleanup。

## 快捷操作、inspect 与排障

- Tab/Arrow/Home/End 导航 Tab，Enter/Space 激活；Delete 关闭并将焦点回到邻近 Tab。
- Shift+F10 打开菜单，`Move by Keyboard` 使用方向键、Enter、Escape，并发送可访问播报。
- 指针拖拽支持同组排序和 Right/Bottom edge docking；Escape、blur、pointer cancel、HMR
  和卸载都会取消未完成会话。
- Divider 支持 pointer preview 与键盘 1%/5%/Home/End 调整；`Reset Layout` 恢复受限默认布局。
- inspect 只能由 Host 以 opaque resource ref、owner version 和 safe typed view intent
  打开；pane 不持有 domain facts，也不发起 mutation。

排障时先运行 `dsh --profile web --dump-config` 确认只有一个 `shell.overlay` row，
再运行 client package 的 typecheck/test/build 与本 bundle 的 conformance test。浏览器
DOM/ARIA、HMR 和 keyboard-only 验收必须使用官方 DSH browser runner；本地 Loader boot、
jsdom 或静态 dump 不能替代该证据。

## Canary handoff（local evidence）

当前 canary 使用 DSH `0.1.0-rc.6` peer 范围，bundle 为
`@yeisme/dsh-pane-workbench@0.1.0-rc.1`。profile conformance 证据写入
`temp/integration-test-runs/2026-08-18T03-14-18-763Z-3394468-pane-profile/summary.json`，
覆盖 packed members、install/dump、真实 Web Loader boot 和 remove rollback；它不代表
browser DOM/ARIA、生产部署或发布 authority。

已知 trade-off：当前只接入官方 `shell.overlay`，不占用 sidebar/conversation/details；
File/Git/Terminal provider、push-docking/additive dock slot、真实 browser Playwright
和 DSH Host revoked-PTY/remote lifecycle 仍等待对应 owner contract。下一批 view provider
必须沿用 safe typed registry、capability gate、disposer 和 orphan recovery，不得通过
DOM patch、任意 iframe 或第二 domain store 绕过 blocker。

File/Git/Terminal provider、真实 browser Playwright、push-docking/additive slot
以及 DSH Host revoked-PTY/remote lifecycle 不由此 bundle 伪造；需要对应 provider
或 DSH owner 的公开合同后再接入。
