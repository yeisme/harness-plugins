import {
  type AriaAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { surfaceStyles } from './styles.ts'

export type SurfaceKind = 'navigator' | 'workspace' | 'inspector' | 'dialog' | 'micro'
export type SurfacePhase = 'loading' | 'empty' | 'error' | 'stale' | 'partial' | 'success' | 'disabled'
type DataAttributes = { readonly [key: `data-${string}`]: string | number | boolean | undefined }

function classes(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => value !== undefined && value.length > 0).join(' ')
}

export type SurfaceProps = HTMLAttributes<HTMLElement> & DataAttributes & {
  readonly kind: SurfaceKind
  readonly children?: ReactNode
}

export function Surface({ kind, className, children, ...rest }: SurfaceProps): ReactNode {
  return <section {...rest} data-yeisme-surface data-surface-kind={kind} className={classes('ys-surface', className)}>
    <style data-yeisme-surface-styles dangerouslySetInnerHTML={{ __html: surfaceStyles }} />
    {children}
  </section>
}

export type SurfaceContextBarProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & DataAttributes & {
  readonly title?: ReactNode
  readonly context?: ReactNode
  readonly description?: ReactNode
  readonly status?: ReactNode
  readonly nav?: ReactNode
  readonly actions?: ReactNode
}

export function SurfaceContextBar({ title, context, description, status, nav, actions, className, ...rest }: SurfaceContextBarProps): ReactNode {
  return <header {...rest} className={classes('ys-context-bar', className)}>
    <div className="ys-context-copy">
      {title === undefined ? null : <h2 className="ys-context-title">{title}</h2>}
      {context === undefined ? null : <span className="ys-context-value">{context}</span>}
      {description === undefined ? null : <span className="ys-context-description">{description}</span>}
    </div>
    {status === undefined ? null : <div className="ys-context-status">{status}</div>}
    {actions === undefined ? null : <div className="ys-context-actions">{actions}</div>}
    {nav === undefined ? null : <nav className="ys-context-nav">{nav}</nav>}
  </header>
}

export type SurfaceSectionProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & DataAttributes & {
  readonly title?: ReactNode
  readonly description?: ReactNode
  readonly meta?: ReactNode
  readonly children?: ReactNode
}

export function SurfaceSection({ title, description, meta, className, children, ...rest }: SurfaceSectionProps): ReactNode {
  const header = title !== undefined || description !== undefined || meta !== undefined
  return <section {...rest} className={classes('ys-section', className)}>
    {header ? <header className="ys-section-header">
      <div className="ys-section-copy">
        {title === undefined ? null : <h2 className="ys-section-title">{title}</h2>}
        {description === undefined ? null : <p className="ys-section-description">{description}</p>}
      </div>
      {meta === undefined ? null : <div className="ys-section-meta">{meta}</div>}
    </header> : null}
    {children}
  </section>
}

const LIVE_BY_PHASE: Record<SurfacePhase, AriaAttributes['aria-live']> = {
  loading: 'polite',
  empty: 'polite',
  error: 'assertive',
  stale: 'polite',
  partial: 'polite',
  success: 'polite',
  disabled: 'polite',
}

export type SurfaceStateProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & DataAttributes & {
  readonly phase: SurfacePhase
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly action?: ReactNode
}

export function SurfaceState({ phase, title, description, action, className, ...rest }: SurfaceStateProps): ReactNode {
  return <div
    {...rest}
    className={classes('ys-state', className)}
    data-phase={phase}
    role={phase === 'error' ? 'alert' : 'status'}
    aria-live={LIVE_BY_PHASE[phase]}
  >
    <strong className="ys-state-title">{title}</strong>
    {description === undefined ? null : <p className="ys-state-description">{description}</p>}
    {action === undefined ? null : <div className="ys-state-action">{action}</div>}
  </div>
}

export type SurfaceActionBarProps = HTMLAttributes<HTMLElement> & DataAttributes & {
  readonly sticky?: boolean
  readonly children?: ReactNode
}

export function SurfaceActionBar({ sticky = false, className, children, ...rest }: SurfaceActionBarProps): ReactNode {
  return <footer {...rest} className={classes('ys-action-bar', className)} data-sticky={sticky}>{children}</footer>
}

export { surfaceStyles }
