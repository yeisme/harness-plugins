# 选区添加到对话、引用与询问

本轮把选区工具条改成对话优先：添加到明确会话、引用并询问、来源详情，以及最右侧手柄的单击固定／按住拖动。批注、复制和批量收集仍是次级入口。添加和询问都不自动发送，也不执行引用内容。

插件只拥有选区操作与短生命周期展示状态。会话、草稿、发送和 overlay 仍由 DSH 宿主拥有；来源授权与版本仍由资源 owner 校验。宿主缺少激活聚焦或目标选择时，对应入口禁用并说明原因，不伪造成功。

## 操作变化

- 「添加到对话」把引用插入已捕获的 workspace/session 草稿，保留来源焦点和已有文字。
- 「引用并询问」走同一插入通道，并请求宿主聚焦官方输入框；宿主未确认 `activated` 时不宣称已聚焦。
- 无结构化来源时，显式「以选区文字添加」打开带标注的可编辑草稿，不伪造 owner/ref，不静默发送。
- 手柄单击固定／取消固定；位移超过 6 CSS px 才进入拖动，松手固定并抑制尾随 click；Escape 取消进行中的拖动并还原几何。位置固定不复用旧 pin 收藏语义。
- 浮层根容器保持透明，工具条走宿主主题 alias；窄屏主动作进 sheet，触控目标 44×44px。

## 验证

插件合同与真实宿主交互分开记录。未验证能力不计通过。

| 检查 | 结果 | 证据 |
|---|---|---|
| 插件合同：visual-kit / interaction-space / selection-annotation typecheck+test，OpenSpec strict | 通过 | [分账](../../temp/integration-test-runs/selection-conversation-actions-2026-09-05T19-00-35-086Z-1693959/summary.json) |
| Playwright S1–S9（fixture 桥、真实指针，不 `.click()` 拖动） | 27/27 通过 | 同上分账的插件合同；复跑见 [视觉门](../../temp/integration-test-runs/ui-visual-2026-09-05T19-06-51-554Z-1889202/summary.json) |
| Surface / 插件门 | 通过 | `pnpm run check:surfaces`（28 client + 7 bundle）、`pnpm run check:plugins`（27 bundle 合同） |
| 视觉回归（更新基线后复跑） | 92/92 通过 | [结果](../../temp/integration-test-runs/ui-visual-2026-09-05T19-06-51-554Z-1889202/summary.json) |
| 真实宿主选区 overlay / pin / 草稿插入 | 未验证，不计通过 | 本机 `http://127.0.0.1:61818/` 返回 HTTP 401；`run-composer-reference-host-tests.mjs` 属于引用草稿 change，不证明本 overlay |

并发全量门 `full-plugins-2026-09-05T18-51-57-898Z-1270300` 的 typecheck / test / build / check:bundles / check:surfaces / check:plugins 已通过；当时 `test:visual` 因 visual-kit 宿主字体与 token 对齐未更新基线而失败。核对 diff 后更新 27 张表面基线，再以 `pnpm run test:visual` 复跑通过。选区 S1–S9 本身不依赖那些截图。

## 回退

关闭新的对话优先入口和手柄内部展示状态即可回到旧工具条。不删除用户批注、草稿、历史消息或旧 pin 收藏／恢复事件。visual-kit 宿主 alias 与 `font-family: inherit` 可随基线一起回退。不推送、不发布、不调用付费模型。
