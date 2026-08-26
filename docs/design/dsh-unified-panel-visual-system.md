# DSH 面板统一视觉系统（dsh-unified-panel-visual-system-v1）

插件侧 web 面板的统一 token registry、scoped chrome 与交互底线。官方 `dsh web` host 仍是主题与 slot 的 owner；本系统只在 host 变量缺失时提供 canonical fallback，并消除插件之间的视觉/交互分歧。

## 1. 现状审计（2026-08-25，file:line 证据）

### 1.1 同一 token 的 fallback 分歧

| token | 出现的 fallback 字面量 | 证据（源码） |
|---|---|---|
| `bg-elevated` | `#1c1c1f` / `#202024` / `#222226` / `#242429`（单文件 4 值） | `packages/client/ui-pane-workbench/src/region-chrome.ts:99,108,110,113` |
| `bg-base` | `#171719` / `#151517` | `region-chrome.ts:78,96` vs `ui-creator-studio/src/styles.ts:3`、`ui-desktop-workbench/src/client/desktop-workbench-styles.ts` |
| `bg-layer-1` | `#1f1f22` / `#1e1e21`（creator 单文件双值）/ `#29292d` / `#232324` | `ui-creator-studio/src/styles.ts:7,13,26`、`ui-pane-subagent/src/view.ts`、`desktop-workbench-styles.ts` |
| `label-primary`（=text-primary） | `#ececf1` / `#f2f2f4` / `#fff` | `ui-pane-subagent/src/view.ts`、`desktop-workbench-styles.ts` |
| `label-tertiary` | `#8d8d96` / `#92929b`；creator 又用 `text-tertiary #96969f` | 同上 + `ui-creator-studio/src/styles.ts` |
| `text-secondary` | `#b8b8c0` / `#aaaab2` / `#c2c2c8` / `#bdbdc5` / `#c6c6cc` | `region-chrome.ts:81,98,103`、creator `styles.ts` |
| `border-l2` | `rgba(255,255,255,.10/.11/.12/.14)` | 全部含样式面板 |
| `fill-hover` | `rgba(255,255,255,.05/.08)`；desktop 另名 `interactive-bg-hover` | `ui-pane-subagent/src/view.ts` 等 |

### 1.2 两套同义词汇并存

- `text-*`/`fill-*`/`accent`：`ui-pane-workbench`、`ui-creator-studio`。
- `label-*`/`state-business-primary`/`state-error-secondary`/`interactive-bg-hover`/`button-ghost-active-fill`：`ui-pane-subagent`、`ui-desktop-workbench`。
- 同名异值 + 异名同义并存；无任何上游文档定义该词汇（skills/docs 均无 `dsw-alias` 出处），归属本仓库插件自造。

### 1.3 布局度量分歧

- 圆角：6/7/8/9/10/11/12px 混用（creator 卡片 11px、行 8/9px；chrome 菜单 10px、picker 12px、tab 6px）。
- 控件高度：icon 28/32px、按钮 30px、输入 34px、picker 行 42px。
- 字号：10/11/12/13/14/16px；正文 13px（creator）vs 14px（chrome `--dsh-wb-font-size`）。

### 1.4 交互底线分歧

- focus-visible：creator/chrome 有；subagent/desktop 部分有；domain panes 无。
- `prefers-reduced-motion`：creator 有；其余多数无。
- empty/loading/error：creator 有 `.cs-empty/.cs-alert`；domain panes 空态只有一行裸文本 `No owner projection.`；多数面板无 skeleton。
- 状态仅颜色表达：creator status-dot 有文本伴随；domain panes 状态只有 `role="status"` 一行字（无 tone）；各面板状态色各异。

### 1.5 完全无样式的高价值面

- `packages/client/ui-pane-domain/src/view.ts`：六个创作工具（Eikona/Scaena/Sonora/Auctra/Pinax/Anatomia）+ Ordo Team 的 domain pane 输出裸 DOM，仓库内无任何 CSS 命中 `[data-pane-domain]`（全仓 grep 仅 view.ts:32 自身）。
- 样式注入方式：各面板在 React 树内渲染 `<style>{…}</style>`（如 `ui-creator-studio/src/views.tsx:274`）；`ui-mermaid-render` 用 observer 注入。creator 旧样式大多数 `.cs-*` 选择器未加 scope 前缀，规则实为文档级全局。

## 2. Canonical 决策

### 2.1 Registry（`packages/client/ui-visual-kit/src/tokens.ts`）

