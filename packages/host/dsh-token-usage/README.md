# @yeisme/dsh-token-usage-host

Host owner of the process-scoped token usage ledger and the DeepSeek
official-route balance projection.

- The ledger folds **deltas** of the official `sessionProjections`
  `tokenUsage` buckets (`uncachedInputTokens` / `outputTokens` /
  `cacheReadTokens` / `cacheWriteTokens`). It never replays session logs and
  never builds a tokenizer. First observation after a host restart counts
  once — the ledger scope is "since process start".
- Providers are attributed from official `request/context` session events;
  sessions without one fold into `unknown`.
- DeepSeek balance is queried only for the `deepseek-official` route, with
  the API key resolved through the credential port (`apiKeyEnv`, default
  `DEEPSEEK_API_KEY`). The key, bearer header, and base URL never enter a
  projection, log, or error message; amounts stay official strings.
- Remote: `tokenUsage.snapshot()` and `tokenUsage.refreshBalance()` (15s
  throttle; failures keep the last good amounts marked `stale`).

This package is part of
[agent/harness-plugins](https://github.com/yeisme/agent) and follows its
governance: no DSH core fork, no browser-side domain store, honest degrade.
