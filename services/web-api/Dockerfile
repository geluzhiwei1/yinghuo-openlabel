# Stage 1: Build dependencies
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim AS builder

WORKDIR /app

COPY services/web-api/pyproject.toml ./
COPY services/web-api/src/.keep ./src/.keep

# Install production dependencies using pip
RUN pip install . -i https://pypi.tuna.tsinghua.edu.cn/simple

# Stage 2: Production environment
FROM python:${PYTHON_VERSION}-slim AS production

WORKDIR /app

# Install OpenCV runtime dependencies and PostgreSQL client
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin


# Copy application code
COPY services/web-api/pyproject.toml ./
COPY services/web-api/src/ ./src/
COPY services/web-api/config/ ./config/

RUN pip install . --user -i https://pypi.tuna.tsinghua.edu.cn/simple

EXPOSE 8423

CMD ["uvicorn", "yinghuo_app.app:app", "--host", "0.0.0.0", "--port", "8423"]