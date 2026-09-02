# Stage 1: Build dependencies
ARG PYTHON_VERSION=3.12
# 国内工作站用默认清华源;GitHub Actions 等海外环境 --build-arg 传官方源
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
FROM python:${PYTHON_VERSION}-slim AS builder

WORKDIR /app

COPY services/web-api/pyproject.toml ./
COPY services/web-api/src/.keep ./src/.keep

# Install production dependencies using pip
RUN pip install . -i ${PIP_INDEX_URL}

# Stage 2: Production environment
FROM python:${PYTHON_VERSION}-slim AS production

# 版本元数据(构建时注入,/version 端点上报)
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ARG CHANNEL=dev
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV YH_VERSION=${APP_VERSION} YH_GIT_SHA=${GIT_SHA} YH_CHANNEL=${CHANNEL}

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

# captcha 字体文件(PIL truetype 需要)— pyproject 没声明 package-data,显式 COPY
COPY services/web-api/src/yinghuo_app/captcha/font/ /root/.local/lib/python3.12/site-packages/yinghuo_app/captcha/font/

# openlabel 规范数据(纯 JSON 目录,不随 pip install 进 site-packages)。
# openlabel.JSON_PATHS 的第三项解析到 site-packages/,这里 COPY 到该位置才能被找到
COPY services/web-api/src/openlabel-specs/ /root/.local/lib/python3.12/site-packages/openlabel-specs/

RUN pip install . --user -i ${PIP_INDEX_URL}

EXPOSE 8423

CMD ["uvicorn", "yinghuo_app.app:app", "--host", "0.0.0.0", "--port", "8423"]