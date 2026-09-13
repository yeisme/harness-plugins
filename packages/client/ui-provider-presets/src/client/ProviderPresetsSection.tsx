/**
 * 渠道市场区：Models 设置页 `settings.models.footer` 扩展 slot 的内容面。
 *
 * 纯 props 组件（slot 注入面展开为 props）；无 ctx、无订阅——数据经
 * store 快照（useSyncExternalStore），动作经注入回调。密钥永不回流：
 * 总览只渲染 CredentialInfo 事实。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/ProviderPresetsSection
 */

import { useCallback, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { ProviderPreset } from './presets.ts'
import { PROVIDER_PRESETS } from './presets.ts'
import type { ProviderPresetsOperations } from './operations.ts'
import { DEFAULT_MODEL_NS } from './operations.ts'
import { buildSetDefaultOps } from './draft.ts'
import type { ProviderPresetsStore } from './store.ts'
import { PresetAddDialog } from './PresetAddDialog.tsx'
import { providerPresetsStyles } from './styles.ts'
import type { ProviderPresetsKey } from './locales.ts'
import { interpolate } from './locales.ts'

/** 翻译器：键 + 可选插值参数。 */
export type ProviderPresetsTranslator = (key: keyof ProviderPresetsKey, params?: Readonly<Record<string, string | number>>) => string

/** slot 注入面。 */
export interface ProviderPresetsInjected {
  readonly controller: ProviderPresetsStore
  readonly operations: ProviderPresetsOperations
  readonly t: ProviderPresetsTranslator
  readonly locale: 'zh' | 'en'
}

/** slot 组件 props（注入面展开；未注入完成前不渲染）。 */
export type ProviderPresetsSectionProps = Partial<ProviderPresetsInjected>

/**
 * 渠道市场区。注入面未就绪（slot 先渲染后注入的短暂窗口）时返回 null。
 */
export function ProviderPresetsSection(props: ProviderPresetsSectionProps): ReactNode {
  const { controller, operations, t, locale } = props
  if (controller === undefined || operations === undefined || t === undefined || locale === undefined) return null
  return <Loaded controller={controller} operations={operations} t={t} locale={locale} />
}

interface LoadedProps {
  readonly controller: ProviderPresetsStore
  readonly operations: ProviderPresetsOperations
  readonly t: ProviderPresetsTranslator
  readonly locale: 'zh' | 'en'
}

function Loaded({ controller, operations, t, locale }: LoadedProps): ReactNode {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [adding, setAdding] = useState<ProviderPreset | undefined>(undefined)
  const [savedNotice, setSavedNotice] = useState<string | undefined>(undefined)
  const [defaultBusy, setDefaultBusy] = useState<string | undefined>(undefined)
  const [defaultFailure, setDefaultFailure] = useState<string | undefined>(undefined)

  const onSaved = useCallback((name: string, route: string, becameDefault: boolean): void => {
    setSavedNotice(interpolate(t('dialog.saved'), { name, route }) + (becameDefault ? ` · ${t('dialog.savedDefault')}` : ''))
  }, [t])

  const onSetDefault = useCallback(async (provider: string, model: string): Promise<void> => {
    setDefaultBusy(provider)
    setDefaultFailure(undefined)
    const revision = controller.getSnapshot().revisions[DEFAULT_MODEL_NS]
    const outcome = await operations.writeSettings(DEFAULT_MODEL_NS, buildSetDefaultOps(provider, model), revision)
    setDefaultBusy(undefined)
    if (outcome.kind === 'written') {
      await controller.load()
      return
    }
    if (outcome.kind === 'conflict') await controller.load()
    setDefaultFailure(outcome.message)
  }, [controller, operations])

  return (
    <div className="pp-section" data-provider-presets="section">
      <style>{providerPresetsStyles}</style>
      <header className="pp-heading">
        <h3 className="pp-title">{t('section.title')}</h3>
        <p className="pp-description">{t('section.description')}</p>
      </header>

      {snapshot.status === 'loading'
        ? <p className="pp-strip" role="status">{t('section.loading')}</p>
        : snapshot.status === 'error'
          ? (
            <div className="pp-strip" data-tone="error" role="alert">
              <span>{`${t('section.error')}：${snapshot.message ?? ''}`}</span>
              <button type="button" className="pp-action" onClick={() => void controller.load()}>{t('section.retry')}</button>
            </div>
          )
          : (
            <section aria-label={t('overview.title')}>
              <ul className="pp-overview">
                {snapshot.rows.length === 0
                  ? <li className="pp-strip" role="status">{t('section.empty')}</li>
                  : snapshot.rows.map(row => (
                    <li key={row.provider} className="pp-row">
                      <span className="pp-row-main">
                        <span className="pp-row-name">{row.displayName}</span>
                        <span className="pp-row-route">{row.provider}</span>
                      </span>
                      <span className="pp-badge" data-tone={row.live ? 'positive' : 'neutral'}>{row.live ? t('overview.live') : t('overview.dormant')}</span>
                      {row.isDefault ? <span className="pp-badge" data-tone="accent">{t('overview.default')}</span> : null}
                      {row.credentialRef !== undefined
                        ? (
                          <span
                            className="pp-badge"
                            data-tone={row.credentialConfigured === true ? 'positive' : 'warn'}
                            title={row.credentialRef}
                          >
                            {row.credentialConfigured === true ? t('overview.keyConfigured') : t('overview.keyMissing')}
                          </span>
                        )
                        : null}
                      <span className="pp-row-actions">
                        {row.isDefault
                          ? null
                          : (
                            <button
                              type="button"
                              className="pp-action"
                              disabled={row.models.length === 0 || defaultBusy !== undefined}
                              title={row.models.length === 0 ? t('overview.noModels') : undefined}
                              onClick={() => void onSetDefault(row.provider, row.models[0] ?? '')}
                            >
                              {defaultBusy === row.provider ? t('overview.setDefaultBusy') : t('overview.setDefault')}
                            </button>
                          )}
                      </span>
                    </li>
                  ))}
              </ul>
              {defaultFailure !== undefined
                ? <p className="pp-strip" data-tone="error" role="alert">{`${t('error.saveFailed')}：${defaultFailure}`}</p>
                : null}
            </section>
          )}

      {savedNotice !== undefined
        ? <p className="pp-strip" data-tone="success" role="status">{savedNotice}</p>
        : null}

      <ul className="pp-grid">
        {PROVIDER_PRESETS.map(preset => (
          <li key={preset.id}>
            <button type="button" className="pp-card" onClick={() => setAdding(preset)}>
              <span className="pp-card-name">{preset.displayName[locale]}</span>
              <span className="pp-card-meta">
                <span className="pp-badge">{preset.apiProtocol}</span>
                {preset.baseURL.length === 0 ? <span className="pp-badge">{t('preset.custom')}</span> : null}
              </span>
              {preset.note !== undefined
                ? <span className="pp-card-note">{preset.note[locale]}</span>
                : preset.baseURL.length > 0
                  ? <span className="pp-card-note">{preset.baseURL}</span>
                  : null}
              <span className="pp-card-note">{t('preset.add')} →</span>
            </button>
          </li>
        ))}
      </ul>

      {adding !== undefined
        ? (
          <PresetAddDialog
            preset={adding}
            operations={operations}
            controller={controller}
            t={t}
            locale={locale}
            onClose={() => setAdding(undefined)}
            onSaved={onSaved}
          />
        )
        : null}
    </div>
  )
}
