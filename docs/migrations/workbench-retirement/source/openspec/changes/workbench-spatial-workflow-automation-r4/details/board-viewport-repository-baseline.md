# Board Viewport Candidate Repository 本地交付基线

## 1. 交付状态

`2.3b1`已完成GORM repository、0011 additive indexes与本地component gate；`2.3b2`真实PostgreSQL parity仍待具备隔离namespace权限的DSN，因此本基线不声明production promotion完成。

## 2. Repository不变量

- node candidate固定使用tenant、Board、active state、bounded geometry intersection与`x ASC, y ASC, node_ref ASC` keyset；不使用offset。
- 相交判断使用GORM `clause.Column`和参数化expression；没有用户可控identifier，也不把raw SQL放入production repository。
- type/group filter只消费`2.3a` canonical values；status filter在normalized safe projection index交付前稳定返回`board_needs_contract`。
- visible node/group refs最多1000，所有`IN`按128分块；edge expansion分别查询固定source/target列、去重并按edge ref排序，最多4096条，不扫描全Board edge。
- 每次repository调用使用2秒context timeout；取消、超时和DB错误不返回partial page。
- repository重验query digest，拒绝调用方篡改已规范化请求。

## 3. Schema 0011

```text
version=0011_board_viewport_query_indexes
checksum=sha256:c12fca86074b3ad017c95458e4f9d642fed6248db6976105279d03a7ae87171c
```

新增named indexes：

```text
idx_board_node_viewport_v2
idx_board_node_viewport_type
idx_board_node_viewport_group
idx_board_edge_source
idx_board_edge_target
```

迁移只增加索引；`0010 -> 0011`测试会先删除新索引、写入0010 migration row与已有node，再执行正式`ApplyMigrations()`，验证索引恢复且node geometry/target保持不变。

## 4. 本地证据

```bash
task test:board-viewport-repository:component
task board:schema:test
```

Component evidence：`temp/integration-test-runs/20260721000731-0da41828-110a-4acf-87a6-602fe23e2724/`

- status：`passed`
- exit code：`0`
- duration：`72213 ms`
- redaction：enabled
- coverage：same-coordinate tie、multi-page no skip/duplicate、tenant/Board/tombstone isolation、geometry intersection、type/group filter、status fail-closed、visible edge dedupe/relation filter、group lookup、restart、cancellation、SQL no-offset assertion、SQLite named EXPLAIN、0010 upgrade、10次race。

完整schema gate另行通过，包含repository regression、vet、10次schema race、真实临时SQLite migrate/check；输出当前版本为0011。

## 5. PostgreSQL promotion blocker

已准备命令：

```bash
WORKBENCH_TEST_POSTGRES_URL='<isolated-postgresql-dsn>' task test:board-viewport-repository:postgres
WORKBENCH_TEST_POSTGRES_URL='<isolated-postgresql-dsn>' task test:board-service:postgres
```

当前本机角色既无`CREATEDB`，也无`postgres`数据库的`CREATE SCHEMA`权限。2026-07-21尝试创建唯一临时schema时服务端返回`permission denied for database postgres`，cleanup确认该schema不存在；未触碰共享table。需要DBA提供可删除database或schema的隔离DSN后，才能关闭`2.2e2`与`2.3b2`。
