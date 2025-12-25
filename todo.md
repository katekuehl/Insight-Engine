# TODO

## High Priority

- [ ] Fix local Postgres setup so `psql "$DATABASE_URL" -f database/schema.sql` succeeds.
- [x] Create a `.env` file at repo root with `DATABASE_URL` and (optionally) `ANALYTICS_PORT`.
- [ ] Verify `pip3 install -r requirements.txt` succeeds on your machine (may take a while because of `torch`, `prophet`, etc.).
- [x] Choose and standardize the Python runtime version (3.9 vs 3.11+) across docs and tooling:
  - [x] Update `pyproject.toml` `requires-python` accordingly
  - [x] Ensure `requirements.txt` matches that decision
  - [x] Update `TECHNICAL_MEMO.md` / `README.md` references to Python version
- [ ] Start the FastAPI service and validate:
  - [ ] `python3 -m uvicorn main:app --reload --port 8000`
  - [ ] `GET /health`

## Medium Priority

- [ ] Add a minimal pytest suite:
  - [ ] Unit tests for `connectors/csv_importer.py` parsing helpers.
  - [ ] Unit test that `loaders/data_loader.get_connection()` errors when `DATABASE_URL` is missing.
  - [ ] Smoke test that `analytics_service.main` imports cleanly from repo root.

## Cleanup / Quality

- [ ] Decide whether to keep `analytics_service/requirements.txt` in sync manually or generate it from `pyproject.toml` (to prevent drift).
- [ ] Consider raising HTTP status codes (`HTTPException`) instead of always returning `success=False` with 200 in the analytics service.
- [ ] Consider adding logging (structured logs) for operator execution errors.
- [ ] Align "no synthetic/fallback data" policy across pipeline vs analytics service:
  - [ ] Decide whether `analytics_service/operators/prepare_data.py` may generate sample data
  - [ ] If not allowed, remove the sample-data fallback and fail fast with a clear error
  - [ ] If allowed for dev only, document it explicitly (and gate behind env flag)
- [ ] Regenerate the "Proof of Operation" examples in `TECHNICAL_MEMO.md` from actual current runs (avoid inconsistent examples like negative sessions).

## Code Quality

- [ ] Reduce broad exception handling in Python (`except Exception`) by catching narrower exceptions where possible and preserving tracebacks.
- [ ] Replace `print(...)` in the pipeline with a logger and consistent log levels.
- [ ] Replace server `console.log/console.error` calls with a structured logger and avoid logging full objects by default.
- [ ] Remove or resolve remaining TODO markers in the client (`client/src/pages/data-sources.tsx`, `client/src/pages/integrations.tsx`).
- [ ] Reduce TypeScript `any` usage (`server/routes.ts`, `server/orchestration/dag-executor.ts`, `client/src/pages/debug-console.tsx`):
  - [ ] Introduce shared types/interfaces for API payloads.
  - [ ] Turn on stricter TS flags where feasible (e.g. `noImplicitAny` is already implied by `strict`, but reduce explicit `any`).
- [ ] Add a lightweight lint/format pass:
  - [ ] Python: ruff (or black+isort)
  - [ ] TS/TSX: eslint + prettier

## Security

- [ ] Add auth/authz checks to server routes that accept `:orgId` / `:userId` params to prevent IDOR (insecure direct object reference).
- [ ] Add rate limiting on auth- and invite-related endpoints (register, sync, invite create/accept) to reduce brute force / abuse.
- [ ] Review request/response logging in `server/index.ts` (currently logs full JSON bodies); redact tokens/secrets/PII before logging.
- [ ] Add CORS policy explicitly for API routes (restrict origins, methods, headers) rather than relying on defaults.
- [ ] Consider CSRF protections if using cookie-based sessions for authenticated API calls.
- [ ] Audit `dangerouslySetInnerHTML` usage (`client/src/components/ui/chart.tsx`); ensure injected values cannot be user-controlled or sanitize inputs.
- [ ] Ensure secrets are only read from environment variables and never committed (Stripe/Supabase keys); add a pre-commit/CI secret scan.

## Nice to Have

- [x] Add a `Makefile` or `justfile` with common commands (install, run service, run pipeline, load schema).
- [ ] Add CI workflow to run lint + tests.
- [x] Switch to `uv` for speedier dependency installation.

## Frontend Polish (New)
- [ ] Implement Skeleton loaders for Analytics charts while fetching data.
- [ ] Add error boundaries to React components to prevent full-page crashes.
- [ ] Consistent empty states for all tables (like in `data-sources.tsx`).
- [ ] Add toast notifications for long-running processes (e.g. "Pipeline started...").

## Backend Polish (New)
- [ ] Structured Logging: Replace `console.log` with a logger (e.g., `winston` or `pino`) for better production debugging.
- [ ] Request ID Tracking: Middleware to attach a unique ID to every request/log for tracing.
- [ ] Health Check Endpoint: Standardize `/health` for both Express and FastAPI.