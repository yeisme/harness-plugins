# Design

仅允许 `localhost`、精确 loopback IP 和既有允许的 loopback scheme/port 组合。HTTP client 禁止 redirect；URL 必须无 userinfo、query、fragment。认证头在请求构造前最后校验目标，避免跨 host 传播。
