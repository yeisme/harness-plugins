# 会话工具工作区 V2 交付记录

21项任务已完成。会话 Tools Tab、固定旁栏、标题会话管理、目录恢复和原消息定位已通过真实浏览器验证；动态发现的33个本地 bundle 通过安装、装载与适用 Web 入口检查。最终门在隔离其他在途源码的 checkout 中完成，完整视觉98/98通过。

## 实现结果

- 会话工具 Tab 默认活动，目录使用绑定会话的 referenceTools 与 Skills 安全查询。全局管理保留独立 CAS 启停，安装/连接复用 Settings owner。
- A Tab与A旁栏共享筛选和选择，B保持独立。关闭对话标签保留旁栏，重复固定复用实例，刷新恢复sessionId。
- Pane标题显示会话与工具类型；搜索可显式改绑定。同名短ID可区分，重命名按会话身份更新。旧无绑定布局要求选择，不采用全局current。
- 调用详情仅显示安全状态与摘要；原消息定位进入对应会话并聚焦原调用。返回与Escape恢复列表焦点，不新增执行重试。
- 修复Gateway envelope解包、来源失败隔离、过期缓存标记、服务晚到恢复、挂载去重及卸载后迟到资源释放。
- 显式manifest子路径Web seat修复Pentest/Terminal仅Host启用的问题；普通Host子路径仍不自动继承根client。Terminal冷构建同时恢复现有root导出。

## 已通过的验收

所有下列run位于本项目 `temp/integration-test-runs/`，保留六件套；隔离checkout的结果已复制到同一证据目录。

| 检查 | 结果 / run |
|---|---|
| 客户端集成 | 16项；`2026-09-07T09-40-21-865Z-2725320/` |
| 真实Loader/Storage/Gateway | 6项；`2026-09-07T09-40-34-468Z-2724973/`，临时cordis.yml、JSON storage、CAS冲突与写入失败 |
| Tools真实浏览器与多Pane | `pane-interactions-2026-09-07T09-33-28-245Z/`，A/B、重复固定、关源保留、刷新、标题搜索改绑定、原消息焦点、Settings与至少4 Pane循环 |
| 全插件入口 | 上述浏览器run的 `artifacts/plugin-smoke.json`，动态发现33/33通过；非独立UI记录不适用原因 |
| Tools视觉与键盘 | 6项；`ui-visual-2026-09-07T09-58-03-415Z-3312328/`，360/560/960px×正常/矮容器、返回/Escape及焦点 |
| 完整视觉 | 98项；`isolated-ui-visual-2026-09-07T10-06-13-486Z-3383577/`，旧截图和误差阈值未修改 |
| 构建、类型、bundle/plugin/surface | `isolated-session-tools-final-2026-09-07T09-47-07-149Z/` 对应命令exit0；typecheck包含完整build |
| 完整测试及剩余包复验 | 上述完整执行在缺生成产物时停止；补齐可丢弃产物后，未完成包在 `isolated-session-tools-final-2026-09-07T09-54-26-599Z/` 全部通过。首次非零结果保留，不改写为成功 |
| 宿主补丁链 | `workbench-patches-2026-09-07T09-54-57-008Z/`，完整链应用、当前包幂等、24份已审阅自有源码SHA256通过 |

直接测试还覆盖：Tools客户端46项、Host13项、bundle3项、命令3项、unified-host8项、Terminal54项；宿主navigation3项、Skills9项、client-modules42项、同名/重命名工具标题1项均通过。

## 失败归因与修正

初次目录故障先在 `2026-09-07T07-36-25-690Z-1460859/` 复现：已经挂载的remote返回transport envelope，旧分支把它当成目录，并误判内部领域失败。统一解包与codec校验后回归通过。

共享checkout完整门 `session-tools-final-2026-09-07T09-33-57-478Z/` 包含其他并行Browser/Creator源码未完成导致的构建与样式失败。本任务没有修改这些业务文件；正式门改在基线608a11c加自有改动的独立checkout执行。冷构建的UI/bundle顺序和personal-coding-base生成产物使用现有命令补暖；Terminal缺root产物在本包修复并验证。

首次视觉 `ui-visual-2026-09-07T09-33-29-049Z-2553110/` 为32通过、66失败。完整日志显示并发build删除ui-visual-kit产物，测试服务ENOENT退出后引发连接拒绝；这不是66处界面漂移。稳定环境复跑 `isolated-ui-visual-2026-09-07T10-03-20-075Z-3357965/` 得到91通过、7失败，均为同一个旧主题断言：b7ec388已将工具栏改为Pane的bg-layer-1，测试仍期待bg-overlay。本次只同步两份测试的颜色预期与canonical override token，没有修改产品样式、旧截图或阈值，随后98/98通过。

宿主types.ts与apply.ts同时有其他任务修改。导出命令只接纳已审阅的本任务hunk，排除editable-prompt/refreshReference增量，并生成owned-source.sha256在干净重建中校验；其他源码和脏改动保持原状。

## 验证边界

Loader、Storage、Gateway为真实本地服务；工具/Skills/inventory来源使用明确fixture，不代表真实外部MCP授权、连接和业务执行通过。全插件结果为加载与入口冒烟，不是全部插件业务端到端测试。

未发送模型请求、付费调用或远端写入，未更改用户工具偏好、凭据、会话正文、文件和草稿。浏览器使用独立测试profile，截图遮盖会话/工具名。Mac真机与Safari系统级快捷键未验证；Linux Chromium的Meta/Control事件和键盘合同已通过。

## 复验与存档

```bash
node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs
node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs --host
node scripts/test-pane-interactions.mjs
node scripts/test-workbench-patches.mjs
node scripts/run-session-tools-final-checks.mjs
node scripts/run-ui-visual-tests.mjs
openspec validate dsh-session-tools-workspace-v2 --strict --no-interactive
```

构建与视觉门顺序执行；不能在视觉服务读取文件时清理构建产物。浏览器DSH_PREVIEW_URL只临时传入当前进程认证地址，token不写入仓库、日志和证据。实现先提交f03e7b8，任务存档cfaa58e，根仓指针61c17a21/74ab8ea5；最终视觉门与文档另行补交，未推送远端。
