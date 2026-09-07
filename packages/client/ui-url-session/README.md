# @yeisme/dsh-client-ui-url-session

DSH URL Session 客户端包：把「一个链接 = 一个会话」固化为可复用 codec。

- 主形式 `http://<host>/s/<sessionId>`；别名 `http://<host>/?s=<sessionId>`（无 SPA fallback 时仍可用）。
- `file:` 地址（Electron）经 `?s=` 别名同样可解析。
- Prompt 内 mention 保持 `dsh-session:<id>` 规范；codec 可从中抽出 id 供后续内跳复用（P4）。
- URL 不含 token、cookie、Authorization 或草稿正文；绑定 `0.0.0.0` 时持有链接即持有该 Host 访问权。

## codec 子路径（纯函数，零 Cordis、零 window 访问）

```ts
import { parseSessionLocation, sessionUrl, mentionSessionId } from '@yeisme/dsh-client-ui-url-session/codec'

parseSessionLocation({ pathname: '/s/abc123', search: '' })   // { sessionId: 'abc123', source: 'path' }
parseSessionLocation(new URL('http://127.0.0.1:3080/?s=abc123')) // { sessionId: 'abc123', source: 'query' }
sessionUrl({ origin: 'http://127.0.0.1:3080', sessionId: 'abc123' }) // 'http://127.0.0.1:3080/s/abc123'
mentionSessionId('dsh-session:abc123')                        // 'abc123'
```

解析不变量：

1. path `/s/<id>` 恒优于 query `s`；path 形式一旦出现即独占判定，非法 path id 不回退 query。
2. `sessionId` 使用既有字面量：单次标准解码后按保守字符集校验；空/非法 id 一律为「未指定」（`null`）。
3. 生成端契约错误（origin 携带 userinfo/query/hash、sessionId 非法）抛 `TypeError`，不产出半合法 URL。

## 状态

规格真源：`openspec/changes/dsh-url-session-v1/` 与 `docs/protocols/dsh-url-session.md`。URL↔runtime 同步、缺失会话空态、复制/新标签入口与可安装 bundle 属于后续切片；当前包入口为 no-op host face。
