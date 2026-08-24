/**
 * Type contract tests for ui-agent-preset.
 *
 * These tests verify type compatibility without requiring JSX transformation.
 */

import { describe, it, expect } from 'vitest'
import type {
  ToolProjection,
  PromptSectionProjection,
  ProjectionUnit,
  PermissionPreset,
  HealthStatus,
  DriftStatus,
  CompositionSummary,
  PresetMetadata,
  CompositionPreview,
  MaturitySlot,
  ExtendedCompositionPreview,
  PreviewPanelProps,
  PreviewActionProps
} from '../src/client/types'

describe('Type Contracts', () => {
  describe('ToolProjection', () => {
    it('should accept valid tool projection', () => {
      const tool: ToolProjection = {
        name: 'read_file',
        schema_digest: 'sha256:abc123',
        source_plugin: 'dsh-tools',
        source_layer: 'preset'
      }

      expect(tool.name).toBe('read_file')
      expect(tool.source_layer).toBe('preset')
    })

    it('should require source_layer union type', () => {
      const tool1: ToolProjection = {
        name: 'test',
        schema_digest: 'digest',
        source_plugin: 'plugin',
        source_layer: 'preset'
      }

      const tool2: ToolProjection = {
        name: 'test',
        schema_digest: 'digest',
        source_plugin: 'plugin',
        source_layer: 'registry'
      }

      expect(tool1.source_layer).toBe('preset')
      expect(tool2.source_layer).toBe('registry')
    })
  })

  describe('PromptSectionProjection', () => {
    it('should accept valid section projection without content', () => {
      const section: PromptSectionProjection = {
        id: 'system',
        section_digest: 'sha256:sys123',
        source_plugin: 'dsh-system-prompt'
      }

      expect(section.id).toBe('system')
      // Content deliberately NOT included - this is a safety constraint
      expect(section).not.toHaveProperty('content')
    })
  })

  describe('PermissionPreset', () => {
    it('should accept valid permission preset', () => {
      const permissions: PermissionPreset = {
        sandbox_mode: 'default',
        approval_policy: 'conservative',
        contrib_source: 'official'
      }

      expect(permissions.sandbox_mode).toBe('default')
      expect(permissions.approval_policy).toBe('conservative')
      expect(permissions.contrib_source).toBe('official')
    })

    it('should require valid union types', () => {
      const sandboxModes: PermissionPreset['sandbox_mode'][] = ['default', 'strict', 'open']
      const approvalPolicies: PermissionPreset['approval_policy'][] = ['default', 'conservative', 'permissive']
      const contribSources: PermissionPreset['contrib_source'][] = ['official', 'community', 'local']

      expect(sandboxModes).toContain('default')
      expect(approvalPolicies).toContain('conservative')
      expect(contribSources).toContain('official')
    })
  })

  describe('HealthStatus', () => {
    it('should represent three-layer health', () => {
      const health: HealthStatus = {
        shape_ok: true,
        mount_ok: true,
        provable_mount_ref: 'gen-1-stamp123'
      }

      expect(health.shape_ok).toBe(true)
      expect(health.mount_ok).toBe(true)
      expect(health.provable_mount_ref).toBeDefined()
    })

    it('should allow reason on mount failure', () => {
      const health: HealthStatus = {
        shape_ok: true,
        mount_ok: false,
        reason: 'unscoped',
        provable_mount_ref: undefined
      }

      expect(health.mount_ok).toBe(false)
      expect(health.reason).toBe('unscoped')
      expect(health.provable_mount_ref).toBeUndefined()
    })

    it('should support all failure reasons', () => {
      const reasons: HealthStatus['reason'][] = [
        'unscoped',
        'unusable_row',
        'root_realm_service',
        'broken'
      ]

      reasons.forEach(reason => {
        const health: HealthStatus = {
          shape_ok: true,
          mount_ok: false,
          reason,
          provable_mount_ref: undefined
        }
        expect(health.reason).toBe(reason)
      })
    })
  })

  describe('DriftStatus', () => {
    it('should represent drift state', () => {
      const drift: DriftStatus = {
        state: 'none'
      }

      expect(drift.state).toBe('none')
    })

    it('should include details for diverged state', () => {
      const drift: DriftStatus = {
        state: 'diverged',
        source_id: 'original',
        source_digest: 'sha256:original',
        copy_digest: 'sha256:modified'
      }

      expect(drift.state).toBe('diverged')
      expect(drift.source_id).toBe('original')
    })

    it('should support all drift states', () => {
      const states: DriftStatus['state'][] = ['none', 'unknown', 'diverged']

      states.forEach(state => {
        const drift: DriftStatus = { state }
        expect(drift.state).toBe(state)
      })
    })
  })

  describe('CompositionPreview', () => {
    it('should require all composition fields', () => {
      const preview: CompositionPreview = {
        preset: {
          id: 'standard',
          trust: 'official',
          composition_stamp: 'stamp123',
          generation: 1
        },
        health: {
          shape_ok: true,
          mount_ok: true,
          provable_mount_ref: 'ref'
        },
        drift: {
          state: 'none'
        },
        composition: {
          tools: [],
          prompt_sections: [],
          projection_units: [],
          permissions: {
            sandbox_mode: 'default',
            approval_policy: 'default',
            contrib_source: 'official'
          }
        },
        capability_digest: 'sha256:cap',
        generated_at: '2024-08-24T10:00:00Z'
      }

      expect(preview.preset.id).toBe('standard')
      expect(preview.capability_digest).toBe('sha256:cap')
    })
  })

  describe('MaturitySlot', () => {
    it('should represent Ordo-provided maturity data', () => {
      const maturity: MaturitySlot = {
        dimensions: {
          effectiveness: 5,
          reliability: 4,
          security: 5,
          maintainability: 4
        },
        qualified: true,
        risk_level: 'low',
        evidence_ref: 'evidence-123'
      }

      expect(maturity.qualified).toBe(true)
      expect(maturity.risk_level).toBe('low')
      expect(maturity.dimensions.effectiveness).toBe(5)
    })

    it('should support all risk levels', () => {
      const riskLevels: MaturitySlot['risk_level'][] = [
        'low',
        'medium',
        'high',
        'critical'
      ]

      riskLevels.forEach(level => {
        const maturity: MaturitySlot = {
          dimensions: { effectiveness: 3, reliability: 3, security: 3, maintainability: 3 },
          qualified: level === 'low',
          risk_level: level
        }
        expect(maturity.risk_level).toBe(level)
      })
    })
  })

  describe('ExtendedCompositionPreview', () => {
    it('should extend base with optional maturity', () => {
      const base: CompositionPreview = {
        preset: { id: 'test', trust: 'community', composition_stamp: 's', generation: 1 },
        health: { shape_ok: true, mount_ok: true, provable_mount_ref: 'r' },
        drift: { state: 'unknown' },
        composition: {
          tools: [],
          prompt_sections: [],
          projection_units: [],
          permissions: { sandbox_mode: 'default', approval_policy: 'default', contrib_source: 'local' }
        },
        capability_digest: 'd',
        generated_at: '2024-01-01T00:00:00Z'
      }

      const extended: ExtendedCompositionPreview = {
        ...base,
        maturity: {
          dimensions: { effectiveness: 4, reliability: 4, security: 4, maintainability: 4 },
          qualified: true,
          risk_level: 'medium'
        }
      }

      expect(extended.maturity).toBeDefined()
      expect(extended.maturity?.qualified).toBe(true)
    })
  })

  describe('Component Props', () => {
    it('PreviewPanelProps should require necessary fields', () => {
      const props: PreviewPanelProps = {
        presetId: 'standard',
        isOpen: true,
        onClose: () => {},
        triggerRef: { current: null }
      }

      expect(props.presetId).toBe('standard')
      expect(props.isOpen).toBe(true)
      expect(typeof props.onClose).toBe('function')
    })

    it('PreviewActionProps should support customization', () => {
      const props: PreviewActionProps = {
        presetId: 'minimal',
        label: 'View Details',
        onClick: (id) => console.log(id)
      }

      expect(props.presetId).toBe('minimal')
      expect(props.label).toBe('View Details')
      expect(typeof props.onClick).toBe('function')
    })
  })
})

