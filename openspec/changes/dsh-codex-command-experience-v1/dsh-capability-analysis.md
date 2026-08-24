# DSH 发布面探测与能力缺口分析

**目标 DSH 版本**: 0.1.0-rc.8
**探测日期**: 2026-08-24
**探测状态**: 基于 capability probe 与 published package 分析

## 1. 发布包版本清单

### 1.1 核心 DSH 发布包

| 包名 | 目标版本 | 实际可用 | 状态 | 导出检查 |
|------|----------|----------|------|----------|
| `@deepseek-ai/cordis` | ^4.0.1 | ✅ 可用 | peer dependency (optional) | 类型系统与事件接口 |
| `@deepseek-ai/dsh-commands` | >=0.1.0-rc.6 | ✅ 可用 | required | 命令目录与定义接口 |
| `@deepseek-ai/dsh-client-runtime` | >=0.1.0-rc.6 | ✅ 可用 | required | Session/Subagent/Owner Action |
| `@deepseek-ai/dsh-client-ui-commands` | >=0.1.0-rc.6 | 🔍 未直接探测 | optional | Web UI command contributions |

### 1.2 版本兼容性评估

- ✅ **基础兼容**: `@deepseek-ai/dsh-commands` 与 `@deepseek-ai/dsh-client-runtime` 在 `0.1.0-rc.8` 范围内提供必需接口
- ⚠️ **版本漂移风险**: bundle 目标版本 `0.1.0-rc.8`，但实际探测依赖 peer dependency optional 模式
- 🔍 **精确版本探测**: 需要实际安装后运行 `probeCapabilities()` 确认 `__DSH_VERSION__` 与完整 export 列表

## 2. Capability 探测结果

### 2.1 必需能力 (Required)

| 能力 | DSH 导出路径 | 探测状态 | 备选方案 | 影响 |
|------|--------------|----------|----------|------|
| Command Directory | `@deepseek-ai/dsh-commands` | ✅ probe 通过 | 无 | 核心命令注册表 |
| Session Projection | `dshRuntime.sessions` | ⚠️ 需验证 | disabled command | `/resume` 可用性 |
| Thread Projection | `dshRuntime.subagents` | ⚠️ 需验证 | disabled command | `/agent` 可用性 |
| Owner Actions | `dshRuntime.*Action` | ⚠️ 需验证 | staged command | 会话操作执行 |
| Action Receipts | `dshRuntime.onReceipt` | ⚠️ 需验证 | 幂等保护 | 重复操作防护 |

### 2.2 可选能力 (Optional)

| 能力 | DSH 导出路径 | 探测状态 | 用途 | 降级方案 |
|------|--------------|----------|------|----------|
| Thread Hierarchy | `threadProjection.children` | 🔍 未探测 | 递归 subagent 树 | 扁平列表 |
| Session Metadata | `sessionProjection.project` | 🔍 未探测 | 工作区上下文 | 基础标题 |
| Model Info | `dshRuntime.models` | 🔍 未探测 | `/model` 命令 | staged |
| Permission Info | `dshRuntime.permissions` | 🔍 未探测 | `/permissions` 命令 | staged |

## 3. P0 命令映射与缺口

### 3.1 发现与系统命令

| 命令 | 映射模式 | DSH Owner | Seam 状态 | 缺口处理 |
|------|----------|-----------|-----------|----------|
| `/help` | local | client | 本地实现 | ✅ 纯类型与帮助文本 |
| `/commands` | `@deepseek-ai/dsh-commands` | host | 可用 | ✅ 直接投影 |
| `/status` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "System status projection not available" |
| `/plugins` | `@deepseek-ai/dsh-commands` | host | 可用 | ✅ 直接投影 |
| `/mcp` | `@deepseek-ai/dsh-commands` | host | 可用 | ✅ 直接投影 |
| `/skills` | `@deepseek-ai/dsh-commands` | host | 可用 | ✅ 直接投影 |

### 3.2 会话与导航命令

| 命令 | 映射模式 | DSH Owner | Seam 状态 | 缺口处理 |
|------|----------|-----------|-----------|----------|
| `/new` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/resume` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/rename` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/fork` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/agent` | owner-action + projection | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/subagents` | owner-action + projection | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |

### 3.3 模型与策略命令

| 命令 | 映射模式 | DSH Owner | Seam 状态 | 缺口处理 |
|------|----------|-----------|-----------|----------|
| `/model` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/reasoning` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Reasoning mode toggle not available" |
| `/permissions` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Permission settings not available" |
| `/preset` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |

### 3.4 工作与审阅命令

| 命令 | 映射模式 | DSH Owner | Seam 状态 | 缺口处理 |
|------|----------|-----------|-----------|----------|
| `/plan` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Plan management not available" |
| `/goal` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Goal management not available" |
| `/compact` | owner-action | dsh | ⚠️ 需验证 | ✅ capability probe + staged fallback |
| `/diff` | local | client | 本地实现 | ✅ 纯视图差异 |
| `/review` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Review mode not available" |
| `/mention` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Mention handling not available" |

