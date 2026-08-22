## 1. Core 合同

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-workbench-core/src/types.ts`；Dependencies: none] 定义 `WorkbenchModuleDefinitionV1`、`WorkbenchTabV1`、`WorkbenchCommandV1` 与校验。Acceptance: 拒绝非法 id、空 title、未知 scope、重复注册；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: tests；Dependencies: 1.1] 增加 module 校验与 registry 测试。Acceptance: 4 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。

## 2. Core Registry

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/registry.ts`；Dependencies: 1.1] 实现 `WorkbenchRegistry`：register/dispose/snapshot/sort。Acceptance: 重复拒绝、dispose 精确移除；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。

## 3. React Shell

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/shell.tsx`；Dependencies: 2.1] 实现 `WorkbenchShell`：tablist/tab/tabpanel/status。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-workbench-core run typecheck && pnpm --filter @yeisme/dsh-workbench-core run build`。
- [x] 3.2 [Owner: Harness Plugins；Scope: `src/client/shell.tsx`；Dependencies: 3.1] 增加方向键/Home/End 键盘切换与焦点移动。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-workbench-core run typecheck && pnpm --filter @yeisme/dsh-workbench-core run build`。

## 4. Package 与 OpenSpec

- [x] 4.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-workbench-core/`；Dependencies: 1.x, 2.x, 3.x] 初始化 `@yeisme/dsh-workbench-core@0.1.0-rc.1`，配置 bundle、README、cordis.patch.yml。Acceptance: typecheck/test/build 全绿；Validation: 三个命令。
- [x] 4.2 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-workbench-core-v1/`；Dependencies: 4.1] 完成 proposal/design/tasks/spec。Acceptance: `openspec validate dsh-workbench-core-v1 --strict --no-interactive` 通过。

## 5. 后续实现（retain-next）

- [x] 5.1 将 `@yeisme/dsh-rich-media` Workbench 改为消费 Core registry/shell。
- [x] 5.2 确认 Workbench/Pane 官方宿主 slot；结论：当前只有 `sidebar.footer.action` 等官方入口，尚无稳定 Workbench/Pane 宿主，Core 暂不注册为正式宿主。
- [x] 5.3 增加 source-independence scan，确保不依赖 DSH-better-sidebar。
- [x] 5.4 增加第二个模块（File/Document）验证 Core 可扩展性。
- [x] 5.5 评估 `dsh workbench` CLI 生成模块骨架；已实现 `generate:module` 脚手架脚本。

## 6. Conformance

- [x] 6.1 [Owner: Harness Plugins；Scope: `tests/conformance.spec.ts`；Dependencies: 2.1] 增加模块安装/卸载/HMR 替换/重复拒绝/多 registry 隔离 conformance。Acceptance: 9 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。
- [x] 6.2 [Owner: Harness Plugins；Scope: `src/registry.ts` 与 tests；Dependencies: 2.1] 增加跨模块 tab/command id 唯一性校验。Acceptance: 11 tests passed；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。

## 7. 后续推进目标（retain-next）

- [x] 7.1 [Owner: Harness Plugins；Scope: `src/registry.ts`；Dependencies: 6.2] 增加模块依赖与 capability gate，模块可声明 requiredCapabilities 并在缺失时 fail closed。Acceptance: 缺 capability 注册被拒；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。
- [x] 7.2 [Owner: Harness Plugins；Scope: `src/client/command-palette.tsx`；Dependencies: 3.2] 增加命令分组、最近使用、快捷键提示。Acceptance: palette 可按 moduleId 分组；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。
- [x] 7.3 [Owner: Harness Plugins；Scope: `src/client/shell.tsx`；Dependencies: 3.2] 增加 Tab 拖拽排序与关闭按钮（避免 button 嵌套）。Acceptance: 拖拽/键盘可排序；Validation: `pnpm --filter @yeisme/dsh-workbench-core run test`。
- [x] 7.4 [Owner: Harness Plugins；Scope: `scripts/generate-module.mjs`；Dependencies: 4.1] 为生成器增加 `--with-panel`、`--with-openapi` 选项。Acceptance: 生成不同模板；Validation: 手动运行生成器。
