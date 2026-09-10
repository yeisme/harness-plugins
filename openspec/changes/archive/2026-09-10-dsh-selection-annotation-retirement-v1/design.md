## 退役范围

用户截图中的文本/评论/复制引用/加入批注组/更多工具条归selection-annotation。移除已安装入口，不把共享interaction-space Pane一起删除。旧bundle apply为空，不安装监听器/样式/浮层；其源码保留作兼容历史，不代表允许再次启用。interaction-space自动挂载同一工具条的入口亦移除。

## 数据与运行

用npm pkg delete移除profile bundle数组项，用dsh plugin --profile web remove @yeisme/dsh-selection-annotation和对应ui-acceptance命令移除依赖。仅修改两个活动profile，不触碰备份profile、草稿、会话、凭据和引用。已打开页面可能仍持有旧代码，需要刷新；不为此中断其他运行任务或重启服务。

## 验证

旧bundle构建后smoke调用apply并创建真实DOM选区，确认无工具条、composer或样式注入。interaction-space与bundle构建验证保留Pane。检查两profile不再包含插件依赖或bundle项。

## 后续限制

dsh-selection-popover-visual-unity-v1停止，不继续视觉验收。用户未授权重新启用。本change为退役，不声称物理删除全部历史文件或独立远程仓库（该插件属于harness-plugins仓库）。

## 用户要求彻底清理后的落实

后续用户明确要求彻底清理，因此不再保留可执行兼容空壳。已物理删除ui-selection-annotation和dsh-selection-annotation两包（含lib构建产物、源码、测试、manifest），删除专属选区浏览器夹具与证据runner、移除统一视觉检查表/命令目录中的插件行、移除desktop-workbench旧submit事件监听、隐藏workspace designer的选区工具条设置入口。包管理器重新生成lockfile并清理安装链接，catalog CLI重新生成目录。web/ui-acceptance的卸载继续有效。

历史OpenSpec、迁移补丁与旧测试证据只作审计，不执行；共享dsh-selection-host的领域锚点合同和interaction-space能力继续为其他Pane所用，不因插件退役删除用户引用或破坏领域协议。物理包已不存在，旧历史安装路径无效。禁止再次从历史补丁启用本插件。

清理后验证：两个包目录不存在，lockfile/catalog不含插件；两个活动profile无依赖/注册；workspace与desktop类型检查通过，surface检查28个client及plugin检查通过。命令目录移除对应bundle并调整库存断言；公共visual.spec同时移除退役选区用例，保留其他表面测试。历史patch和引用领域的协议名不属于插件加载入口，保留作审计及其他消费者兼容。
