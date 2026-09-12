# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对Tools详情、Skill安装来源、MCP资源、文件预览、Markdown及Composer prepare/ack实际合同；逐操作记录source/handler/支持/缺口及配套owner任务，不修改其他在途change。
- [ ] 1.2 冻结版本化正文/引用读取合同、scope/source/revision/linkId/分页和限额；保留旧list/setEnabled，记录兼容与回滚。
- [ ] 2.1 实现Host来源适配与授权正文读取；区分同名不同安装包、项目/全局scope；正文不入目录snapshot或日志。
- [ ] 2.2 实现引用解析与打开时授权检查；包内../、锚点、唯一行内文件名、编码越界、symlink与检查后替换；浏览器不传任意路径。
- [ ] 2.3 实现有界读取、同版本续读、MIME预览授权与来源失效；外链不自动fetch，未知协议拒绝。
- [ ] 3.1 扩展现有Tools详情的说明/引用文件视图，复用renderer、tokens和locale；渲染/源码/搜索、截断说明、空错禁用状态。
- [ ] 3.2 实现两层以上引用导航、前进后退、焦点/滚动/筛选恢复、循环引用和显式并排打开；同版本重复Pane复用。
- [ ] 3.3 接入独立引用到会话动作，选择明确session与固定版本/选区，复用prepare/ack；查看和插入不自动发送/执行。
- [ ] 4.1 验证项目/会话/来源切换、迟到响应、升级/卸载/失权、读取中关闭、HMR/disable清理；不丢已有会话和布局。
- [ ] 4.2 使用既有Vitest/组件和Host测试覆盖安全解析、限额/版本冲突、零自动执行、旧合同兼容与缺失能力降级；集成失败也写六件套证据。
- [ ] 4.3 制作标明fixture的交互样例；Playwright验证360/560/960、中英、中文IME、200%缩放、减少动态效果、键盘往返及会话引用；截图不代替真实来源。
- [ ] 4.4 稳定后执行typecheck/test/build/check:bundles/check:plugins/check:surfaces/test:visual；只修本change引入失败，其他失败分类记录。
- [ ] 5.1 真实兼容DSH中打开已安装Skill、读取两层真实文件引用并返回原位置、引用到明确会话且零执行；覆盖一次缺失或失权恢复；保存脱敏证据。
- [ ] 5.2 更新设计文档与readiness，区分protocol/fixture/real；所有required路径通过后才收口，不因仅有spec或mock测试勾选实现。
