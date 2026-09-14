/**
 * 引导编译 pane (task 3.2): workspace surface — contract form (fields from
 * the host inspect contract, zh/en i18n labels), the explicit confirmation
 * gate (decision_ref displayed before the click, never auto), the compile
 * result card (exact ref + digest + provider_calls = 0 badge), and export
 * with digest-stale gating surfaced (stale => disabled + re-pin path).
 *
 * Keyboard path: form fields -> confirm -> compile -> export, all native
 * controls in DOM order; focus moves to the result card title when the
 * compile receipt arrives. Reduced motion: no transitions or shimmer are
 * introduced beyond the shared surface contract's kill switch.
 *
 * @module @yeisme/dsh-client-ui-template-registry/compile-view
 */

import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { TemplateInputDefinition } from '@yeisme/dsh-template-registry'
import {
  composeConfirmDecisionRef,
  isCompileArmed,
  missingRequiredFields,
  suggestExportName,
  type TemplateCompileController,
  type TemplateCompileState,
} from './compile-controller.js'
import type { TemplateRegistryLocale } from './seam.js'
import { templateRegistryTranslator } from './locales.js'

const styles = `
[data-template-registry-compile] .tr-form{display:grid;gap:10px;min-width:0}
[data-template-registry-compile] .tr-missing{display:grid;gap:2px;margin:0;padding-left:18px;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
[data-template-registry-compile] .tr-gate{display:grid;gap:6px;min-width:0;padding:10px 12px;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);background:color-mix(in srgb,var(--vk-bg-layer-1) 72%,transparent)}
[data-template-registry-compile] .tr-gate code{overflow-wrap:anywhere;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
[data-template-registry-compile] .tr-result{display:grid;gap:6px;min-width:0;padding:10px 12px;border:1px solid color-mix(in srgb,var(--vk-tone-positive) 26%,var(--vk-border-l1));border-radius:var(--vk-radius-md);background:color-mix(in srgb,var(--vk-tone-positive) 5%,var(--vk-bg-layer-1))}
[data-template-registry-compile] .tr-result h3{margin:0;color:var(--vk-text-primary);font-size:var(--vk-font-strong);font-weight:650}
[data-template-registry-compile] .tr-result dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 10px;margin:0;color:var(--vk-text-secondary);font-size:var(--vk-font-small)}
[data-template-registry-compile] .tr-result dt{color:var(--vk-text-tertiary)}
[data-template-registry-compile] .tr-result dd{margin:0;overflow-wrap:anywhere}
[data-template-registry-compile] .tr-badge{display:inline-block;padding:1px 6px;color:var(--vk-text-secondary);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-sm);font-size:var(--vk-font-micro)}
[data-template-registry-compile] .tr-required{color:var(--vk-text-tertiary);font-size:var(--vk-font-micro)}
@media(prefers-reduced-motion:reduce){[data-template-registry-compile] *{transition:none!important;animation:none!important}}
`

export interface TemplateCompileViewProps {
  readonly controller: TemplateCompileController
  readonly locale?: TemplateRegistryLocale
  /** Cross-pane link: open the catalog pane to pick a template. */
  readonly onOpenCatalog?: () => void
}

/** Locale-aware label/description pick from the contract's i18n records. */
export function contractInputText(source: Record<string, string> | undefined, locale: TemplateRegistryLocale, fallback: string): string {
  if (source === undefined) return fallback
  const exact = locale === 'zh' ? source['zh-CN'] : locale === 'en' ? source.en : undefined
  const alternate = locale === 'zh' ? source.en : source['zh-CN']
  const text = exact ?? alternate
  if (text === undefined || text === '') return fallback
  return locale === 'pseudo' ? `[!! ${text} ${text} !!]` : text
}

