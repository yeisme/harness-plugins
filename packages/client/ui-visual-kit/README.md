# @yeisme/dsh-client-ui-visual-kit

DSH web 面板统一视觉系统：canonical `--dsw-alias-*` fallback、状态 tone 词表、scoped 面板 chrome CSS 构建器。零运行时依赖（无 react/cordis peer、无 DOM/网络访问）。设计见 `docs/design/dsh-unified-panel-visual-system.md`（change：`dsh-unified-panel-visual-system-v1`）。

## 关系

官方 `dsh web` host 仍是主题 owner：面板运行时若定义了 `--dsw-alias-*` 变量则一律优先；本包只提供缺失时的唯一 canonical fallback，并归一历史同义词（`label-*`→`text-*`、`interactive-bg-hover`→`fill-hover`、`button-ghost-active-fill`→`fill-active`、`state-business-primary`→`accent`、`state-error-secondary`→`state-error`）。

## 采纳步骤

1. 依赖 `"@yeisme/dsh-client-ui-visual-kit": "workspace:^"`。
2. 面板根元素带 `data-<scope>` 属性；模块级构建一次样式：

```ts
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'

const panelStyles = buildPanelStyles({
  scope: 'pane-domain',          // → [data-pane-domain]
  accentFallback: '#9bcbff',     // 可选：面板级 accent 兜底
  extra: `[data-pane-domain] .my-rule{color:var(--vk-text-primary)}`, // 自有扩展，必须自带 scope
})
```

3. 在 React 树内渲染 `<style>{panelStyles}</style>`（与既有注入方式一致）。
4. 自有规则只消费 `--vk-*` 变量，不写 `--dsw-alias-*` 字面量 fallback、不写状态色 hex；状态色用 `--vk-state-*` 或 `--vk-tone-*`。
5. 测试断言样式串来自 `buildPanelStyles()`（相等断言）、token 单点、scope 隔离（见 `ui-pane-domain/tests/visual-adoption.spec.ts`、`ui-creator-studio/tests/styles.spec.ts`）。

## 状态语义

`statusTone(status)` 把 owner 词表映射到 `positive/info/warn/critical/neutral`；词表外落 neutral。状态不得只靠颜色表达——配文本或 aria。tone 色值：`--vk-state-positive #51c58b`、`info #6aa8ff`、`warn #f0b45a`、`error #ee6b72`、`neutral #8b8b94`。

## 交互底线（kit base 自带）

focus-visible 焦点环、`prefers-reduced-motion` 降级、coarse pointer 44px 命中区、`.vk-empty/.vk-alert/.vk-skeleton` 状态类、`.vk-btn:disabled` 语义。

## 非目标

不写宿主变量、不做 CSS runtime、不接管 host 主题；完成门不依赖官方 `dsh web` 合入或浏览器截图。
