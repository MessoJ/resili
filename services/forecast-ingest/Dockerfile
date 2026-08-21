FROM python:3.11-slim

WORKDIR /app

# Copy project metadata and source, then install. The package is built from
# ./src (setuptools packages.find where=["src"]), so the source must be present
# before `pip install .` can build the wheel.
COPY pyproject.toml .
COPY src/ src/
COPY tests/ tests/
RUN pip install --no-cache-dir .

# Train the model at build time so startup is instant
RUN python -m src.model.train

EXPOSE 8001

# Honour the platform-provided $PORT (Render, Railway, Cloud Run, etc.),
# defaulting to 8001 for local runs.
CMD ["sh", "-c", "uvicorn src.api.serve:app --host 0.0.0.0 --port ${PORT:-8001}"]
