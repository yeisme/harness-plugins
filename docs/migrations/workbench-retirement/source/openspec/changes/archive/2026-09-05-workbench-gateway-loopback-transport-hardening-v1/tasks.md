# Tasks

- [x] 1.1 替换前缀判断为精确 URL/loopback 校验。
- [x] 1.2 禁止 redirect 与跨 host Bearer 转发。
- [x] 1.3 增加伪装 host、userinfo、query、fragment 和 redirect 测试。
- [x] 1.4 运行 `CGO_ENABLED=1 go test -race ./service/...`。Validation: 全量 `CGO_ENABLED=1 go test -race -timeout 30m -p 8 ./service/...` 210 包全 ok、0 FAIL（含当前树上的 gateway operations fail-closed hold）；`CGO_ENABLED=0 go test ./service/...` 210 包全 ok。注：默认 10m 包超时下 `internal/repository`（race 插桩下 682.9s）超时一次，隔离复跑与 `-timeout 30m` 全量复跑均绿，非回归。