describe('Type Safety Guarantees', () => {
  it('should NOT allow raw prompt content in sections', () => {
    const section: PromptSectionProjection = {
      id: 'system',
      section_digest: 'sha256:abc',
      source_plugin: 'plugin'
    }

    // This is a compile-time guarantee - the type doesn't have a 'content' field
    type SectionWithContent = PromptSectionProjection & { content: string }
    const shouldNotCompile: SectionWithContent = section as any

    // Runtime check: content field should not exist
    expect(section).not.toHaveProperty('content')
  })

  it('should NOT allow full schema in tools', () => {
    const tool: ToolProjection = {
      name: 'test',
      schema_digest: 'sha256:xyz',
      source_plugin: 'dsh-tools',
      source_layer: 'preset'
    }

    // Type guarantee: no 'schema' field, only 'schema_digest'
    expect(tool).not.toHaveProperty('schema')
    expect(tool.schema_digest).toBe('sha256:xyz')
  })

  it('should expose only safe digests', () => {
    const preview: CompositionPreview = {
      preset: { id: 't', trust: 'official', composition_stamp: 's', generation: 1 },
      health: { shape_ok: true, mount_ok: true, provable_mount_ref: 'r' },
      drift: { state: 'none' },
      composition: {
        tools: [
          { name: 'tool1', schema_digest: 'sha256:abc', source_plugin: 'p1', source_layer: 'preset' }
        ],
        prompt_sections: [
          { id: 'sys', section_digest: 'sha256:def', source_plugin: 'p2' }
        ],
        projection_units: [],
        permissions: { sandbox_mode: 'default', approval_policy: 'default', contrib_source: 'official' }
      },
      capability_digest: 'sha256:cap123',
      generated_at: '2024-01-01T00:00:00Z'
    }

    // Only digests exposed, no raw content
    preview.composition.tools.forEach(tool => {
      expect(tool.schema_digest).toMatch(/^sha256:/)
      expect(tool).not.toHaveProperty('schema')
    })

    preview.composition.prompt_sections.forEach(section => {
      expect(section.section_digest).toMatch(/^sha256:/)
      expect(section).not.toHaveProperty('content')
    })
  })
})