| token | canonical fallback | 依据 |
|---|---|---|
| `bg-base` | `#171719` | Pane chrome 容器值（面板居住的框架底色） |
| `bg-layer-1` | `#1e1e21` | creator 卡片/chrome 通用层 |
| `bg-layer-2` | `#242429` | chrome 菜单/elevated 族归并，保持单调色阶 |
| `bg-elevated` | `#2a2a2f` | 高于 layer-2，浮层可辨 |
| `text-primary` | `#ececf1` | chrome 根 + label-primary 众数 |
| `text-secondary` | `#c6c6cb` | label-secondary 众数 |
| `text-tertiary` | `#92929b` | label-tertiary 众数 |
| `text-quaternary` | `#6f6f78` | `#676770/#777780` 中点 |
| `text-link` | `#8fc5ff` | chrome |
| `border-l1/l2` | `rgba(255,255,255,.06/.12)` | chrome/desktop 值 |
| `border-focus` | `#79b8ff` | 全仓一致 |
| `fill-hover` | `rgba(255,255,255,.08)` | 众数（`.05` 弃） |
| `fill-selected` | `rgba(101,166,255,.18)` | chrome |
| `fill-active` | `#343438` | desktop ghost-active |
| `accent` | `#79b8ff`（creator 可覆写 `#9bcbff`） | chrome accent |
| `state-positive/info/warn/error/neutral` | `#51c58b/#6aa8ff/#f0b45a/#ee6b72/#8b8b94` | creator 已发布语义，词表见 §2.3 |

同义词映射：`label-*`→`text-*`、`interactive-bg-hover`→`fill-hover`、`button-ghost-active-fill`→`fill-active`、`state-business-primary`→`accent`、`state-error-secondary`→`state-error`。

### 2.2 注入结构（`buildPanelStyles`）

- 面板根 `[data-<scope>]` 单点声明 `--vk-*: var(--dsw-alias-<name>, canonical)` —— 结构上杜绝"单文件多 fallback"。
- 规则三层：base（reset/字色/焦点环/reduced-motion/coarse 44px）、chrome（header/toolbar/btn/icon-btn/field/card/row/badge/dot/progress）、state（empty/alert/skeleton）。
- 全部选择器限定 scope；keyframes 以 scope 命名（`vk-shimmer-<scope>`）；`extra` 由调用方自带 scope。
- 纯函数、零依赖、逐字节幂等；样式串随各插件 bundle 内联一份（接受重复，换取零共享 runtime）。

### 2.3 状态 tone 词表（`statusTone`）

- positive：ready/completed/done/success
- info：running/active/queued
- warn：pending/partial/stale/approval_required/reconciling
- critical：offline/failed/error/contract_mismatch/reconcile_required/unknown
- 词表外 → neutral（不抛错、不伪装 ready）；状态永远配文本/aria，不只靠颜色。

### 2.4 诚实恢复语义

domain pane 空态不提供手动重试按钮：`DomainOwnerSourceBridge.reread()` 的合同限定"除 open 与 transport 恢复外不得调用"（`owner-source.ts` 注释），且仓库纪律禁止 unknown/offline 自动 retry。空态文案解释"通道恢复时自动权威重读"。未来若 host 提供 owner reconcile action，可作为 recovery 入口接入。

## 3. 采纳顺序（按用户价值）

1. `ui-pane-domain`（六个创作工具 pane，零样式 → 统一 chrome）✅ 3.1
2. `ui-creator-studio`（token 归一 + 状态色入 tone + 规则 scope 化）✅ 3.2
3. `ui-pane-workbench` chrome fallback 归一（region-chrome/explorer/git）✅ 3.3（2026-08-26：34 处 fallback 并入 `.pwr-root` 单点声明）
4. `ui-session-tags`/`ui-session-cookie-manager`（A 档全量采纳）+ `ui-next-step-suggestions`/`ui-conversation-rewrite`/`ui-agent-preset`（B 档守卫：currentColor 继承/宿主类名委派，零硬编码色断言）✅ 3.4
5. `ui-desktop-workbench`/`ui-pane-subagent` 同义词迁移

## 4. 非目标

- 不定义 host 主题、不写 `--dsw-alias-*` 到宿主根、不fork DSH core。
- 不引入 CSS-in-JS runtime/Tailwind 等依赖；不做官方 `dsh web` 截图验收。
- 不改任何 owner/host 合同、投影数据与交互语义（本 change 只动表现层）。
- commodity-parked lane（chrome 拆分、codicons、xterm 等）不因本 change 复活。
