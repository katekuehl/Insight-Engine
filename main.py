"""Top-level entrypoint for the Strata Analytics FastAPI service.

This module re-exports the FastAPI `app` from `analytics_service.main` so the
service can be started from the repository root.
"""

import os

from analytics_service.main import app


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("ANALYTICS_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
