/**
 * PreviewPanel: Read-only composition preview for agent presets.
 *
 * Displays tools, prompt sections, permissions, health, drift, and optional
 * maturity slot without modifying any files or starting sessions.
 *
 * Accessibility:
 * - Full keyboard navigation (Escape to close, Tab to navigate)
 * - Focus trap within modal
 * - Screen reader announcements
 * - Reduced motion support
 * - Focus returns to trigger on close
 */

import React, { useEffect, useRef, useCallback, useState } from 'react'
import type {
  ExtendedCompositionPreview,
  PreviewPanelProps,
  PreviewActionProps,
  HealthStatus,
  DriftStatus,
  ToolProjection,
  PromptSectionProjection,
  PermissionPreset,
  MaturitySlot
} from './types'

interface PreviewPanelState {
  preview: ExtendedCompositionPreview | null
  loading: boolean
  error: string | null
}

/**
 * Format digest for display (first 12 chars).
 */
function formatDigest(digest: string): string {
  return digest.substring(0, 12)
}

/**
 * Format timestamp for display.
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

/**
 * Health status badge component.
 */
function HealthBadge({ health }: { health: HealthStatus }) {
  if (!health.mount_ok) {
    return (
      <span className="dsh-badge dsh-badge-error" role="status" aria-label="Mount failed">
        Mount Failed
        {health.reason && <span className="dsh-badge-reason">: {health.reason}</span>}
      </span>
    )
  }
  if (!health.shape_ok) {
    return (
      <span className="dsh-badge dsh-badge-warning" role="status" aria-label="Shape invalid">
        Shape Invalid
      </span>
    )
  }
  return (
    <span className="dsh-badge dsh-badge-success" role="status" aria-label="Healthy">
      Healthy
    </span>
  )
}

/**
 * Drift status badge component.
 */
function DriftBadge({ drift }: { drift: DriftStatus }) {
  switch (drift.state) {
    case 'none':
      return (
        <span className="dsh-badge dsh-badge-success" role="status" aria-label="No drift">
          Synced
        </span>
      )
    case 'diverged':
      return (
        <span
          className="dsh-badge dsh-badge-warning"
          role="status"
          aria-label="Diverged from source"
        >
          Diverged
        </span>
      )
    case 'unknown':
      return (
        <span className="dsh-badge dsh-badge-neutral" role="status" aria-label="Unknown drift">
          Unknown
        </span>
      )
  }
}

/**
 * Maturity slot display (only when Ordo provides it).
 */
