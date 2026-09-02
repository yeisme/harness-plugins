/**
 * @yeisme/dsh-plugin-catalog 程序化 API。
 *
 * 静态插件目录（G21 §2 catalog 薄做）：构建工具从仓库包生成清单
 * （buildCatalog / writeCatalog），本地查询工具消费清单
 * （loadCatalog / findBundle / searchBundles / render 渲染器）。
 * 无网络服务、无遥测、不建第二 registry；清单数据由发现层只读扫描生成。
 */

export { CATALOG_SCHEMA_VERSION, type CatalogBundleEntry, type CatalogInstallRow, type CatalogPersonalCodingPackV1, type PluginCatalog } from './schema.js'
export { discoverBundles, findWorkspaceRoot, parseInstallRows } from './discover.js'
export { GENERATOR_NAME, buildCatalog, defaultManifestPath, serializeCatalog, writeCatalog, main as generateMain } from './generate.js'
export { loadCatalog, findBundle, searchBundles, renderBundleTable, renderBundleDetail, main as runCli } from './cli.js'
export { listPersonalCodingPacks, resolvePersonalCodingPacks } from './personal-coding.js'
export type { PersonalCodingPackResolutionV1 } from './personal-coding.js'
