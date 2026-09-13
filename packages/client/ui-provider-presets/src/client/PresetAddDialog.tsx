/**
 * 引导式添加渠道对话框：预设预填 → 粘贴 key → 拉取模型 → 勾选 → 保存
 * （可选设为默认）。
 *
 * 密钥边界：key 输入值只存在于本组件内存态，提交时单程传给
 * `operations.storeCredential`（host 凭证存储），不落任何浏览器持久化、
 * 不进日志；关闭即丢弃。
 *
 * @module @yeisme/dsh-client-ui-provider-presets/client/PresetAddDialog
 */

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceActionBar, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ProviderPreset } from './presets.ts'
import { CONFIGURABLE_PROTOCOLS, LISTABLE_PROTOCOLS } from './presets.ts'
import type { ProviderPresetsOperations, DiscoveryOutcome } from './operations.ts'
import { LLM_SETTINGS_NS, DEFAULT_MODEL_NS } from './operations.ts'
import { buildProviderProfile, buildSaveOps, buildSetDefaultOps, validateDraft } from './draft.ts'
import type { DraftFieldError } from './draft.ts'
import type { ProviderPresetsStore } from './store.ts'
import type { DiscoveredModelView } from './wire.ts'
import type { ProviderPresetsTranslator } from './ProviderPresetsSection.tsx'
import { providerPresetsStyles } from './styles.ts'
import { interpolate } from './locales.ts'

export interface PresetAddDialogProps {
  readonly preset: ProviderPreset
  readonly operations: ProviderPresetsOperations
  readonly controller: ProviderPresetsStore
  readonly t: ProviderPresetsTranslator
  readonly locale: 'zh' | 'en'
  readonly onClose: () => void
  readonly onSaved: (name: string, route: string, becameDefault: boolean) => void
}

interface DialogState {
  readonly route: string
  readonly displayName: string
  readonly apiProtocol: string
  readonly baseURL: string
  readonly credentialRef: string
  readonly apiKey: string
  /** 候选模型（拉取结果或种子），顺序保持端点顺序。 */
  readonly candidates: readonly DiscoveredModelView[]
  /** 手填追加的候选 id。 */
  readonly manualIds: readonly string[]
  readonly selected: ReadonlySet<string>
  readonly setDefault: boolean
  readonly defaultModel: string
}

function initialState(preset: ProviderPreset, locale: 'zh' | 'en'): DialogState {
  const seed = preset.modelsSeed ?? []
  return {
    route: preset.suggestedRoute,
    displayName: preset.displayName[locale],
    apiProtocol: preset.apiProtocol,
    baseURL: preset.baseURL,
    credentialRef: preset.suggestedCredentialRef,
    apiKey: '',
    candidates: seed,
    manualIds: [],
    selected: new Set(seed.map(model => model.id)),
    setDefault: false,
    defaultModel: seed[0]?.id ?? '',
  }
}

/** 合并候选（端点顺序 + 手填追加，去重）。 */
function mergedCandidates(state: DialogState): readonly DiscoveredModelView[] {
  const seen = new Set<string>()
  const out: DiscoveredModelView[] = []
  for (const model of [...state.candidates, ...state.manualIds.map(id => ({ id }))]) {
    if (seen.has(model.id)) continue
    seen.add(model.id)
    out.push(model)
  }
  return out
}

/**
 * 引导添加对话框。
 */
