# DSH URL Session 契约

一个链接对应一个会话。本文件是 Harness Plugins 侧的 URL 真源；行为规格以 OpenSpec change `dsh-url-session-v1` 为准。

## 形式

```text
http://127.0.0.1:3080/s/<sessionId>     # canonical，打开/恢复会话
http://127.0.0.1:3080/?s=<sessionId>    # 合法别名；无 SPA fallback 时仍可用
http://127.0.0.1:3080/s/<id>#msg-<seq>  # 预留：消息锚点（未交付）
/s/<id>?prompt=<urlencoded>             # 预留：仅预填草稿，永不自动发送（未交付）
```

规则：

1. `sessionId` 是单个 `DSH_HOME` 内全局唯一的既有 SessionId。URL 不编码 workspace、cwd、title。
2. path `/s/<id>` 与 query `s` 语义等价；同时出现且不一致时以 path 为准。
3. 打开时由会话 cwd 反查已注册 workspace 并切换。
4. Prompt 内 mention 仍是 `dsh-session:<id>`。本切片不注册操作系统协议。
5. URL 不含 token、cookie、Authorization 或草稿正文。绑定 `0.0.0.0` 时，持有链接即持有该 Host 的访问权。
6. URL 只在当前 Host 进程生命周期内承诺。随机端口下以启动打印的 URL 行为准。

## 客户端

装有 `@yeisme/dsh-url-session` 后：

- 侧栏切换会话会更新地址栏（History API）。
- 前进/后退切换会话。
- 刷新：在 `?s=` 或已启用 historyFallback 的 `/s/<id>` 上回到同一会话。
- 会话不存在时显示「会话不存在或已被清理」，可返回列表；不白屏。

未装插件时地址栏不反映会话。`?s=` 仍可手工粘贴，但不会自动选会话。

## CLI

```bash
dsh web --resume <session-id>
dsh web --resume <session-id> --no-open
```

有 historyFallback 时打开 `/s/<id>`，否则打开 `/?s=<id>`。`--no-open` 把完整会话 URL 打到 shell 的 URL 行。

会话内 `/url` 打印或复制当前链接。`--agent` 含 additive 键 `session.url`。

## 回滚

```bash
dsh plugin --profile web remove @yeisme/dsh-url-session
```

卸插件后停止 URL 同步。关掉 `historyFallback` 后，硬刷新 `/s/<id>` 恢复为今日 404。

## 未交付

`#msg-<seq>` 滚动、`@session` 点击内跳、`?prompt=` 预填不在 V1。若实现预填，必须停在草稿态，不得自动发送。
