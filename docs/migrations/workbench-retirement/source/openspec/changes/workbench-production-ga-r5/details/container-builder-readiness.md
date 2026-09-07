# Container Builder Readiness

## 当前结论

Workbench 已具备容器静态装配合同，但当前开发环境没有可用的 Docker、Podman、Buildah 或 nerdctl，因此不能生成真实 image build、inspect、read-only filesystem、probe、signal/drain 或 layer/source/secret smoke 证据。`3.4b3c` 必须保持未完成。

## 已完成边界

- `workbenchd`、`workbench-worker` 与 `workbench-migrate` 使用 `CGO_ENABLED=0` 生成发布二进制。
- Web BFF 使用 Bun compile 生成 `dist/release/bin/workbench-web`，静态资源位于 `dist/release/web/`。
- `Dockerfile` 提供 `api`、`worker`、`migration`、`web` 四个显式 target。
- Go runtime 使用 `gcr.io/distroless/static-debian12:nonroot@sha256:f5b485ea962d9bd1186b2f6b3a061191539b905b82ec395de78cbfae51f20e35`。
- Web runtime 使用 `oven/bun:1.3.14-distroless@sha256:c28c51287af70bab8e0b66fc4b6a30cfb92a727ebc88045223adc9f4c9d09307`。
- `.dockerignore` 默认排除全部内容，仅允许镜像装配所需的 `Dockerfile` 与 `dist/release` 子集。
- local profile 继续强制 loopback；managed profile 只有显式开关时可绑定 `0.0.0.0` 或 `::`。
- Web managed readiness 动态验证 PostgreSQL session 与 login transaction repository；停止时先转为 not-ready。

## 当前阻塞

1. `3.4b2b` 尚未关闭：工作区 source dirty；worker已接正式managed bootstrap与冻结registry输入，但 authority/role engine尚未接入且仍claim-disabled，缺少 R4 immutable worker handoff 与 approved builder digest。
2. 本机无 container engine/builder，不能证明目标镜像可拉取、可构建或可运行。
3. 尚未执行 non-root UID、read-only root filesystem、tmpfs、capability、network/egress、probe、SIGTERM/drain 与 image layer 内容检查。
4. 尚未生成 image digest、SBOM、provenance、signature 与 component evidence 六件套。

## 后续执行顺序

1. 完成 `3.4b2b`，生成 clean、批准且可追溯的完整 artifact manifest。
2. 已完成 `3.4b3b2a`：`task container:plan` 会精确绑定 promotion、manifest、report、磁盘artifact tree与镜像定义，`task container:plan:validate` 会重新校验并拒绝人工提权；当前alpha manifest只能生成`build_authorized=false`诊断计划。
3. 完成 `3.4b3b2b`，接入stable v3 promotion authority、R4 immutable worker handoff与approved builder provenance，签发不可手工提权的authorized plan。
4. `task container:build` 目标已实现为 fail-closed 门禁（2026-08-27，R5 C-2 切片）：重新校验 plan 绑定，只有 `build_authorized=true` 且 approved engine/daemon 可达时才会构建四个 target 并写出 `workbench.container_image_build.v1alpha1` digest 证据；诊断 plan 返回 `container_build_unauthorized`（exit 5），无 engine/daemon 返回 `container_engine_unavailable`（exit 2），均不写证据文件。在批准 builder 上以真实 authorized plan 运行仍未执行。
5. 实现并运行 `task container:smoke` 与 `task test:container:component`，覆盖启动、配置失败、探针、只读文件系统、最小权限和 signal/drain。
6. 通过后关闭 `3.4b3c` 与父任务 `3.4b3`，按 `approved-builder-provenance-handoff.md` 完成builder Provider Ready/Consumer Done/Joint Integration，再进入image SBOM、signature与advisory authority。

静态合同、宿主机二进制启动或 Dockerfile lint 均不能替代第 3、4 步。
