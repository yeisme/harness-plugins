## Context

Workbench Core 已提供 registry/shell；Rich Media 与 File/Document 都是独立模块。组合包用于验证生态可组合性，并给用户一个统一入口。

## Goals / Non-Goals

**Goals:**

- 同一 WorkbenchShell 展示多个模块 Tab。
- 组合注册不复制模块状态。
- 官方侧栏入口可用。

**Non-Goals:**

- 不实现领域功能。
- 不创建第二 registry 或第二 state。

## Decisions

### 1. 组合只做装配

`createComposedWorkbenchRegistry()` 注册现有模块描述符；`ComposedWorkbench` 只消费 registry snapshot 并渲染。

### 2. 使用 WorkbenchShell

组合面板使用 `WorkbenchShell`，保证 tablist 语义、状态栏与各模块一致。

### 3. 使用官方 sidebar slot

组合包注册 `sidebar.footer.action`，与 Rich Media 工作台一致；不抢跑非官方宿主。

## Test Specification

| 层 | 场景 | 命令 | 证据 |
| --- | --- | --- | --- |
| unit | 组合 registry 注册两个模块且 tabs 无重复冲突 | `pnpm --filter @yeisme/dsh-workbench-compose run test` | Vitest result |
| build | typecheck/build | `pnpm --filter @yeisme/dsh-workbench-compose run typecheck && pnpm --filter @yeisme/dsh-workbench-compose run build` | exit 0 |

## Risks / Trade-offs

- [Tab 冲突] → 组合测试验证 id 唯一；后续模块需在 registry 层增加全局 tab id 校验。
- [依赖耦合] → 组合包只依赖模块公开描述符与面板，不依赖内部实现。

## Migration Plan

1. 发布 `@yeisme/dsh-workbench-compose@0.1.0-rc.1`。
2. 后续新模块只需注册进 `createComposedWorkbenchRegistry()`。

Rollback：移除组合包或改用单独模块入口；无数据迁移。
