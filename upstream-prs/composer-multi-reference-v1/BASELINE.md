# 基线与补丁清单

- Host 基线：`a66e4702047846cdaa10c66c9d3df3951f5ea70d`
- Host 版本：`0.1.2-rc.1`
- 必须先应用：`../unified-multi-pane-workbench/`
- 先行补丁基线：`a66e4702047846cdaa10c66c9d3df3951f5ea70d`
- 先行补丁 SHA-256：`5ed8879578790e3be5d299e8d5f005ba7969eaf8ce2e1c8e0f517ab2e5c9d96e`
- 补丁文件：`changes.patch`
- 最终 `changes.patch` SHA-256：`f6beaf89770ff8aaa510ee88551a874bfa12a5d47cfef507ed608b68a0cf7547`
- 原始引用实现基线：`/tmp/dsh-reference-owner-baseline.eiDjLp`
- 补丁 diff：73 个文件；应用后 frozen owned parity：75/75

补丁覆盖以下功能边界：

- `packages/api/session-controller/`：实际 Session client/Remote transport、Host admission、owner 重校验和持久化 message source。
- `packages/client/ui-conversation/`：真实目标、caret、draft revision CAS、Lexical chip、发送确认后清理、失败保留和同步移除。
- `packages/client/ui-conversation/`：Host-owned 目标选择器、输入区目标名称、显式 activation 聚焦回执，以及 request ID 与完整 target/proof/activation 的重放约束。
- `packages/client/ui-reference/` 与 `ui-input-trigger/`：兼容旧 `@` 行为的分组结构化候选。
- `packages/context/file-reference*`：cwd fail-closed、规范路径约束、`O_NOFOLLOW`、fd identity、范围与 manifest digest。
- `packages/context/session-reference/`：把 Host 冻结的有界内容加入实际模型上下文。
- `packages/client/ui-chat/`：历史消息引用标签投影。
- 对应 focused tests。

已验证：

```sh
git archive a66e4702047846cdaa10c66c9d3df3951f5ea70d | tar -x -C <clean-dir>
bash ../unified-multi-pane-workbench/apply.sh <clean-dir>
git -C <clean-dir> apply --check changes.patch
git -C <clean-dir> apply changes.patch
```

应用后的 owned 文件须逐文件与 staging 冻结点比较，内容一致。窄屏 AppFrame 三文件增量以先行补丁为直接基线；`Workbench` 新文件仍由先行补丁拥有。补丁不包含 Provider credential、真实模型调用、lockfile 或其他并行 UI layout/sidebar 修改。

最终真实组合验收使用隔离构建的插件根，未读取共享工作树中的旧产物：

```sh
DSH_REFERENCE_PLUGIN_ROOT=<isolated-plugin-root> \
  node scripts/run-composer-reference-host-tests.mjs reference-composer-multi.e2e.ts
```

- 结果：PASS
- Evidence：`temp/integration-test-runs/composer-host-2026-09-05T18-48-25-818Z-2858644/`
- 覆盖：10 类引用、2 次真实 keyless model receiver、owner model context、无 tool call／无 Agent 自动启动、显式 activation、目标切换与草稿隔离、360/560/960、360 `@` 菜单、dark 与 reduced motion。
- 隔离插件源码 pre/post manifest SHA-256：`3fd1b83ef3293e26602c8c607b41ca90bdc8561c0954d3b7fa97ab74175cf945`
- 隔离插件构建产物 manifest SHA-256：`778470b4cb4d6099be37adbad3684eb532661f7f07decd830e34866f3c8b2fe8`
