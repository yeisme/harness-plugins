## 状态与顺序

状态：实施中，目录上下文菜单1.3已完成；布局controller验证已补强，1.4仍保留编辑缓冲集成缺口。依赖本轮 `dsh-pane-interaction-completion-v1`，按目录事件 → 文件恢复 → 上下文菜单 → 布局模板顺序推进，每步以真实用户路径验证。

## 场景矩阵

| scenario | 用户与任务 | 产物/检查 | 证据与交接 | readiness |
|---|---|---|---|---|
| directory-watch | 开发者在其他工具新增/重命名文件 | typed owner event；树保留展开、选择和滚动 | owning project temp/integration-test-runs；Explorer reducer | exploratory |
| directory-gap | 长会话掉线后恢复 | cursor/version gap 触发一次权威重读，未知不自动 mutation | 同上；file owner reconcile | exploratory |
| file-reopen | 刷新后重开原文件 | opaque ref + owner admission；不存在显示原因 | 同上；desktop.file/semantic editor | exploratory |
| dirty-conflict | 外部更新命中未保存缓冲 | 不覆盖、不自动丢弃；提供版本比较与显式决策 | 同上；file owner preview/receipt | exploratory |
| tree-context-menu | 鼠标与键盘执行文件操作 | 原生 menu、预检/冲突/撤销复用；动作权限可见 | 同上；现有 mutation service | exploratory |
| layout-template | 两栏/三栏工作流与切换项目 | 原有 preset schema；无重复 pane；绑定不串线 | 同上；host workspace service | exploratory |

## UI Contract

- adopted navigator/workspace；复用 Pane 标题、紧凑 Surface 与原生 Menu/Modal。
- 优先级：上下文、文件内容/树、待处理状态；不新增仪表盘卡片。
- 树/编辑器各自拥有唯一主滚动区；More 与菜单不改变背景布局。
- loading 保留最后安全内容；empty 解释目录为空；error 显示 owner 原因；stale/partial 标明缺失范围；disabled 标明权限；success 只展示 receipt 摘要。
- <=420px 单栏加返回路径，421–720px 导航与内容切换，>720px 可并列；所有重要动作提供键盘路径，Escape 回到发起行。
- reduced motion 禁用非必要动画；触控目标至少44px；焦点环和文本状态沿用统一 token。

## 验证与边界

先用已有 Explorer reducer/component tests 与文件服务测试，真实浏览器只测关键链路。每次 integration/component/e2e 都由现有脚本生成脱敏六件套。不把模拟 watch 或静态截图当真实跨刷新恢复通过。任何真实文件删除、覆盖或生产动作仍需具体用户授权；测试使用可丢弃 fixture。

## 1.3实施与验收

右键、Shift+F10和ContextMenu使用既有Menu及owner预检/执行/冲突/撤销通道；菜单绑定发起行而不更改另一选择目标。请求generation隔离取消、更新操作、runtime切换和迟到执行/刷新；pending可取消，预检就绪聚焦确认但不执行。取消及完成回到发起行，删除行时回到有效父级/首行。短Pane菜单内部滚动，coarse pointer项至少44px。菜单提供新建、重命名、移到废纸篓，其他已有操作继续使用原工具栏。

独立验证10项新菜单回归+22项既有Explorer测试通过：`temp/integration-test-runs/p1-independent-recheck-20260907T104205684008Z/`。原生Menu的360/960px、160px矮窗和触屏验证5项通过：`temp/integration-test-runs/ui-visual-2026-09-07T10-49-28-113Z-3806248/`，最终完整视觉106项通过：`temp/integration-test-runs/ui-visual-2026-09-07T11-04-11-870Z-3926944/`。使用合成文件操作，不宣称真实文件删除/改名通过。

## 1.4部分验证，保持未完成

真实WorkspaceLayoutController补充10项测试覆盖两/三栏混合项目、重复恢复去重、会话身份、序列化重建与同步/异步dirty guard和过期许可：`temp/integration-test-runs/preset-continuity-strengthened-20260907T105132133690Z/`。测试包在`upstream-prs/pane-preset-continuity-tests/`，不改宿主生产代码。实际编辑器renderer重挂载后的两份未保存正文独立性仍未验证，不能把controller guard测试当完整buffer恢复；1.4维持未勾选。
