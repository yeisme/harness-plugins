# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 退役活动 launcher与handoff，保留公共兼容形状；验收零V2/legacy调用与既有导演回归。 | evidence: 177 package tests passed; all five intents and legacy command make zero remote calls; existing inbound compatibility retained.
- [x] 1.2 运行 package tests/typecheck、strict和diff检查并归档。 | evidence: Package typecheck/build and strict validation passed; no public symbol or wire shape removed.
