# Open Design Studio

Open Design Studio 是 Yeisme Workbench 中面向设计发现的高级 Owner-consumer 模块。它按 [Agent-first 应用 Blueprint](agent-workbench-blueprint.md) 进入 Studio/Preview/Review Pane 或保留稳定 advanced route/deep link，不再定义与 `/agent` 并列的主产品壳。当前只维护已同步到 `openspec/specs/open-design-studio/spec.md` 的只读体验基线；prompt、candidate、review 与 handoff 的生产闭环不在当前交付范围，后续若重新启动必须新建 OpenSpec change。

Open Design 项目 ID：`open-design-studio-experience`。

## 产品一句话

把 Brief、参考图、提示词文件、候选设计、审查证据和交付包放在同一个可直接操控、可追溯的空间工作室中。

## 首轮页面

1. **Project Studio**：项目状态、来源关系、当前候选、阻塞与下一步。
2. **Prompt Library**：按 owner / asset type / collection 分类的提示词文件、版本和差异。
3. **Candidate Compare**：2–4 个候选的视觉比较、来源和反馈。
4. **Review Evidence**：接受、退回、部分接受、风险和 safe evidence refs。
5. **Handoff**：UI spec、视觉资产、合同缺口和前端 owner 交付清单。

完整页面对象、控件、状态和合同姿态见 [Open Design Studio 页面矩阵](open-design-studio-page-matrix.md)。

## 当前 API 能力

- 已发现：projects、project files、agents、skills、design systems、project generation status。
- 待定义：reference safe projection、prompt version、candidate、review decision、handoff manifest。
- 所有待定义能力在 UI 中必须标记为 unavailable 或 needs contract，不能用前端本地状态冒充 owner 成功。

## 视觉原则

- 复用 Apple Spatial Workbench 母版。
- 默认图标，Hover/Focus 显示当前语言 Tooltip。
- 左侧导航、顶部 Focus Lens、中央空间舞台、右侧悬浮 Inspector 是固定外壳。
- 文字只在理解对象、状态、成本、权限和动作时出现。
- 英文用于 Open Design 品牌、路径、稳定 ID、快捷键与技术名词；不要中英文重复展示。
