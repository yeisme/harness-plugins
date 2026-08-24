# Command Experience Router Upstream Contribution

## Purpose

This directory contains additive seam proposals for DeepSeek Harness (DSH) to support unified command experience capabilities.

## Status

🟡 **Exploration Phase** - Skeleton created, awaiting actual DSH runtime probe results to determine if upstream seams are truly needed.

## Current Assessment

Based on capability analysis (`openspec/changes/dsh-codex-command-experience-v1/dsh-capability-analysis.md`), the following seams may be needed:

### 🔍 Potentially Needed (Requires Probe Verification)

1. **Thread Hierarchy Projection**
   - What: Safe projection of recursive subagent tree structure
   - Why: Enable `/subagents` to show full thread hierarchy
   - Fallback: Flat list with parentRef pointers
   - Probe Path: Check `dshRuntime.getThreadProjection()` returns hierarchical structure

2. **Session Metadata Projection**
   - What: Project/workspace context for sessions
   - Why: Enable `/resume` to show work context
   - Fallback: Title-only display
   - Probe Path: Check `sessionProjection.project` availability

3. **Owner Preview for Destructive Actions**
   - What: Impact preview for `/archive`, `/delete`
   - Why: Proper confirmation flow for destructive commands
   - Fallback: Keep commands staged/disabled
   - Probe Path: Check if owner actions support preview mode

## Decision Criteria

**No upstream PR needed if:**
- `@deepseek-ai/dsh-client-runtime` provides adequate session/thread projection
- Owner action mechanism supports receipt-based confirmation
- Missing capabilities can be safely disabled with reasons

**Upstream PR needed if:**
- Core seams (projection, owner actions) are completely absent
- Current APIs are insufficient for safe, read-only projection
- DSH team expresses interest in official command experience integration

## Structure

```
upstream-prs/command-experience-router/
├── README.md (this file)
├── changes.patch        (if needed: diff against DSH main)
├── new-files/           (if needed: new DSH files)
├── apply.sh             (if needed: automated application script)
└── head.bundle          (if needed: bundle for testing)
```

## Next Steps

1. ✅ Create skeleton structure
2. 🔍 Run actual DSH runtime probe in staging environment
3. 📋 Determine if upstream contribution is truly needed
4. 🚫 If not needed: document why and mark as "not required"
5. ✅ If needed: implement additive changes with PR description

## Contact

For questions about this upstream contribution, refer to:
- Change: `openspec/changes/dsh-codex-command-experience-v1/`
- Analysis: `openspec/changes/dsh-codex-command-experience-v1/dsh-capability-analysis.md`