function MaturityDisplay({ maturity }: { maturity?: MaturitySlot }) {
  if (!maturity) {
    return null
  }

  return (
    <section
      className="dsh-preview-maturity"
      aria-label="Maturity assessment"
      role="region"
    >
      <h4 className="dsh-preview-section-title">Maturity</h4>
      <div className="dsh-maturity-grid">
        <div className="dsh-maturity-dimensions">
          <div className="dsh-maturity-dimension">
            <span className="dsh-label">Effectiveness</span>
            <span className="dsh-value" aria-label={`Effectiveness ${maturity.dimensions.effectiveness} out of 5`}>
              {'★'.repeat(maturity.dimensions.effectiveness)}
              {'☆'.repeat(5 - maturity.dimensions.effectiveness)}
            </span>
          </div>
          <div className="dsh-maturity-dimension">
            <span className="dsh-label">Reliability</span>
            <span className="dsh-value" aria-label={`Reliability ${maturity.dimensions.reliability} out of 5`}>
              {'★'.repeat(maturity.dimensions.reliability)}
              {'☆'.repeat(5 - maturity.dimensions.reliability)}
            </span>
          </div>
          <div className="dsh-maturity-dimension">
            <span className="dsh-label">Security</span>
            <span className="dsh-value" aria-label={`Security ${maturity.dimensions.security} out of 5`}>
              {'★'.repeat(maturity.dimensions.security)}
              {'☆'.repeat(5 - maturity.dimensions.security)}
            </span>
          </div>
          <div className="dsh-maturity-dimension">
            <span className="dsh-label">Maintainability</span>
            <span className="dsh-value" aria-label={`Maintainability ${maturity.dimensions.maintainability} out of 5`}>
              {'★'.repeat(maturity.dimensions.maintainability)}
              {'☆'.repeat(5 - maturity.dimensions.maintainability)}
            </span>
          </div>
        </div>
        <div className="dsh-maturity-status">
          <div className={`dsh-qualified-badge ${maturity.qualified ? 'qualified' : 'not-qualified'}`} role="status">
            {maturity.qualified ? 'Qualified' : 'Not Qualified'}
          </div>
          <div className={`dsh-risk-badge risk-${maturity.risk_level}`} role="status">
            Risk: {maturity.risk_level}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Tools list component.
 */
function ToolsList({ tools }: { tools: ToolProjection[] }) {
  return (
    <section className="dsh-preview-tools" aria-label="Tools">
      <h4 className="dsh-preview-section-title">Tools ({tools.length})</h4>
      <ul className="dsh-tools-list">
        {tools.map((tool) => (
          <li key={tool.name} className="dsh-tool-item">
            <div className="dsh-tool-name">{tool.name}</div>
            <div className="dsh-tool-meta" aria-label={`Source ${tool.source_plugin} layer ${tool.source_layer}`}>
              <span className="dsh-tool-source">{tool.source_plugin}</span>
              <span className="dsh-tool-layer">{tool.source_layer}</span>
            </div>
            <code className="dsh-tool-digest" title={tool.schema_digest}>
              {formatDigest(tool.schema_digest)}
            </code>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Prompt sections list component (omits content, shows only id + digest).
 */
function PromptSectionsList({ sections }: { sections: PromptSectionProjection[] }) {
  return (
    <section className="dsh-preview-sections" aria-label="Prompt sections">
      <h4 className="dsh-preview-section-title">Prompt Sections ({sections.length})</h4>
      <ul className="dsh-sections-list">
        {sections.map((section) => (
          <li key={section.id} className="dsh-section-item">
            <div className="dsh-section-id">{section.id}</div>
            <div className="dsh-section-source" aria-label={`Source ${section.source_plugin}`}>
              {section.source_plugin}
            </div>
            <code className="dsh-section-digest" title={section.section_digest}>
              {formatDigest(section.section_digest)}
            </code>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Permissions display component.
 */
function PermissionsDisplay({ permissions }: { permissions: PermissionPreset }) {
  return (
    <section className="dsh-preview-permissions" aria-label="Permissions">
      <h4 className="dsh-preview-section-title">Permissions</h4>
      <div className="dsh-permissions-grid">
        <div className="dsh-permission-item">
          <span className="dsh-label">Sandbox</span>
          <span className="dsh-value">{permissions.sandbox_mode}</span>
        </div>
        <div className="dsh-permission-item">
          <span className="dsh-label">Approval</span>
          <span className="dsh-value">{permissions.approval_policy}</span>
        </div>
        <div className="dsh-permission-item">
          <span className="dsh-label">Source</span>
          <span className="dsh-value">{permissions.contrib_source}</span>
        </div>
      </div>
    </section>
  )
}

/**
 * Main Preview panel component.
 */
export function PreviewPanel({
  presetId,
  isOpen,
  onClose,
  triggerRef
}: PreviewPanelProps): React.ReactElement | null {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)
  const [state, setState] = React.useState<PreviewPanelState>({
    preview: null,
    loading: false,
    error: null
  })

  // Fetch preview data when panel opens
  useEffect(() => {
    if (!isOpen) {
      setState({ preview: null, loading: false, error: null })
      return
    }

    let mounted = true
    setState({ preview: null, loading: true, error: null })

    // TODO: Replace with actual host bridge call to AgentCompositionPreview.project()
    // For now, this is a placeholder that will be integrated with the host service
    Promise.resolve()
      .then(() => {
        if (!mounted) return
        // Placeholder - will be replaced with real projection data
        setState({
          preview: null,
          loading: false,
          error: 'Preview service not yet integrated with host bridge'
        })
      })
      .catch((err) => {
        if (!mounted) return
        setState({ preview: null, loading: false, error: err.message })
      })

    return () => {
      mounted = false
    }
  }, [isOpen, presetId])

  // Focus management: save previous active element, focus modal on open
  useEffect(() => {
    if (isOpen) {
      previousActiveRef.current = document.activeElement as HTMLElement
      // Focus first focusable element in modal
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      }, 0)
    } else {
      // Return focus to trigger when closing
      triggerRef?.current?.focus()
    }
  }, [isOpen, triggerRef])

  // Keyboard handler: Escape to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose]
  )

  // Focus trap within modal
  const handleFocus = useCallback((e: React.FocusEvent) => {
    if (!isOpen || !modalRef.current) return

    // If focus moved outside modal, bring it back
    if (!modalRef.current?.contains(e.relatedTarget as Node)) {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="dsh-preview-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="dsh-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsh-preview-title"
        onKeyDown={handleKeyDown}
        onBlur={handleFocus}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dsh-preview-header">
          <h2 id="dsh-preview-title" className="dsh-preview-title">
            Preset Preview: {presetId}
          </h2>
          <button
            className="dsh-preview-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            ×
          </button>
        </header>

        <div className="dsh-preview-content">
          {state.loading && (
            <div className="dsh-preview-loading" role="status" aria-live="polite">
              Loading preview...
            </div>
          )}

          {state.error && (
            <div className="dsh-preview-error" role="alert" aria-live="assertive">
              Error: {state.error}
            </div>
          )}

          {state.preview && (
            <>
              {/* Status badges */}
              <div className="dsh-preview-status">
                <HealthBadge health={state.preview.health} />
                <DriftBadge drift={state.preview.drift} />
              </div>

              {/* Preset metadata */}
              <section className="dsh-preview-metadata" aria-label="Preset information">
                <div className="dsh-metadata-row">
                  <span className="dsh-label">Trust:</span>
                  <span className="dsh-value">{state.preview.preset.trust}</span>
                </div>
                <div className="dsh-metadata-row">
                  <span className="dsh-label">Generation:</span>
                  <span className="dsh-value">{state.preview.preset.generation}</span>
                </div>
                <div className="dsh-metadata-row">
                  <span className="dsh-label">Capability Digest:</span>
                  <code className="dsh-value" title={state.preview.capability_digest}>
                    {formatDigest(state.preview.capability_digest)}
                  </code>
                </div>
                <div className="dsh-metadata-row">
                  <span className="dsh-label">Generated:</span>
                  <time className="dsh-value" dateTime={state.preview.generated_at}>
                    {formatTimestamp(state.preview.generated_at)}
                  </time>
                </div>
              </section>

              {/* Drift details */}
              {state.preview.drift.state === 'diverged' && (
                <section className="dsh-preview-drift-details" aria-label="Drift information">
                  <h4 className="dsh-preview-section-title">Drift Details</h4>
                  <div className="dsh-drift-info">
                    <div className="dsh-drift-row">
                      <span className="dsh-label">Source:</span>
                      <span className="dsh-value">{state.preview.drift.source_id}</span>
                    </div>
                    {state.preview.drift.source_digest && (
                      <div className="dsh-drift-row">
                        <span className="dsh-label">Source Digest:</span>
                        <code className="dsh-value" title={state.preview.drift.source_digest}>
                          {formatDigest(state.preview.drift.source_digest)}
                        </code>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Maturity slot (Ordo-only) */}
              <MaturityDisplay maturity={state.preview.maturity} />

              {/* Composition details */}
              <div className="dsh-preview-composition">
                <ToolsList tools={state.preview.composition.tools} />
                <PromptSectionsList sections={state.preview.composition.prompt_sections} />
                <PermissionsDisplay permissions={state.preview.composition.permissions} />
              </div>

              {/* Projection units */}
              {state.preview.composition.projection_units.length > 0 && (
                <section className="dsh-preview-units" aria-label="Projection units">
                  <h4 className="dsh-preview-section-title">Projection Units</h4>
                  <ul className="dsh-units-list">
                    {state.preview.composition.projection_units.map((unit) => (
                      <li key={unit.key} className="dsh-unit-item">
                        <span className="dsh-unit-key">{unit.key}</span>
                        <span className="dsh-unit-source">{unit.source}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="dsh-preview-footer">
          <p className="dsh-preview-note">
            This is a read-only preview. No sessions or agents are started.
          </p>
        </footer>
      </div>
    </div>
  )
}

/**
 * Preview action button for preset rows/seats.
 */
export function PreviewAction({
  presetId,
  label = 'Preview',
  onClick
}: PreviewActionProps): React.ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(presetId)
    } else {
      setIsOpen(true)
    }
  }, [onClick, presetId])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <>
      <button
        ref={triggerRef}
        className="dsh-preview-action-button"
        onClick={handleClick}
        aria-label={`Preview preset ${presetId}`}
        type="button"
      >
        {label}
      </button>

      <PreviewPanel
        presetId={presetId}
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef}
      />
    </>
  )
}
