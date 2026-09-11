# 工具发现与绑定草稿验收

本变更的工具发现、草稿交接和布局回归已完成本地验收。独立审查发现的元数据、超时、回执关联、双栏、原因说明和多实例焦点问题已修复；最终交互证据以本页所列最新run为准。

## 本功能通过的检查

| 检查 | 结果 | 本项目 temp/integration-test-runs 下的证据 |
|---|---|---|
| 目录Host、工具UI、运行时脚本 | 13 + 79 + 10项通过 | tools-discovery-focused-surfaces-plugins-openspec-layout-patches-2026-09-11T07-32-50-936Z |
| surface、插件、OpenSpec | 全部通过 | 同上 |
| 布局原版负对照、360/560/960 × 正常/矮容器 | 原版手柄缺陷可复现，修复后全部通过 | 同上；tools-discovery-layout-2026-09-11T06-32-43-198Z |
| 干净基线补丁链与重复应用 | 通过 | 同上；tools-discovery-patches-2026-09-11T06-38-46-866Z |
| 八项工具浏览器场景 | 8/8通过；没有更新旧截图或阈值 | tools-discovery-visual-tools-2026-09-11T07-31-43-235Z；ui-visual-2026-09-11T07-31-43-290Z-2000947 |
| 真实Host、Tools bundle、A/B草稿 | 通过；模型请求0 | tools-discovery-host-2026-09-11T07-34-29-061Z |
| 相关包类型、宿主与bundle构建 | 通过 | tools-discovery-feature-build-2026-09-11T06-55-41-446Z 的四个构建子项；后续本地bundle重建与运行时检查通过 |
| 动效策略扫描 | 0警告 | check_motion_policy.sh packages/client/ui-mcp-inspector/src |

浏览器组件场景使用真实Tools组件、模拟目录和草稿owner，覆盖中文用途及行摘要、两次范围往返、明确A目标、添加去重、目录过期恢复、安装但会话不可用、宽屏双栏、窄屏返回/Escape、两实例返回焦点及行高/控件遮挡检查。

真实Host场景使用隔离的合成A/B会话与真实内置工具目录，验证两项引用仅加入A、既有正文保留、B草稿不变、不自动导航、重复引用不堆叠、外层分屏真实拖拽和返回对话后的正文调宽恢复。没有执行工具或请求外部MCP/模型，不代表外部服务的授权、连接或业务调用验收。

## 全仓检查与共享改动

全仓 `pnpm run typecheck` 已运行，但在其他在途源码的 `ui-ai-drama-director` 构建阶段失败：`dsh-rich-media/client` 未导出 `MediaCompareRenderer`。证据为 tools-discovery-focused-typecheck-surfaces-plugins-2026-09-11T06-37-45-956Z。相关工具包的独立TypeScript检查通过，未修改其他业务模块来消除该失败。

`node_modules` 与 lockfile 的 patchedDependencies 存在既有差异。测试使用 `pnpm_config_verify_deps_before_run=warn` 保留当前依赖树，没有通过自动安装或覆盖lockfile解决告警。

实施期间另有说明阅读功能进入同一工具包。其 `reference-reader.owner.spec.ts` 要求专用集成证据环境，直接运行全Host包测试出现前置条件错误；本变更的focused门明确列出原五个相关Host测试，不伪装该前置条件为产品通过，也不修改说明阅读实现。对应失败保留在 tools-discovery-focused-surfaces-plugins-openspec-2026-09-11T07-17-56-997Z。

全仓 `pnpm run test:visual` 已完成：134/170通过、36失败，证据为 tools-discovery-visual-2026-09-11T07-34-38-427Z 和 ui-visual-2026-09-11T07-34-42-684Z-2095234。本功能8项在该全仓执行中也全部通过。

失败归因：27项选择工具栏用例请求 `/selection`，但共享checkout的既有改动已删除该fixture与client资源route，因此等不到data-ready；9项旧Tools用例仍调用已随活动迁移移除的 `deriveToolActivity`。只读浏览器诊断复现后者报错 `exports.deriveToolActivity is not a function`，证据为 tools-global-visual-diagnostic-2026-09-11T07-42-57-233Z。本变更仅向server增量添加 `/tools-discovery`；没有恢复其他在途改动删除的route，没有删除旧测试、修改旧截图或放宽阈值。全仓视觉没有标为通过。

## 可复跑命令

```bash
node scripts/run-tools-discovery-checks.mjs focused surfaces plugins openspec layout patches
node scripts/run-tools-discovery-checks.mjs feature-build
DSH_TEST_CHROME_EXECUTABLE=/usr/bin/google-chrome node scripts/run-tools-discovery-checks.mjs visual-tools
node scripts/run-tools-discovery-host-tests.mjs
pnpm run typecheck
DSH_TEST_CHROME_EXECUTABLE=/usr/bin/google-chrome pnpm run test:visual
node scripts/dsh-workbench.mjs --check
bash .agents/skills/yeisme-ui-motion-quality/scripts/check_motion_policy.sh packages/client/ui-mcp-inspector/src
```

Chrome路径是本机已安装浏览器的显式覆盖，其他环境使用其已安装浏览器及项目provenance检测。构建和视觉服务读取产物须串行，不能并发清理lib。

## 兼容与回滚

增量接口为可选 `purpose` 元数据、Composer bridge `targetFor` 及可选能力引用resolver。旧list/setEnabled与引用发送合同不移除、不重命名；Host回执必须精确关联requestId和目标。宿主改动保存在独立 `tools-pane-layout-v1`、`tools-draft-target-v1` packet，已验证干净重建和幂等。

回滚只撤销本change自有代码及两份packet增量并重建对应客户端，不重置用户会话、布局、草稿、偏好或其它在途改动。尚未提交或发布。