export function TemplateCompileView({ controller, locale = 'zh', onOpenCatalog }: TemplateCompileViewProps) {
  const id = useId()
  const t = templateRegistryTranslator(locale)
  const [state, setState] = useState<TemplateCompileState>(() => controller.snapshot())
  const [exportName, setExportName] = useState('')
  const resultHeading = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    const dispose = controller.subscribe(setState)
    setState(controller.snapshot())
    return () => dispose()
  }, [controller])
  useEffect(() => {
    // Focus owner per the UI Contract: compile completion moves focus to the
    // result card title. The heading carries tabIndex=-1 as the focus target.
    if (state.compile !== undefined) resultHeading.current?.focus()
  }, [state.compile?.compileId])
  useEffect(() => {
    if (state.pinnedRef !== undefined && exportName === '') setExportName(suggestExportName(state.pinnedRef))
  }, [state.pinnedRef, exportName])

  const inspection = state.inspection
  const session = state.session
  const missing = missingRequiredFields(inspection, state.fields)
  const armed = isCompileArmed(state)
  const decisionRef = session === undefined ? undefined : composeConfirmDecisionRef(session.id, session.revision)
  const formLocked = state.phase === 'compiled' || state.phase === 'exported' || state.busy !== null
  const exportDisabled = state.compile === undefined || state.stale || state.busy !== null || state.phase === 'exported'

  return <Surface kind="workspace" data-template-registry-compile aria-label={t('compileTitle')}>
    <style>{styles}</style>
    <SurfaceContextBar
      title={t('compileTitle')}
      context={state.pinnedRef !== undefined ? <>
        <span>{state.pinnedRef}</span>
        {session !== undefined ? <span> · {t('sessionStatus')}: {session.status} · {t('sessionRevision')}: {session.revision}</span> : undefined}
      </> : undefined}
      status={state.stale ? <span className="tr-badge">{t('staleDigest')}</span> : session?.confirmed === true ? <span className="tr-badge">{t('confirmedBadge')}</span> : undefined}
      actions={<>
        {session !== undefined ? <Button onClick={() => { void controller.checkFreshness() }}>{t('checkFreshness')}</Button> : undefined}
        {session !== undefined ? <Button onClick={() => controller.reset()}>{t('resetSession')}</Button> : undefined}
      </>}
    />
    <div className="ys-body">
      {state.phase === 'empty' ? <SurfaceState phase="empty" title={t('compileEmpty')} description={t('compileEmptyHelp')}
        action={onOpenCatalog === undefined ? undefined : <Button onClick={onOpenCatalog}>{t('openCatalog')}</Button>} /> : null}

      {state.phase === 'loading' ? <SurfaceState phase="loading" title={t('busyGeneric')} description={t('detailLoading')} /> : null}

      {state.phase === 'error' ? <SurfaceState phase="error" title={t('detailUnavailable')}
        description={state.error?.code ?? undefined}
        action={onOpenCatalog === undefined ? undefined : <Button onClick={onOpenCatalog}>{t('openCatalog')}</Button>} /> : null}

      {state.phase !== 'empty' && state.phase !== 'loading' && state.phase !== 'error' && inspection !== undefined ? <>
        <SurfaceSection title={t('contractFormHeading')} description={inspection.template.title}>
          <form className="tr-form" onSubmit={event => {
            event.preventDefault()
            if (session === undefined) void controller.startSession(locale === 'pseudo' ? 'en' : locale)
            else void controller.submitFields()
          }}>
            <label className="ys-field" htmlFor={`${id}-goal`}>{t('goalLabel')}
              <Input id={`${id}-goal`} value={state.goal} disabled={formLocked} aria-describedby={`${id}-goal-help`} onChange={event => controller.setGoal(event.target.value)} />
            </label>
            <p id={`${id}-goal-help`}>{t('goalHelp')}</p>
            {inspection.contract.inputs.map((input: TemplateInputDefinition) => <div key={input.name}>
              <label className="ys-field" htmlFor={`${id}-${input.name}`}>
                {contractInputText(input.labels, locale, input.name)}
                <span className="tr-required">{input.required ? t('fieldRequired') : t('fieldOptional')}</span>
                {input.max_length === undefined || input.max_length > 160
                  ? <textarea id={`${id}-${input.name}`} value={state.fields[input.name] ?? ''} disabled={formLocked}
                    {...(input.min_length === undefined ? {} : { minLength: input.min_length })}
                    {...(input.max_length === undefined ? {} : { maxLength: input.max_length })}
                    aria-describedby={`${id}-${input.name}-help`}
                    onChange={event => controller.setField(input.name, event.target.value)} />
                  : <Input id={`${id}-${input.name}`} value={state.fields[input.name] ?? ''} disabled={formLocked}
                    {...(input.min_length === undefined ? {} : { minLength: input.min_length })}
                    {...(input.max_length === undefined ? {} : { maxLength: input.max_length })}
                    aria-describedby={`${id}-${input.name}-help`}
                    onChange={event => controller.setField(input.name, event.target.value)} />}
              </label>
              <p id={`${id}-${input.name}-help`}>{contractInputText(input.descriptions, locale, '')}</p>
            </div>)}
            {missing.length > 0 ? <div>
              <strong>{t('missingFieldsHeading')}</strong>
              <ul className="tr-missing">{missing.map(name => <li key={name}>{contractInputText(inspection.contract.inputs.find(input => input.name === name)?.labels, locale, name)}</li>)}</ul>
            </div> : null}
            <Button type="submit" disabled={formLocked || state.goal.trim() === ''}>{session === undefined ? t('startSession') : t('submitFields')}</Button>
          </form>
        </SurfaceSection>

        <SurfaceSection title={t('confirmGateHeading')}>
          <div className="tr-gate">
            <p>{t('confirmGateHelp')}</p>
            {decisionRef !== undefined ? <p>{t('confirmDecisionRef')}: <code>{decisionRef}</code></p> : undefined}
            {session?.confirmed === true
              ? <p role="status">{t('confirmedBadge')}</p>
              : <Button disabled={session === undefined || state.busy !== null} onClick={() => { void controller.confirm() }}>{t('confirmButton')}</Button>}
          </div>
        </SurfaceSection>

        <SurfaceSection title={t('compileButton')}>
          {state.busy === 'compile' ? <SurfaceState phase="loading" title={t('compiling')} /> : null}
          <Button disabled={!armed} aria-describedby={armed ? undefined : 'tr-compile-gate-reason'} onClick={() => { void controller.compile() }}>{t('compileButton')}</Button>
          {!armed ? <p id="tr-compile-gate-reason" role="status">{session?.confirmed === true
            ? t('missingFieldsHeading')
            : t('confirmGateHeading')}</p> : null}
        </SurfaceSection>

        {state.compile !== undefined ? <article className="tr-result" role="status">
          <h3 tabIndex={-1} ref={resultHeading}>{t('resultCardHeading')}</h3>
          <dl>
            <dt>{t('ref')}</dt><dd>{state.pinnedRef}</dd>
            <dt>compile id</dt><dd>{state.compile.compileId}</dd>
            <dt>{t('digest')}</dt><dd>{state.compile.digest}</dd>
          </dl>
          <span className="tr-badge">{t('providerCallsBadge')}</span>
        </article> : null}

        <SurfaceSection title={t('exportHeading')}>
          {state.stale ? <SurfaceState phase="stale" title={t('staleDigest')} description={t('staleDigestHelp')}
            action={<Button onClick={() => {
              controller.reset()
              if (state.pinnedRef !== undefined) void controller.pinTemplate(state.pinnedRef)
            }}>{t('rePin')}</Button>} /> : null}
          <label className="ys-field" htmlFor={`${id}-export`}>{t('exportNameLabel')}
            <Input id={`${id}-export`} value={exportName} disabled={state.phase === 'exported'} onChange={event => setExportName(event.target.value)} />
          </label>
          <Button disabled={exportDisabled} title={state.stale ? t('staleDigestHelp') : undefined} onClick={() => { void controller.export(exportName) }}>{state.busy === 'export' ? t('exportBusy') : t('exportButton')}</Button>
          {state.exportReceipt !== undefined ? <div className="tr-result">
            <h3>{t('exportedReceipt')}</h3>
            <dl>
              <dt>{t('outputRef')}</dt><dd>{state.exportReceipt.outputRef}</dd>
              <dt>{t('digest')}</dt><dd>{state.exportReceipt.digest}</dd>
              <dt>{t('exportedAt')}</dt><dd><time dateTime={state.exportReceipt.exportedAt}>{state.exportReceipt.exportedAt}</time></dd>
            </dl>
            <span className="tr-badge">{t('providerCallsBadge')}</span>
          </div> : null}
        </SurfaceSection>

        {state.error !== undefined ? <SurfaceState phase="error" title={t('actionBlocked')}
          description={<>{state.error.code}{state.error.detail === undefined ? undefined : ` — ${state.error.detail}`}{state.error.missing === undefined || state.error.missing.length === 0 ? undefined : <ul className="tr-missing">{state.error.missing.map(name => <li key={name}>{name}</li>)}</ul>}</>} /> : null}
      </> : null}
    </div>
  </Surface>
}
