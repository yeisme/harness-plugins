# 会话目录严格范围增量

原SessionToolCatalog／SessionSkillCatalog新增可选requireResolvedScope。只有布尔true启用严格模式并允许返回scopeResolved:true；旧调用保持原有回退语义和输出字段。

严格模式下，预设不可解析、已指定预设但无解析服务、或解析未返回scope时，拒绝返回全局目录；固定错误details.reason为session_scope_unavailable。没有指定预设且无preset服务时，global是已知基础组合，可以确认范围。Skills严格查询使用原snapshot的complete，不把部分provider目录声称为完整。所有读取仍经原sessionQuery、tools和skills owner，不创建Agent或读取正文。

当前staging未应用补丁。补丁固定三个原文件的Git blob；从harness-plugins根检查：

```bash
bash upstream-prs/session-catalog-scope-v1/apply.sh temp/dsh-unified-host-source --check
```

去掉--check可在指定目标应用。应用后必须在目标DSH根重建host及client生成合同，不能假定旧SDK会转发新字段：

```bash
pnpm run build:lib:host
pnpm run build:lib:client
```

回退源码：

```bash
git -C temp/dsh-unified-host-source apply --reverse ../../upstream-prs/session-catalog-scope-v1/changes.patch
```

回退后同样重建相关生成物。客户端缺scopeResolved证明时禁用严格会话搜索，不回退全局。

验证使用现有`node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs --host`：隔离复制owner源码，应用并进行严格类型检查，加载实际owner类验证旧／严格分支、失败时无目录读取、partial真实性及零Agent创建，最后反向应用并逐字核对原文件。此证据不代表整套部署SDK或会话范围UI已接通；当前实施状态见[搜索中心记录](../../openspec/changes/dsh-search-center-v2/implementation-baseline.md)。
