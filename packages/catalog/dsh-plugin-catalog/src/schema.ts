/**
 * 静态插件目录清单的数据合同（G21 §2 catalog 薄做）。
 *
 * 定位边界（R6/R11）：catalog 是「构建工具生成的静态清单 + 本地查询工具」——
 * 不是网络服务、不收集遥测、不是第二 package registry。清单数据全部来自
 * 仓库 packages 目录下各 bundle 包的 package.json 与 cordis.patch.yml，
 * 由构建工具生成而非手写；新增 bundle 后重建清单即自动收录。
 */

/** 清单 schema 版本；消费方加载时校验，不匹配即拒绝（fail-loud）。 */
export const CATALOG_SCHEMA_VERSION = 1

/** cordis.patch.yml 中一条 `- insert:` 安装行（本仓收敛语法：`- id:` + `name:`）。 */
export interface CatalogInstallRow {
  readonly id: string
  readonly name: string
}

export interface CatalogPersonalCodingPackV1 {
  readonly packId: string
  readonly tier: 'base' | 'optional'
  readonly critical: boolean
  readonly dependencies: readonly string[]
  readonly criticalContributions: readonly string[]
  readonly optionalContributions: readonly string[]
  readonly sourcePath: string
}

/**
 * 一个可安装 bundle 的清单条目。覆盖 packages/bundle 目录下全部子目录
 * （含 preset/data 形态与暂不可独立安装的组装面），`installable=false` 的
 * 条目仍列出，供查询与一致性对账，不代表其可 `dsh plugin add`。
 */
export interface CatalogBundleEntry {
  /** 目录名（packages/bundle 下的本地稳定标识） */
  readonly id: string
  /** package.json name（安装行使用的包名） */
  readonly name: string
  /** package.json description */
  readonly description: string
  /** 仓库相对安装路径（`dsh plugin add` 可用的 checkout 相对路径） */
  readonly path: string
  /** 是否可独立安装：声明了 dsh.bundle.patch 且 cordis.patch.yml 存在 */
  readonly installable: boolean
  /** preset/data bundle（无 scripts.build，无构建产物，不在 bundle-contract 范围） */
  readonly preset: boolean
  /** dsh.client.platform（如 'web'）；未声明则缺省 */
  readonly platform?: string
  /** cordis.patch.yml 的仓库相对路径；仅 installable 条目携带 */
  readonly patchFile?: string
  /** package.json dependencies 中指向本仓插件包（@yeisme 前缀）的依赖行 */
  readonly pluginDependencies: readonly string[]
  /** cordis.patch.yml 解析出的 insert 安装行 */
  readonly installRows: readonly CatalogInstallRow[]
  /** 可选的个人编码 pack 元数据；来自 package.json，由 catalog 只读投影。 */
  readonly personalCoding?: CatalogPersonalCodingPackV1
}

/** 生成的静态清单整体。 */
export interface PluginCatalog {
  readonly schemaVersion: number
  readonly generator: string
  /** ISO 生成时刻；仅溯源信息，查询语义不依赖它 */
  readonly generatedAt: string
  /** packages/bundle 下的条目总数（含非 installable） */
  readonly bundleCount: number
  /** 可独立安装条目数 */
  readonly installableCount: number
  readonly bundles: readonly CatalogBundleEntry[]
}
