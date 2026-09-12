# Skill文件正文读取增量

归属原DSH Skills registry。普通`get()`保持调用语义；新增可选`getDocument(name, options)`，由owner检查实际provider实例，拒绝runtime注册，即使runtime元数据复制了文件型来源。仅默认filesystem provider的目录型资源可读，并在读取后重新核对胜出provider与目录身份。

补丁以原文件Git blob固定基线，先校验再应用；不会修改其他源码、注册Skill、安装或执行工具。当前staging未应用此补丁，ToolHub探测不到getDocument时明确返回reader_unavailable。接口及验证归[搜索中心v2](../../openspec/changes/dsh-search-center-v2/design.md)，完整阅读UI和相对引用合同继续归[参考Reader](../../openspec/changes/dsh-tools-reference-reader-v1/design.md)。

从harness-plugins根检查现有staging：

```bash
bash upstream-prs/skill-document-reader-v1/apply.sh temp/dsh-unified-host-source --check
```

去掉`--check`可在该目标应用；重复应用不重复插入方法。回退：

```bash
git -C temp/dsh-unified-host-source apply --reverse ../../upstream-prs/skill-document-reader-v1/changes.patch
```

验证复用`node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs --host`：在当次证据artifacts内复制单个owner源码，检查和应用补丁、类型检查并加载实际registry；以受控provider验证文件读取、runtime伪装拒绝、覆盖与移除，再反向应用并逐字核对原文件。测试不触碰当前staging或用户安装的Skill文件。