export function PresetAddDialog(props: PresetAddDialogProps): ReactNode {
  const { preset, operations, controller, t, locale, onClose, onSaved } = props
  const [state, setState] = useState<DialogState>(() => initialState(preset, locale))
  const [fetching, setFetching] = useState(false)
  const [fetchOutcome, setFetchOutcome] = useState<DiscoveryOutcome | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [fieldError, setFieldError] = useState<DraftFieldError | undefined>(undefined)
  const [manualDraft, setManualDraft] = useState('')

  const snapshot = controller.getSnapshot()
  const candidates = useMemo(() => mergedCandidates(state), [state])
  const listable = LISTABLE_PROTOCOLS.includes(state.apiProtocol)

  const patch = (partial: Partial<DialogState>): void => setState(current => ({ ...current, ...partial }))

  const onFetch = async (): Promise<void> => {
    setFetching(true)
    setFetchOutcome(undefined)
    const key = state.apiKey.trim()
    const outcome = await operations.discoverModels({
      baseURL: state.baseURL.trim(),
      api: state.apiProtocol,
      ...key.length === 0 ? {} : { apiKey: key },
    })
    setFetching(false)
    setFetchOutcome(outcome)
    if (outcome.kind === 'found') {
      setState(current => ({
        ...current,
        candidates: outcome.models,
        manualIds: [],
        selected: new Set(outcome.models.map(model => model.id)),
        defaultModel: outcome.models[0]?.id ?? '',
      }))
    }
  }

  const onToggleModel = (id: string): void => {
    setState(current => {
      const selected = new Set(current.selected)
      if (selected.has(id)) selected.delete(id)
      else selected.add(id)
      const nextDefault = selected.has(current.defaultModel) ? current.defaultModel : [...selected][0] ?? ''
      return { ...current, selected, defaultModel: nextDefault }
    })
  }

  const onManualAdd = (): void => {
    const id = manualDraft.trim()
    if (id.length === 0) return
    setManualDraft('')
    setState(current => ({
      ...current,
      manualIds: current.manualIds.includes(id) ? current.manualIds : [...current.manualIds, id],
      selected: new Set([...current.selected, id]),
      defaultModel: current.defaultModel.length > 0 ? current.defaultModel : id,
    }))
  }

  const onSave = async (): Promise<void> => {
    const draft = {
      displayName: state.displayName,
      route: state.route,
      apiProtocol: state.apiProtocol,
      baseURL: state.baseURL,
      credentialRef: state.credentialRef,
      ...preset.defaultInput === undefined ? {} : { defaultInput: preset.defaultInput },
    }
    const invalid = validateDraft(draft, snapshot.routeKeys)
    if (invalid !== undefined) {
      setFieldError(invalid)
      return
    }
    const selectedModels = candidates.filter(model => state.selected.has(model.id))
    if (selectedModels.length === 0) {
      setFieldError('noneSelected')
      return
    }
    if (state.apiKey.trim().length === 0) {
      setFailure(t('error.keyRequired'))
      return
    }
    setFieldError(undefined)
    setFailure(undefined)
    setSaving(true)
    const credentialFailure = await operations.storeCredential(state.credentialRef, state.apiKey.trim())
    if (credentialFailure !== undefined) {
      setSaving(false)
      setFailure(`${t('error.credentialFailed')}：${credentialFailure}`)
      return
    }
    const profile = buildProviderProfile(draft, selectedModels)
    const write = await operations.writeSettings(LLM_SETTINGS_NS, buildSaveOps(draft.route, profile), snapshot.revisions[LLM_SETTINGS_NS])
    if (write.kind !== 'written') {
      setSaving(false)
      if (write.kind === 'conflict') await controller.load()
      setFailure(write.kind === 'conflict' ? t('error.conflict') : `${t('error.saveFailed')}：${write.message}`)
      return
    }
    let becameDefault = false
    const displayName = state.displayName.trim().length > 0 ? state.displayName.trim() : draft.route
    if (state.setDefault && state.defaultModel.length > 0) {
      const defaultWrite = await operations.writeSettings(
        DEFAULT_MODEL_NS,
        buildSetDefaultOps(draft.route, state.defaultModel),
        snapshot.revisions[DEFAULT_MODEL_NS],
      )
      becameDefault = defaultWrite.kind === 'written'
      if (defaultWrite.kind !== 'written') {
        setSaving(false)
        await controller.load()
        setFailure(`${t('error.saveFailed')}：${defaultWrite.message}`)
        onSaved(displayName, draft.route, false)
        return
      }
    }
    setSaving(false)
    await controller.load()
    onSaved(displayName, draft.route, becameDefault)
    onClose()
  }

  const fieldErrorText = (error: DraftFieldError | undefined): string | undefined => {
    if (error === undefined) return undefined
    switch (error) {
      case 'routeInvalid': return t('error.routeInvalid')
      case 'routeConflict': return interpolate(t('error.routeConflict'), { route: state.route })
      case 'refInvalid': return t('error.refInvalid')
      case 'baseURLRequired': return t('error.baseURLRequired')
      case 'noneSelected': return t('dialog.models.noneSelected')
    }
  }

  const busy = saving || fetching

  return (
    <Modal open onClose={onClose} title={t('dialog.title')} headless>
      <Surface kind="dialog" className="pp-dialog" data-provider-presets="dialog">
        <style>{providerPresetsStyles}</style>
        <SurfaceContextBar title={t('dialog.title')} context={preset.displayName[locale]} />
        <div className="ys-body pp-dialog-body">
          <div className="pp-form">
            <div className="pp-field">
              <label htmlFor="pp-route">{t('dialog.field.route')}</label>
              <Input
                id="pp-route"
                type="text"
                value={state.route}
                disabled={busy}
                aria-invalid={fieldError === 'routeInvalid' || fieldError === 'routeConflict'}
                onChange={event => patch({ route: event.target.value })}
              />
            </div>
            <div className="pp-field">
              <label htmlFor="pp-display-name">{t('dialog.field.displayName')}</label>
              <Input
                id="pp-display-name"
                type="text"
                value={state.displayName}
                disabled={busy}
                onChange={event => patch({ displayName: event.target.value })}
              />
            </div>
            <div className="pp-field ys-field">
              <label htmlFor="pp-protocol">{t('dialog.field.protocol')}</label>
              <select
                id="pp-protocol"
                value={state.apiProtocol}
                disabled={busy}
                onChange={event => patch({ apiProtocol: event.target.value })}
              >
                {CONFIGURABLE_PROTOCOLS.map(protocol => <option key={protocol} value={protocol}>{protocol}</option>)}
              </select>
            </div>
            <div className="pp-field">
              <label htmlFor="pp-base-url">{t('dialog.field.baseURL')}</label>
              <Input
                id="pp-base-url"
                type="text"
                value={state.baseURL}
                disabled={busy}
                aria-invalid={fieldError === 'baseURLRequired'}
                onChange={event => patch({ baseURL: event.target.value })}
              />
            </div>
            <div className="pp-field">
              <label htmlFor="pp-credential-ref">{t('dialog.field.credentialRef')}</label>
              <Input
                id="pp-credential-ref"
                type="text"
                value={state.credentialRef}
                disabled={busy}
                aria-invalid={fieldError === 'refInvalid'}
                onChange={event => patch({ credentialRef: event.target.value })}
              />
            </div>
            <div className="pp-field">
              <label htmlFor="pp-api-key">{t('dialog.field.apiKey')}</label>
              <Input
                id="pp-api-key"
                type="password"
                value={state.apiKey}
                disabled={busy}
                autoComplete="off"
                onChange={event => patch({ apiKey: event.target.value })}
              />
              <p className="pp-hint">{t('dialog.field.apiKeyHint')}</p>
            </div>
          </div>

          <div className="pp-models">
            <div className="pp-models-head">
              <strong>{t('dialog.models.title')}</strong>
              <Button type="button" disabled={busy || state.baseURL.trim().length === 0} onClick={() => void onFetch()}>
                {fetchOutcome?.kind === 'found' ? t('dialog.models.refetch') : t('dialog.models.fetch')}
              </Button>
              {fetching ? <span className="pp-models-meta" role="status">{t('dialog.models.fetching')}</span> : null}
              {fetchOutcome?.kind === 'found'
                ? (
                  <span className="pp-models-meta">
                    {interpolate(t('dialog.models.fetched'), { count: fetchOutcome.models.length, ms: fetchOutcome.elapsedMs })}
                  </span>
                )
                : null}
            </div>
            {!listable && fetchOutcome === undefined
              ? <p className="pp-strip" data-tone="warn" role="status">{t('dialog.models.unlistable')}</p>
              : null}
            {fetchOutcome?.kind === 'refused'
              ? <p className="pp-strip" data-tone="error" role="alert">{`${t('error.fetchFailed')}：${fetchOutcome.message}`}</p>
              : null}
            {candidates.length === 0 && fetchOutcome?.kind === 'found'
              ? <p className="pp-strip" data-tone="warn" role="status">{t('dialog.models.empty')}</p>
              : null}
            {candidates.length > 0
              ? (
                <ul className="pp-model-list" aria-label={t('dialog.models.title')}>
                  {candidates.map(model => (
                    <li key={model.id} className="pp-model-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={state.selected.has(model.id)}
                          disabled={busy}
                          onChange={() => onToggleModel(model.id)}
                        />
                        <span className="pp-model-id" title={model.id}>{model.id}</span>
                        {model.contextWindow === undefined || model.maxTokens === undefined
                          ? <span className="pp-model-cap">{t('dialog.models.capacityMissing')}</span>
                          : (
                            <span className="pp-model-cap">
                              {`ctx ${model.contextWindow} / max ${model.maxTokens}`}
                            </span>
                          )}
                      </label>
                    </li>
                  ))}
                </ul>
              )
              : null}
            <div className="pp-manual-entry">
              <Input
                type="text"
                aria-label={t('dialog.models.manualAdd')}
                value={manualDraft}
                disabled={busy}
                onChange={event => setManualDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onManualAdd()
                  }
                }}
              />
              <Button type="button" disabled={busy || manualDraft.trim().length === 0} onClick={onManualAdd}>{t('preset.add')}</Button>
            </div>
          </div>

          <div className="pp-default-model">
            <label className="pp-check">
              <input
                type="checkbox"
                checked={state.setDefault}
                disabled={busy}
                onChange={event => patch({ setDefault: event.target.checked })}
              />
              {t('dialog.setDefault')}
            </label>
            {state.setDefault
              ? (
                <div className="pp-field ys-field">
                  <label htmlFor="pp-default-model">{t('dialog.setDefaultModel')}</label>
                  <select
                    id="pp-default-model"
                    value={state.defaultModel}
                    disabled={busy}
                    onChange={event => patch({ defaultModel: event.target.value })}
                  >
                    {candidates.filter(model => state.selected.has(model.id)).map(model => (
                      <option key={model.id} value={model.id}>{model.id}</option>
                    ))}
                  </select>
                </div>
              )
              : null}
          </div>

          {fieldError !== undefined
            ? <SurfaceState phase="error" title={fieldErrorText(fieldError) ?? ''} />
            : null}
          {failure !== undefined
            ? <SurfaceState phase="error" title={t('error.saveFailed')} description={failure} />
            : null}

          <SurfaceActionBar>
            <div className="pp-dialog-actions">
              <Button type="button" disabled={saving} onClick={onClose}>{t('dialog.cancel')}</Button>
              <Button type="button" className="primary" disabled={busy} onClick={() => void onSave()}>
                {saving ? t('dialog.saving') : t('dialog.save')}
              </Button>
            </div>
          </SurfaceActionBar>
        </div>
      </Surface>
    </Modal>
  )
}
