# @yeisme/dsh-url-session

DSH session URL deep-link bundle. `/s/<id>` is canonical; `?s=<id>` remains the compatible alias.

## Install (web profile)

```bash
dsh plugin --profile web add /path/to/harness-plugins/packages/bundle/dsh-url-session
```

Both packages resolve from the workspace: the thin bundle `@yeisme/dsh-url-session`
plus its client implementation `@yeisme/dsh-client-ui-url-session` (installed as a
direct dependency; no manual leaf installs are required).

## What you get (P1, `?s=` alias)

- Boot reads the address bar: a valid `s` selects that session (workspace
  switching rides the runtime's own cwd→workspace resolution).
- Sidebar/session selection pushes `?s=<id>`; re-selecting the same session
  replaces instead of spamming history; browser back/forward (`popstate`)
  reverse-selects.
- A deep link to an unknown/cleaned session renders an in-conversation empty
  state 「会话不存在或已被清理」 with a 返回列表 action that clears the URL
  claim; boot never fails.
- Session header menu: 复制会话链接 / 在新标签页打开（links carry only
  origin + SessionId — no token, no cookie, no draft text).

## Uninstall / rollback

```bash
dsh plugin --profile web remove @yeisme/dsh-url-session
```

Removing the bundle restores the stock address bar behavior; nothing writes
session state, so there is no data migration to undo.

## Security notes

- `0.0.0.0` binding means anyone holding a link holds access — prefer the
  default `127.0.0.1`.
- Clipboard writing is disabled with a visible reason in non-secure contexts.
- `?s=` works on plain upstream profiles and Electron `file://` without any
  server change; the canonical `/s/<id>` path requires the P2
  `historyFallback` (see the change's upstream staging notes).

## Checks

```bash
pnpm --filter @yeisme/dsh-client-ui-url-session run test
pnpm --filter @yeisme/dsh-url-session run test
pnpm run check:bundles   # repo root
```
