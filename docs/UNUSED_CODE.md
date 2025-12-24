# Unused Code Audit

This document lists code that appears to be unused or orphaned based on a static analysis of imports and references. Review before deleting—some items may be used dynamically or reserved for future features.

---

## Frontend (`client/src/`)

### Unused UI Components (shadcn/ui)

These components exist in `client/src/components/ui/` but are **never imported** elsewhere:

| File | Notes |
|------|-------|
| `accordion.tsx` | Not imported anywhere |
| `aspect-ratio.tsx` | Not imported anywhere |
| `breadcrumb.tsx` | Not imported anywhere |
| `carousel.tsx` | Not imported anywhere |
| `chart.tsx` | Not imported anywhere |
| `command.tsx` | Only imported by `dialog.tsx` (internal dependency) |
| `context-menu.tsx` | Not imported anywhere |
| `drawer.tsx` | Not imported anywhere |
| `form.tsx` | Not imported anywhere |
| `hover-card.tsx` | Not imported anywhere |
| `input-otp.tsx` | Not imported anywhere |
| `menubar.tsx` | Not imported anywhere |
| `navigation-menu.tsx` | Not imported anywhere |
| `pagination.tsx` | Not imported anywhere |
| `radio-group.tsx` | Not imported anywhere |
| `resizable.tsx` | Not imported anywhere |

**Recommendation**: These are likely scaffolded by shadcn/ui CLI. Safe to delete if not needed, or keep for future use.

---

## Backend (`server/`)

### Orphan Scripts

| File | Notes |
|------|-------|
| `server/scripts/import-demo-data.ts` | Not referenced in `package.json` scripts or imported anywhere. Likely a one-off utility. |

**Recommendation**: Either wire up as an npm script or delete if no longer needed.

---

## Python

### All operators appear to be used

All operator modules in `analytics_service/operators/` are imported by `analytics_service/main.py` and exposed via FastAPI endpoints.

### Pipeline modules

| Module | Status |
|--------|--------|
| `connectors/csv_importer.py` | Used by `main_pipeline.py` |
| `loaders/data_loader.py` | Used by `main_pipeline.py` |
| `schemas/schema_definitions.py` | Used by `connectors` and `loaders` |
| `verification/data_verification.py` | Used by `main_pipeline.py` |
| `config.py` | Used by `main.py` and `main_pipeline.py` |

**No orphan Python modules detected.**

---

## Summary

| Category | Unused Items |
|----------|--------------|
| UI Components | ~16 shadcn/ui components |
| Server Scripts | 1 (`import-demo-data.ts`) |
| Python | 0 |

---

## Next Steps

1. **Keep or delete** unused UI components based on roadmap.
2. **Wire up or remove** `server/scripts/import-demo-data.ts`.
3. Re-run this audit after major refactors.
