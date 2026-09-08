# 创作工作台 Host 验收补丁

在已应用 `composer-multi-reference-v1` 与 `editable-prompt-references-v1` 的验证 Host staging 上，执行 `bash apply.sh <host-checkout>`。此包只新增合成验收测试与 fixture；不会修改 Host 产品实现。已有同名文件时 apply-check 拒绝覆盖。

先构建本仓 Creator、Browser、桌面和 Pane bundle 及 Host 适配，再在本仓运行 `node scripts/run-creative-workspace-host-tests.mjs`。运行器使用本地 `temp/dsh-unified-host-source`，通过环境参数传递本地模块位置，不需要凭据或外部模型服务；发送验证使用 keyless replay。fixture 通过公开 owner directory 注册合成成果适配器，不直接注册 Composer 引用 owner。

验证真实 ModuleLoader 加载、超过摘要长度的正文编辑与预览、合成 owner 保存回执、选定 candidate two 的私有 Composer 插入回执、360/960px 亮暗显示与宿主主按钮文字对比度。Browser manifest 正常加载，但缺真实 provider 时入口必须不注册；本测试不宣称 Browser 实际 viewport 可用。图片框选另验证 Host 附件存储、实际裁剪与模型图片内容块；真实领域媒体服务、领域持久化、采纳、写回和开发环境仍须独立服务验收。

通过证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T02-30-55-511Z-2641224/`；测试 exit 0、source_inputs_unchanged=true、页面错误及警告为 0。此前失败记录保留。

图片链路最新证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T02-59-27-559Z-3853678/`；exit 0、source_inputs_unchanged=true，原图宽 726px、实际附件宽 364px，模型 content 数组中恰有 1 个原生 image block，1 次 keyless 回放，0 个页面错误／警告。此前并发构建导致的启动失败包保留。
