FROM python:3.11-slim

WORKDIR /app

# Install curl for container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml alembic.ini ./
RUN pip install --no-cache-dir -e . psycopg2-binary

COPY alembic ./alembic
COPY src ./src
COPY entrypoint.sh .
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000
ENV PYTHONPATH=/app/src

HEALTHCHECK --interval=5s --timeout=5s --retries=5 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
