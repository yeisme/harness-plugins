# 工作流实现基线

## 2026-09-08：纯草案范围解析

`packages/client/ui-pane-domain/src/project-canvas-workflow.ts` 的 `inspectCanvasRunScope` 消费画布共享document，返回 `draft-inspection`，不产生runnable/authorized、费用、运行状态或审批事实。

单节点只包含该操作；分支只沿execution edges选择下游；整图选择operation节点。参考边不参与运行和环路检查。范围外的operation必须有selectedArtifact，缺失则产生missing_external_output，不扩张范围；material/result使用复制出的固定artifact版本，draft只提供node ID，正文不进入control检查结果。预览后源对象在调用方被改动也不改变已复制的artifact版本。

输出保留映射的input/output/purpose和依赖，重复映射同一input时报告ambiguous_input，不猜测应该选择哪个来源。拓扑检查报告环路阻塞，原图保持可编辑。source/target类型的实际兼容性、owner权限/预算、人工审阅与计划冻结仍须由后续合同/执行适配完成；当前结果不能作为提交计划。

7项范围解析测试与10项共享编辑内核测试通过。父任务2.2还包含真实预览UI、owner输入核验和执行绑定，仍保持未完成；子任务2.2a只记录本纯函数与回归证据。

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-domain exec vitest run tests/project-canvas-workflow.spec.ts tests/project-canvas.spec.ts
```

下一步先将共享document接入画布renderer与host存储，并由工作流UI复用范围检查；不新增第二graph、调度器、Ordo替代品或fixture成功回退。
