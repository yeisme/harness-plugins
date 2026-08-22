## 1. 组合 Registry

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/composed-registry.ts`；Dependencies: workbench-core/rich-media/file-document] 实现 `createComposedWorkbenchRegistry()`，注册两个模块。Acceptance: tabs 无重复冲突；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。

## 2. 组合 Shell

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/client/composed-workbench.tsx`；Dependencies: 1.1] 实现 `ComposedWorkbench`，用 `WorkbenchShell` 渲染媒体与文件/文档 Tab。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run typecheck && pnpm --filter @yeisme/dsh-workbench-compose run build`。

## 3. 侧栏入口

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/index.ts`；Dependencies: 2.1] 注册 `sidebar.footer.action` 与 locale。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run typecheck`。

## 4. 测试与 OpenSpec

- [x] 4.1 [Owner: Harness Plugins；Scope: tests；Dependencies: 1.1] 增加组合 registry 与 source-independence 测试。Acceptance: 2 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 4.2 [Owner: Harness Plugins；Scope: OpenSpec；Dependencies: 4.1] 完成 proposal/design/tasks/spec。Acceptance: `openspec validate dsh-workbench-compose-v1 --strict --no-interactive` 通过。

## 5. Host 投影与命令面板

- [x] 5.1 [Owner: Harness Plugins；Scope: `src/host-projection.ts`；Dependencies: 2.1] 增加 `WorkbenchHostProjection` 合同与空投影，组合工作台改为从 Host 投影读取媒体/文件条目。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run typecheck && pnpm --filter @yeisme/dsh-workbench-compose run build`。
- [x] 5.2 [Owner: Harness Plugins；Scope: `src/client/composed-workbench.tsx`；Dependencies: core command palette] 集成 `CommandPalette` 到组合工作台，提供统一命令入口。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run typecheck && pnpm --filter @yeisme/dsh-workbench-compose run build`。
- [x] 5.3 [Owner: Harness Plugins；Scope: `src/host-slot.ts`；Dependencies: none] 增加 `WorkbenchHostSlotRegistrar` 预备 seam，等待官方 Workbench/Pane 宿主 slot 出现后接入。Acceptance: 单次注册/重复拒绝/dispose；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 5.4 [Owner: Harness Plugins；Scope: `src/composed-registry.ts` 与 `src/client/composed-workbench.tsx`；Dependencies: terminal] 将 Terminal 模块加入组合工作台，并渲染 `TerminalPanel`。Acceptance: 组合 registry 含三个模块，Tab 无冲突；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 5.5 [Owner: Harness Plugins；Scope: `src/host-slot.ts` 与 tests；Dependencies: 5.3] 增加 `registerWhenHostSlotAvailable` gate，官方 slot 可用时注册、不可用时返回 null。Acceptance: 3 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 5.6 [Owner: Harness Plugins；Scope: `src/host-projection.ts` 与 tests；Dependencies: 5.1] 增加 `createStaticHostProjection`，用于演示/测试注入媒体与文件条目。Acceptance: 7 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 5.7 [Owner: Harness Plugins；Scope: `tests/composed-workbench.spec.tsx`；Dependencies: 5.2, 5.6] 增加组合工作台 React 集成测试：打开面板、展示模块 Tab、渲染 Host 投影、打开命令面板。Acceptance: 11 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 5.8 [Owner: Harness Plugins；Scope: `demo/`；Dependencies: 5.6] 增加可运行 demo 页面，使用 `createStaticHostProjection` 展示媒体与文件条目。Acceptance: `pnpm --filter @yeisme/dsh-workbench-compose run demo` 可启动；Validation: Vite 本地启动并返回 HTML。
- [x] 5.9 [Owner: Harness Plugins；Scope: `src/dsh-host-projection.ts` 与 tests；Dependencies: 5.1] 增加 DSH seam 适配器 `createDshHostProjection`，供真实 fs/media/terminal seam 接入。Acceptance: 13 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。
- [x] 5.10 [Owner: Harness Plugins；Scope: `src/host-slot.ts` 与 tests；Dependencies: 5.5] 增加 `registerComposedWorkbenchHost` 便捷入口。Acceptance: 13 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run test`。

## 6. 后续推进目标（retain-next）

- [ ] 6.1 [Owner: Harness Plugins；Scope: `src/dsh-host-projection.ts`；Dependencies: 5.9] 接入真实 `ctx.fs`/`ctx.attachments`/`ctx.terminals` seam，替换静态/空投影。Acceptance: demo 显示真实 Host 数据；Validation: 本地 DSH profile 启动。（blocked: 需要真实 DSH `ctx.fs`/`ctx.attachments`/`ctx.terminals` host seam，本环境无法执行本地 DSH profile）
- [x] 6.2 [Owner: Harness Plugins；Scope: `src/client/composed-workbench.tsx`；Dependencies: 5.8] 丰富 demo 数据：视频、PDF、终端状态、Git 状态。Acceptance: demo 可展示 5 类以上内容；Validation: `pnpm --filter @yeisme/dsh-workbench-compose run demo`。
- [ ] 6.3 [Owner: Harness Plugins；Scope: `src/host-slot.ts`；Dependencies: 5.10] 官方 Workbench/Pane 宿主 slot 出现后，在 client apply 中调用 `registerComposedWorkbenchHost`。Acceptance: 组合工作台以官方宿主渲染；Validation: 官方 slot 可用后 browser e2e。（blocked: 官方 Workbench/Pane 宿主 slot 尚未出现）
- [ ] 6.4 [Owner: Harness Plugins；Scope: `src/client/composed-workbench.tsx`；Dependencies: 5.2] 增加跨模块 ArtifactRef handoff 菜单与拖拽意图。Acceptance: 媒体/文件可互相 handoff；Validation: 集成测试。（blocked: 官方 `ArtifactRefV1`/`ArtifactIntentV1` seam 未冻结且本 lane 不能新增依赖/越界引用）
