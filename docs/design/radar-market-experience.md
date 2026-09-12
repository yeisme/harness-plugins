# Radar 市场简报与证据深看

方案日期：2026-09-11；状态：设计，尚未完成实现或实际宿主验收。实现真源为 [OpenSpec](../../openspec/changes/dsh-radar-market-intelligence-v1/design.md) 与 [tasks](../../openspec/changes/dsh-radar-market-intelligence-v1/tasks.md)。

## 体验目标

用户从 Agent 获得每日 3–5 分钟国内外短剧变化摘要，进入 DSH 查证、补看、关注、比较和回顾。主对象是有证据的市场变化；原个人选题、收藏和提案保留为既有能力。

只使用现有 personal-radar host/client/bundle 和 DSH Pane，不恢复独立 Workbench。平台名单、来源资格、市场分析、阅读状态和观察清单由 Radar 管理；本页不维护另一套产品来源账本。

## 页面顺序

1. 变化：自上次已读或本期完整简报；显示更正、重要变化、待观察与覆盖缺口。
2. 详情：发生什么、与何时比较、依据、限制，再进入作品与证据。
3. 关注：按题材/作品/平台/地区持续观察；暂停不删除历史。
4. 对照：保留各市场窗口和原指标，不造统一热度分。
5. 回顾：原判断、后续证据与无法判断项并列。
6. 追问：形成绑定信号修订和当前会话的草稿，由用户发送，不自动采集或购买研究。

阅读与关注操作必须有 Radar 回执；资源打开不自动已读。三天未读按信号新修订补看，旧闻不重复占满首屏。返回恢复位置；后台发布新版只提示，不抢走当前阅读。

## UI 与错误状态

遵循 [统一视觉系统](dsh-unified-panel-visual-system.md)。使用紧凑列表、单一 ContextBar、现有原子控件和一个主滚动区；不做等权大卡片仪表盘。状态用文字表达，unknown、partial、stale、empty、absent 分清。

窄屏上下排列对照，能力不裁剪；键盘可完成阅读、详情、关注、提问和返回。更改禁区/读者上下文后，旧缓存和晚到响应不得继续展示。问答缺少安全会话接口时只禁用该动作，证据阅读仍可用。

## 验证与交接

软件验证复用 Vitest、host integration:evidence、统一截图与 bundle/probe 检查；真实宿主验证单列，不拿 fixture 或文本帧代替。测试包括无本机 CLI、断线回执、会话切换、未知地区、不同口径比较、长标题、360/560/960px、pseudo locale 和200%缩放。

从本仓目录可运行的现有命令：

```bash
pnpm --dir packages/host/dsh-personal-radar run test
pnpm --dir packages/client/ui-personal-radar run test
pnpm --dir packages/host/dsh-personal-radar run integration:evidence
pnpm run check:surfaces
pnpm run test:visual
pnpm run check:plugins
openspec validate dsh-radar-market-intelligence-v1 --strict --no-interactive
```

预览必须先阅读 docs/runtime/dsh-workbench.md，再运行 pnpm dsh:workbench -- --check，确认兼容后运行 pnpm dsh:workbench -- --no-open --port 40869。本次文档任务不启动预览、修改运行配置或声明实际数据已接通。
