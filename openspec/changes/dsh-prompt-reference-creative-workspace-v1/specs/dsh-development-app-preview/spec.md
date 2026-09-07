## ADDED Requirements

### Requirement: DAP-01 Workspace development environment identity
应用预览 SHALL 连接当前工作区 owner 提供的开发／测试环境，显示安全环境名称、工作区、连接状态和可获得的身份提示；未知身份 SHALL 明确显示未知。本能力 SHALL NOT 自动连接生产环境或复制宿主认证材料。

#### Scenario: Connect to a running development service
- **WHEN** 当前工作区已有授权开发服务
- **THEN** 用户打开预览可连接该服务并看到环境与状态，不将单纯 HTTP 可达当成功能验收

#### Scenario: Environment or identity is unavailable
- **WHEN** owner 未发布可用环境或登录身份无法确认
- **THEN** 分别显示无环境或身份未知，不猜测地址、不继承宿主 token

### Requirement: DAP-02 Explicit service startup and existing permissions
未启动服务 SHALL 提供 owner 发布的显式启动入口，沿用现有工具与权限机制。打开预览 SHALL NOT 自动执行启动命令、创建调度器或重复运行未确认动作。

#### Scenario: Start a stopped application
- **WHEN** 用户在未运行状态点击 owner 允许的启动动作
- **THEN** 通过既有流程提交一次并显示回执；只有 owner 确认后才更新运行状态

#### Scenario: Startup outcome is unknown
- **WHEN** 启动请求超时或结果未知
- **THEN** 保留原动作身份等待对账，重新打开预览不再启动第二个实例

### Requirement: DAP-03 Supported isolated application execution
可运行页面 SHALL 使用 Host 支持的独立 origin／受控预览 seam；生成 HTML SHALL NOT 在宿主 DOM 中执行，插件 SHALL NOT 建立任意 iframe bridge、复制 cookie 或绕过 CSP／frame 限制。环境句柄和访问 SHALL 由 owner 管理。

#### Scenario: Embedded preview is unsupported
- **WHEN** Host 缺少受支持 seam 或应用禁止嵌入
- **THEN** 显示具体原因，仅提供 owner 授权的外部页面入口，内嵌场景保持未验收

#### Scenario: Page performs a development operation
- **WHEN** 用户在连接的开发页面中触发实际交互
- **THEN** 操作使用该应用既有身份与权限，预览持续显示环境标识，不自动代理宿主高权限

### Requirement: DAP-04 Disconnect and switch preserve user work
预览断连或切换环境 SHALL 保留成果与编辑草稿，切换 SHALL 使旧连接句柄失效；恢复 SHALL 读取 owner 状态或使用其恢复动作，不重新执行上次启动或页面业务操作。

#### Scenario: Recover a disconnected preview
- **WHEN** 服务断开后用户重新连接
- **THEN** 页面状态由当前环境重新确认，输入草稿和候选不丢失，不自动重放上次 mutation

#### Scenario: Switch workspace environment
- **WHEN** 用户切换到另一授权工作区环境
- **THEN** 旧访问句柄停止使用，界面更新明确环境信息，不将旧环境请求发送到新目标

### Requirement: DAP-05 Separate protocol and runtime evidence
验证 SHALL 分开记录插件协议、Host seam、真实环境交互及最终产品验收。缺少运行能力 SHALL NOT 由 mock 或静态构建替代。运行证据 SHALL 写入所属仓库 temp/integration-test-runs，使用合成内容并脱敏。

#### Scenario: Plugin gates pass without a running environment
- **WHEN** 插件合同测试通过但没有真实 Host／开发环境证据
- **THEN** 只记录插件协议通过，完整产品和环境交互验收仍未完成
