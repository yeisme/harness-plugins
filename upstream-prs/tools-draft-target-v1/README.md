# 工具草稿目标 V1

为已绑定但未激活的会话暴露只读的 `targetFor` 草稿快照，并提供从
`referenceTools` / `skills` 目录重建结构化工具与 Skill 引用的可选 Host resolver。
不会切换会话、聚焦 composer、发送消息或执行工具。

依赖 `../unified-multi-pane-workbench/`，随后是 `../composer-multi-reference-v1/`。
应用脚本校验该发布基线并对自身补丁幂等；前置补丁缺失时 `git apply --check` 会拒绝。
应用后，DSH Tools Pane 可先捕获指定
会话的 workspace、draft revision 与已有引用，再用相同 session 的权威目录重建 proof；
Host 插入回执失败或 revision 已变化时，引用不会显示为已加入。

```sh
bash ./apply.sh /path/to/dsh-checkout
```
