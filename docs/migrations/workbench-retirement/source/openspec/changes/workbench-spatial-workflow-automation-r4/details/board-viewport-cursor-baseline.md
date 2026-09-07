# Board Viewport Query Domain 与 Signed Cursor 基线

## 1. 交付结论

`2.3a`已交付独立的`service/internal/boards/query`生产域基线。它只负责请求规范化、复杂度门禁、确定性query digest与HMAC keyset cursor，不读取数据库、不调用Owner、不绑定transport，因此不会把后续repository或resolver能力伪装为已可用。

## 2. 冻结限制

| 约束 | 当前值 | 失败语义 |
|---|---:|---|
| 默认page size | 200 | `page_size = 0`规范化为默认值 |
| 最大page size | 1000 | `board_limit_exceeded` |
| 最大canonical filter clauses | 32 | `board_limit_exceeded` |
| 最大cursor长度 | 512 bytes | request为`board_limit_exceeded`，decode为`board_cursor_invalid` |
| 坐标范围 | `[-1_000_000, 1_000_000]` | `board_invalid_contract` |
| 单轴viewport跨度 | 200000 | `board_limit_exceeded` |
| viewport面积 | 10000000000 | `board_limit_exceeded` |
| zoom bucket | `[-16, 16]` | `board_invalid_contract` |
| cursor TTL | `(0, 24h]` | 配置无效时fail closed |
| HMAC key最小长度 | 32 bytes | 配置无效时fail closed |

零宽、零高、反向bounds、越界坐标与非零revision缺失均被拒绝。坐标先完成范围验证，再计算跨度和面积，避免构造型整数溢出进入查询层。

## 3. Canonical query

- node type、relation type、status token和group ref分别去重并排序；复杂度按canonical clause计数。
- query digest使用SHA-256，绑定contract version、tenant、workspace、Board、bounds、zoom、LOD、canonical filter和page size。
- cursor和Board revision不进入query digest：cursor本身不是查询语义；revision在payload中独立编码，以便稳定区分`board_resync_required`。
- 规范化结果持有自己的canonical slice，不依赖调用方输入顺序。

## 4. Cursor安全合同

格式为：

```text
board-cursor:v1:<base64url-compact-payload>:<base64url-hmac-sha256>
```

紧凑payload使用固定大端字段顺序：version、32-byte query digest、Board revision、`x/y/node_ref` keyset tuple与expiry。最长256字符合法`node_ref`仍保持整个cursor不超过512 bytes。实现不使用offset、不使用unsigned JSON，也不在错误中回显cursor、scope或key。

codec支持current/previous双key轮换。签名使用constant-time比较；签名、格式、query/scope或tuple无效返回`board_cursor_invalid`，expiry返回`board_cursor_expired`，Board revision drift返回`board_resync_required`。使用同一批准key重新构造codec后可继续解码，覆盖进程重启场景。

## 5. 验证证据

执行命令：

```bash
task test:board-viewport-domain:component
```

证据目录：`temp/integration-test-runs/20260720235743-3f71c7dc-6a90-4cd1-980d-16015f3d52d5/`

- status：`passed`
- exit code：`0`
- duration：`8937 ms`
- redaction：enabled
- coverage：unit、20次race、bounds fuzz、cursor decode fuzz、tamper、cross-tenant、cross-Board、query drift、revision drift、expiry、rotation、restart、最长ref长度。

## 6. 后续边界

`2.3a`不声明viewport远程可用。`2.3b1`已实现tenant/Board/state约束的`x, y, node_ref` keyset repository与additive named indexes，`2.3c`已实现deterministic LOD；只有`2.3d1`完成authority、repository、resolver和cursor issuance装配，并由`2.3d2`完成PostgreSQL promotion后，QueryViewport才能进入transport binding。
