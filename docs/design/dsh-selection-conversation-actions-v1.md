# 选区操作：添加到对话、引用与询问

插件合同与 fixture 浏览器验收已完成。真实官方 DSH / 本机 profile 上的选区 overlay 仍未验证，不计通过。

完整合同与验收标准以 [补充 OpenSpec](../../openspec/changes/dsh-selection-conversation-actions-v1/specs/dsh-selection-conversation-actions/spec.md) 为准；技术决策和 UI Contract 见 [design.md](../../openspec/changes/dsh-selection-conversation-actions-v1/design.md)，待办见 [tasks.md](../../openspec/changes/dsh-selection-conversation-actions-v1/tasks.md)。

## 用户旅程

1. 选择正文、历史消息或资源中的内容，工具条显示“添加到对话”和“询问”，目标会话可见。
2. 添加到对话保留来源焦点；引用并询问将引用放入同一目标草稿，再聚焦官方输入框，供用户补充问题。
3. 可显式选择另一对话或新建对话。多个 session Pane 并排时，目标不能随工具条焦点或异步解析悄悄变化。
4. 引用以原生节点显示来源和摘要，支持更多详情、有效定位与移除；现有草稿和撤销历史保留。
5. 最右侧手柄单击固定／取消固定，按住并移动超过阈值后拖动；松手保留位置，Escape 取消正在进行的拖动。

批注、复制和批量收集保持次级入口。询问与添加都不自动发送消息，也不自动执行引用中的内容。

## 此次反馈转化成的验收重点

- 真实宿主里的背景、字体和控件层级一致，不能只以 token 字符串测试代替视觉验收。
- 固定后工具条仍然可见、可操作；固定位置与旧选区收藏／恢复能力分开。
- 真实鼠标／触控拖动改变几何，且尾随 click 不翻转固定状态；失焦、取消和视口变化有确定结果。
- 添加／询问检查真实 workspace/session 目标、引用节点和草稿保存，不只检查按钮出现。
- 缺少 resolver 时显示具体原因；文字引用需显式选择并标记没有可定位来源，不伪造结构化引用。
- 多 Pane、跨项目、生成中追加、来源失效、长文本、中英文、360/560/960px、200% zoom、键盘和 reduced motion 纳入测试。

## 与现有工作的关系

此补充依赖 [引用草稿与主题 change](../../openspec/changes/dsh-web-composer-references-theme-v1/proposal.md) 和 [多 Pane 工作台](../../openspec/changes/dsh-unified-multi-pane-workbench/proposal.md)。它补充选区交互的明确验收要求，保留两者已有完成记录；未来实现仍复用其宿主和资源 owner，不另建会话或输入框。

验收命令：

```bash
openspec validate dsh-selection-conversation-actions-v1 --strict --no-interactive
node scripts/run-selection-conversation-actions-evidence.mjs --host
pnpm run check:surfaces
pnpm run check:plugins
pnpm run test:visual
```

交付与回退见 [dsh-selection-conversation-actions-2026-09-05.md](../delivery/dsh-selection-conversation-actions-2026-09-05.md)。不调用付费模型。
