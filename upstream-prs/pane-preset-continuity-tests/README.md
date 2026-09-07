# Pane 命名布局恢复测试

本包只新增 `packages/client/ui-layout/tests/preset-continuity.client.spec.ts`，不修改宿主生产实现。发布基线为 `a66e4702047846cdaa10c66c9d3df3951f5ea70d`，依赖先应用 `../unified-multi-pane-workbench/` 的真实 `WorkspaceLayoutController` 与模型。

测试通过控制器创建、移动、保存和恢复布局；内存适配器仅保存控制器序列化输出，不拥有第二套布局或业务状态。覆盖两／三 Pane 混合项目会话、重复命名模板恢复无重复 Pane、会话与项目标识保持、相同模板名按项目隔离，以及新建控制器从存储恢复。编辑器测试只证明相同资源身份的 Pane 保留、移除／换绑时调用关闭守卫，以及同步拒绝、抛错、异步拒绝、等待全部许可和过期许可不覆盖新布局；不证明编辑缓冲内容持久化、真实会话运行或浏览器渲染。

应用与验证：

```bash
bash upstream-prs/pane-preset-continuity-tests/apply.sh /path/to/staging-checkout --check
bash upstream-prs/pane-preset-continuity-tests/apply.sh /path/to/staging-checkout
cd /path/to/staging-checkout
pnpm exec vitest run packages/client/ui-layout/tests/preset-continuity.client.spec.ts
```

脚本检查发布基线与前置模型／服务；已有相同测试文件保持不变，已有不同文件或链接目的路径拒绝覆盖。此包不自动应用前置补丁，也不包含其副本。

2026-09-07 的独立定向运行：10 个测试通过，退出码 0；没有运行完整构建或浏览器。六件套证据位于 harness-plugins 的 `temp/integration-test-runs/preset-continuity-20260907T104533814334Z/`。`apply.sh --check` 在同一发布基线 staging 上通过。该结果只支持控制器与序列化层验收，不能替代实际工作台模板入口、快捷键发现性与编辑器恢复验证。
