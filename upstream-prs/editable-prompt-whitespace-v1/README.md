# 可编辑引用发送空白保留

在 editable-prompt-references-v1 之后应用本增量，先决文件精确 hash 见 baseline.sha256。执行 `bash apply.sh <host-checkout>`。只修改既有 Composer sink 序列化：包含合法 editable prompt 的草稿保留完整投影（包括首尾空白和插入分隔符），普通文本／V1 继续 trim。不得通过仅 trim 预览来冒充无损一致性。

测试包含引用尾部空白和原有 V1 提交行为；真实 Host 比较发送预览、冻结 user/message content 与模型 user content 的精确文本。最新证据见 owning change verification.md。代码在 staging 验证，本包是上游适配通道，未修改官方发布版。