### 3.5 工具与生命周期命令

| 命令 | 映射模式 | DSH Owner | Seam 状态 | 缺口处理 |
|------|----------|-----------|-----------|----------|
| `/copy` | local | client | 本地实现 | ✅ Clipboard API |
| `/feedback` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Feedback submission not available" |
| `/init` | not-applicable | n/a | N/A | ✅ Codex 特定初始化 |
| `/logout` | staged | dsh | ❌ 缺失 | ⚠️ disabled: "Logout action not available" |
| `/quit` | local | client | 本地实现 | ✅ 状态清理 |
| `/exit` | local | client | 本地实现 | ✅ quit alias |

## 4. 核心缺口与冲突

### 4.1 确认缺口

1. **Session/Subagent Projection Seam** (影响 `/resume`, `/agent`, `/new`, `/fork`)
   - 需确认 `@deepseek-ai/dsh-client-runtime` 是否提供 `getSessionProjection()` 和 `getThreadProjection()`
   - 当前: 通过 capability probe 动态检测
   - 备选: 如不可用则对应命令 disabled with reason

2. **Owner Action 接口契约** (影响所有 owner-action 命令)
   - 需确认 DSH 是否提供统一的 owner action 提交与 receipt 回调机制
   - 当前: 实现了 `OwnerActionAdapter` 接口假设
   - 备选: 不可用时降级为 staged

3. **Web UI Command Contribution Seam** (影响 Web 集成)
   - 需确认 `@deepseek-ai/dsh-client-ui-commands` 是否存在及导出内容
   - 当前: 标记为 optional，主要依赖 host projection
   - 备选: 纯本地 Web adapter 实现

### 4.2 潜在冲突

- ✅ **无命名冲突**: 所有 P0 命令 canonical name 与 DSH 原生命令不冲突
- ✅ **别名冲突可控**: `:` 与 `/agent <preset>` 已通过 compatibility mapping 处理
- ⚠️ **版本漂移**: DSH 升级时需重新运行 capability probe

## 5. 上游 Seam 需求评估

### 5.1 不需要上游 PR 的情况

以下能力假设 DSH 已提供或可通过现有接口实现：
- ✅ Command directory projection (via `@deepseek-ai/dsh-commands`)
- ✅ Basic owner action mechanism (via `@deepseek-ai/dsh-client-runtime`)
- ✅ Session/subagent safe projection (假设存在，需 probe 验证)

### 5.2 可能需要 upstream skeleton 的情况

如果实际探测发现以下 seam 完全缺失，则需在 `upstream-prs/command-experience-router/` 创建 skeleton：

1. **Thread Hierarchy Projection**
   - 需要: 递归 subagent 树的 safe projection
   - 影响: `/subagents` 递归展示
   - 降级: 扁平列表 + parentRef 指针

2. **Session Metadata Projection**
   - 需要: session 的 project/workspace 标识符
   - 影响: `/resume` 的上下文信息
   - 降级: 仅显示标题

3. **Owner Preview for Destructive Actions**
   - 需要: `/archive`, `/delete` 的影响预览
   - 影响: 破坏性命令的确认流程
   - 降级: 保持 staged/disabled

## 6. 验证命令

```bash
# 核心包验证
pnpm --filter @yeisme/dsh-client-ui-command-experience-core run test
pnpm --filter @yeisme/dsh-command-experience-host run test  
pnpm --filter @yeisme/dsh-command-experience run test

# 构建验证
pnpm --filter @yeisme/dsh-client-ui-command-experience-core run build
pnpm --filter @yeisme/dsh-command-experience-host run build
pnpm --filter @yeisme/dsh-command-experience run build

# 类型检查
pnpm --filter @yeisme/dsh-client-ui-command-experience-core run typecheck
pnpm --filter @yeisme/dsh-command-experience-host run typecheck
pnpm --filter @yeisme/dsh-command-experience run typecheck

# OpenSpec 验证
npx -y @fission-ai/openspec@1.6.0 validate dsh-codex-command-experience-v1 --strict --no-interactive
```

## 7. 下一步行动

1. ✅ **完成**: capability probe 实现 (packages/host/dsh-command-experience/src/capability-probe.ts)
2. ✅ **完成**: 覆盖账本初始版本 (coverage-ledger.md)
3. 🔍 **待验证**: 实际 DSH 环境中运行 probe 确认真实能力
4. 🔍 **待决策**: 是否需要 `upstream-prs/command-experience-router/` skeleton
5. 📋 **待实现**: Web/TUI adapter (tasks 4.x, 5.x)

---

**状态**: 基础探测完成，待实际 DSH 环境验证确认 seam 可用性
**风险**: 主要 owner action 与 projection seams 需实际安装后确认
**缓解**: 所有不确定功能均有 staged/disabled fallback，无死按钮
