FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy source code
COPY src/ src/
COPY tests/ tests/

# Train the model at build time so startup is instant
RUN python -m src.model.train

EXPOSE 8001

CMD ["uvicorn", "src.api.serve:app", "--host", "0.0.0.0", "--port", "8001"]
