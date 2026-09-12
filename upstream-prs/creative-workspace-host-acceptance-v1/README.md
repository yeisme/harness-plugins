# 创作工作台 Host 验收补丁

在已应用 `composer-multi-reference-v1` 与 `editable-prompt-references-v1` 的验证 Host staging 上，执行 `bash apply.sh <host-checkout>`。此包只新增合成验收测试与 fixture；不会修改 Host 产品实现。已有同名文件时 apply-check 拒绝覆盖。

先构建本仓 Creator、Browser、桌面和 Pane bundle 及 Host 适配，再在本仓运行 `node scripts/run-creative-workspace-host-tests.mjs`。运行器使用本地 `temp/dsh-unified-host-source`，通过环境参数传递本地模块位置，不需要凭据或外部模型服务；发送验证使用 keyless replay。fixture 通过公开 owner directory 注册合成成果适配器，不直接注册 Composer 引用 owner。

验证真实 ModuleLoader 加载、超过摘要长度的正文编辑与预览、合成 owner 保存回执、选定 candidate two 的私有 Composer 插入回执、360/960px 亮暗显示与宿主主按钮文字对比度。Browser manifest 正常加载，但缺真实 provider 时入口必须不注册；本测试不宣称 Browser 实际 viewport 可用。图片框选另验证 Host 附件存储、实际裁剪与模型图片内容块；真实领域媒体服务、领域持久化、采纳、写回和开发环境仍须独立服务验收。

通过证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T02-30-55-511Z-2641224/`；测试 exit 0、source_inputs_unchanged=true、页面错误及警告为 0。此前失败记录保留。

图片链路最新证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T02-59-27-559Z-3853678/`；exit 0、source_inputs_unchanged=true，原图宽 726px、实际附件宽 364px，模型 content 数组中恰有 1 个原生 image block，1 次 keyless 回放，0 个页面错误／警告。此前并发构建导致的启动失败包保留。

HTML 结构预览增量证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T03-19-37-803Z-851013/`。完整源码与安全投影独立，实际脚本未执行、测试资源请求为 0；360/560/960px 及亮暗主题通过。测试等待 Host 既有 ResizeObserver 布局收敛后验证几何，不修改 Host 布局实现。该包六文件 apply／逐字节比对／reverse 检查通过。

最新页签／刷新证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T03-58-44-011Z-2755828/`，exit 0、source_inputs_unchanged=true。当前测试从 Eikona 的“Candidates and edits”入口进入，验证成果页签 Arrow/Home/End、ARIA 关联及 Creator 引用刷新取消／替换；仍同时验证 HTML／图片原生发送。需使用包含该入口的当前 Creator bundle，不能用 fixture 直接挂载 UI 绕过正常加载。

最新 Mermaid／图像模式验收：`temp/integration-test-runs/creative-workspace-host-2026-09-08T04-29-57-727Z-3959604/`。测试 profile 现在明确加载 `dsh-mermaid-render` 并验证真实 parser、编辑后 SVG 节点文字／填充／连线；图片查看缩放后返回框选再发送。console errors／page errors／warnings 为 0。该插件须先构建，不以 Mock 替代；Host 补丁仍仅包含测试与 fixture。

最新语法恢复证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T04-36-19-414Z-4147706/`，非法 Mermaid 源码保持可编辑，修正后实际 parser 恢复 SVG；页面异常／console error 为 0。

表格最终证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T04-45-37-662Z-220134/`，exit 0、source_inputs_unchanged=true；实际 grid 单元格保留嵌入换行、错误源码修正恢复、预算提示通过，console_errors=0。完整 Host 其他路径仍通过；六文件验收补丁 apply／字节比对／reverse 检查通过。

正文显式重读恢复证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T05-09-26-605Z-1436193/`，首次暂不可用后用户点击 Retry content read 恢复实际表格，source_inputs_unchanged=true。

图表主题往返最新证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T05-13-53-621Z-1561251/`，真实 SVG 亮暗颜色切换与恢复通过；异步旧请求隔离另有 render／graft 17 tests。

TSV 最终证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T05-20-48-162Z-1754756/`，exit 0、source_inputs_unchanged=true，400 行满末页禁用下一页、上一页恢复、360px 翻页和中文内容通过，CSV／Mermaid 错误恢复仍通过。六文件 patch apply／逐字节比对／reverse-check 通过。该证据关闭 task 4.3，不代表真实领域或环境验收完成。

引用无损编辑及撤销证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T05-25-58-875Z-1941308/`，exit 0、source_inputs_unchanged=true。中文／emoji／空行／Tab／嵌套围栏原位往返精确相等，三行 clamp 与实际溢出已测量，展开保留完整正文；删除引用后原生 Ctrl+Z 恢复，后续来源刷新和发送不受影响。Task 2.2 已按该证据完成。六文件 patch apply／字节比对／reverse-check 通过，未改写其他任务完成状态。

发送预览一致性测试现在还要求先应用 `editable-prompt-whitespace-v1`；原引用补丁保持原 hash 不变。最新 evidence：creative-workspace-host-2026-09-08T05-33-39-059Z-2227495，预览／Host 原消息／模型用户正文逐字一致。

ACK 并发编辑证据：creative-workspace-host-2026-09-08T05-43-18-301Z-2522042。同引用改写、新文字保留及历史冻结通过；retained_reference_count_after_ack=2 是尚未解决的精确清理缺口，不能视作 task 2.5 完成。

ACK 精确消费测试还要求先应用 `editable-prompt-ack-consumption-v1`。最新 creative-workspace-host-2026-09-08T05-50-54-774Z-2777600 证明 ACK 后引用数为 1，旧图片移除而新改写保留；早期计数 2 的缺口记录保留为修复前证据。

触摸模式：本仓库执行 `node scripts/run-creative-workspace-host-tests.mjs --touch`。fixture 通过测试专用 DSH_CREATIVE_WORKSPACE_TOUCH=1 创建 hasTouch 浏览器，检查 coarse pointer、点击区域及 tap 操作；默认桌面模式保持原行为。证据不等同物理设备验收。

原生缩放模式：`node scripts/run-creative-workspace-host-tests.mjs --zoom` 使用已安装完整 Chromium、独立临时 profile 和测试扩展设置 browser zoom=2；默认桌面模式保持原路径。测试关闭后删除 profile 与扩展，证据含 zoom 指标及完整物理视口截图，不使用 CSS zoom。
