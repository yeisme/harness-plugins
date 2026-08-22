# @yeisme/dsh-pane-workbench

可安装的 DSH Web profile bundle，为 DSH 提供共享 Right/Bottom Pane Workbench。

它通过 `shell.workspace.right`、`shell.workspace.bottom` 和 `ctx.workspaceLayout` 参与
AppFrame 正式布局；不注册生产 `shell.overlay`，不覆盖 canonical 左侧会话栏，也不占用
`conversation`、`details` 或第二套 sidebar。工作区最大化只发生在左侧栏右边的主区域。

`./client` 由 `tsdown` 构建为 DSH client-modules 所需的
`window.__ModuleLoader__.load({ id: "@yeisme/dsh-pane-workbench", factory })` 格式，并把
`@yeisme/*` 实现内联、仅 external 平台包。

插件完成门是协议对接：探测 workspace slot / `workspaceLayout`，缺席时失败可见。官方 `dsh plugin add` 与 Web boot 是可选 host 集成，不作为本包测试门。

## 安装与移除

```bash
dsh plugin --profile web add @yeisme/dsh-pane-workbench
dsh --profile web --dump-config
dsh plugin --profile web remove @yeisme/dsh-pane-workbench
```

本地 checkout：

```bash
dsh plugin --profile web add ./packages/bundle/pane-workbench
```

卸载会释放两个 workspace slot、唯一 layout handle、drag coordinator、session/persistence
订阅与 client service。右侧 44px 轨道和所有布局预留应完全消失；canonical session、task、
run 与 domain 数据不会被删除。

## 当前能力

- 首次安装 Right/Bottom 均收起；外部 `openView()` 自动展开目标 region。
- Right/Bottom 共用 controller/store，支持 Tab 重排、跨区移动、边缘 split、resize、
  最大化、恢复、撤销和 orphaned provider 恢复。
- 轨道只显示已打开视图；`+` 提供 view selector，不常驻七个固定模块。
- split 深度最大 2、可见 group 最大 4、Pane 最小 280×180px。
- V2 persistence 保存安全布局；V1 自动迁移并丢弃 overlay/maximized 临时字段。
- DSH seam 不足时明确报告兼容错误，禁止回退到覆盖左侧栏的旧 overlay。

## 开发与证据

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test
pnpm --filter @yeisme/dsh-pane-workbench run build
pnpm --filter @yeisme/dsh-pane-workbench run test
```

本包测试只验 pack、ModuleLoader 面与 workspace slot 绑定，证据写入
`temp/integration-test-runs/<run-id>/`。官方 `dsh plugin add` / Web boot / browser
runner 是可选 host 集成，不作为本包完成门。

排障时先确认 DSH layout 暴露 `shell.workspace.right`、`shell.workspace.bottom` 和
`ctx.workspaceLayout`，再检查 bundle row 与 client loader。旧 DSH 不会得到 overlay
降级路径。
