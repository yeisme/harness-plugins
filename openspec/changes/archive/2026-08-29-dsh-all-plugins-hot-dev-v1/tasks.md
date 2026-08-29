## 1. Dev command core

- [x] 1.1 实现 workspace package/bundle 发现、外部 `--plugin` 校验与 dependency/dependent graph。
- [x] 1.2 实现初始 dependency-closure build、官方 `dsh plugin add link:` profile 同步和 composed config probe。
- [x] 1.3 实现临时 HMR overlay 生成、DSH child 启停与 signal 对称清理。

## 2. Hot reload loop

- [x] 2.1 实现 workspace/external plugin watcher、事件 debounce 与单写 build queue。
- [x] 2.2 实现 transitive dependent build 和成功 runtime artifact pulse。
- [x] 2.3 实现 manifest/patch/bundle 集合变化后的 profile resync 与安全 restart。

## 3. Command surface and documentation

- [x] 3.1 通过 package CLI 增加 `dsh:dev`、`test:dsh-dev` 与 `test:dsh-dev:integration` scripts。
- [x] 3.2 增加中文开发文档，覆盖默认启动、外部插件、check/prepare、失败恢复和回滚。
- [x] 3.3 保持现有 DSH/bundle 命令不变，并记录 additive contract classification。

## 4. Verification and local installation

- [x] 4.1 增加 parser/discovery/graph/patch/change classification/process helper 单元测试。
- [x] 4.2 增加始终写入脱敏 evidence 的 integration runner，并检查完整文件集。
- [x] 4.3 运行真实 prepare，把全部本地 bundle 安装到 DSH Web profile并通过 dump-config/startup smoke。
- [x] 4.4 运行 focused tests、bundle contracts、strict OpenSpec、typecheck 与 diff audit。
