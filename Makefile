.PHONY: install setup-db run-pipeline run-service dev test lint clean

# Install dependencies for both Python (via uv) and Node.js
install:
	@echo "Installing Python dependencies..."
	uv sync
	@echo "Installing Node.js dependencies..."
	npm install

# Setup the database schema using the URL from .env (requires valid .env)
setup-db:
	@echo "Loading schema into database..."
	psql "$$DATABASE_URL" -f database/schema.sql

# Run the data ingestion pipeline
run-pipeline:
	uv run python main_pipeline.py

# Run the Analytics Service (FastAPI)
run-service:
	uv run uvicorn analytics_service.main:app --reload --port 8000

# Run the full development stack (Frontend + Backend)
dev:
	npm run dev

# Run tests
test:
	@echo "Running Python tests..."
	PYTHONPATH=. uv run pytest tests/ -v

# Linting
lint:
	@echo "Linting Python..."
	uv run ruff check .
	@echo "Linting TypeScript..."
	npm run check

# Clean up build artifacts and caches
clean:
	rm -rf dist
	rm -rf node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
