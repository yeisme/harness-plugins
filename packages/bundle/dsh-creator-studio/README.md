# @yeisme/dsh-creator-studio

Creator Studio 是基于 Pane Workbench 和 Desktop Workbench 的任务优先创作面板。它把六个领域 owner 聚合到同一套交互中：

- Eikona：图像生成与视觉资产。
- Scaena：视频、分镜、短剧编排、审阅与导出。
- Sonora：语音、音乐、音效与音频资源。
- Auctra：文章、脚本、改写与文字版本对比。
- Pinax：资料、世界观、人物卡和上下文引用。
- Anatomia：内容分析、质量指标和结构诊断。

## 本地安装

```sh
dsh plugin --profile web add ./packages/bundle/pane-workbench
dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench
dsh plugin --profile web add ./packages/bundle/dsh-creator-studio
```

Creator Studio 只增加一条 profile 行，不会再创建一个 Pane shell、侧栏、调度器或任务账本。缺少 Pane V2、Host Remote 或 owner adapter 时，“创作”入口会安全禁用或显示离线状态。

## Host 集成

服务端必须在 bundle 构造网关之前提供完整且冻结的 `creatorStudioExpectedContext`。不能从浏览器参数、旧快照、Cookie 或访问票据反推该绑定。

```ts
import CreatorStudioPlugin, {
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  registerCreatorStudioOwner,
} from '@yeisme/dsh-creator-studio'

ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, expectedContext)
await ctx.plugin(CreatorStudioPlugin)

const disposeEikona = registerCreatorStudioOwner(ctx, eikonaAdapter)
```

每个 adapter 只返回安全投影、短期媒体访问授权和 owner receipt。动作只按当前 server-authored descriptor 执行一次；`unknown`、`partial`、`cancel_unknown`、stale cursor 或上下文漂移都要求 owner reconcile，不会自动重试或替换 writer。
