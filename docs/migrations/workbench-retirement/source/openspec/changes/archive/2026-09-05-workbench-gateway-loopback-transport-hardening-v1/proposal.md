# Workbench Gateway loopback 传输加固

## Why

当前前缀式 host 判断可能把 Bearer token 转发到伪装域名或 redirect 目标。

## What Changes

- 使用 `url.Parse` 与精确 hostname/IP loopback 判断。
- 拒绝 userinfo、query、fragment 和 redirect。
- Bearer 仅发送到已验证的原始 loopback host。

## Impact

影响 Workbench Gateway adapter 与 service tests；不扩大远程访问范围。
