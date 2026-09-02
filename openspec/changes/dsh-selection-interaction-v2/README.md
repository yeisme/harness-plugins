# dsh-selection-interaction-v2

统一 DSH Web 选区与交互空间的 V2 交互层、工具条、扩展注册和 V1 迁移合同。

## 变更性质

- **正式替代**：V2 替代 V1 的“选中即显示工具条并自动打开 Composer”行为。
- **兼容窗口**：旧宿主保留一个正式 release 的 V1 compatibility adapter；新 bundle 默认协商 V2。
- **回滚**：capability probe 或 workspace policy 可在窗口期回退到 V1；窗口结束后移除 V1 runtime。
- **安装入口**：`@yeisme/dsh-selection-annotation` 包名与安装命令保持不变。

## 文件导航

- `proposal.md`：问题、范围、能力账本和兼容分类。
- `design.md`：统一交互层、状态机、组件、扩展 SDK、偏好和发布门。
- `specs/dsh-selection-agent-review/spec.md`：对既有 V1 capability 的行为修改。
- `specs/dsh-selection-interaction-v2/spec.md`：V2 新增合同与场景。
- `tasks.md`：按依赖排序的实现、测试、文档和迁移任务；初始均未完成。

## 相关文档

- `../../../docs/design/dsh-selection-interaction-v2.md`
- `../../../docs/design/dsh-selection-agent-review-v1.md`（V1 历史基线）
- `../../../openspec/specs/dsh-selection-agent-review/spec.md`（当前已归档规范基线）
