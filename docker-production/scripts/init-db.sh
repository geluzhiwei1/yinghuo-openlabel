#!/bin/bash
export PGPASSWORD=prodpass
# 等待 PostgreSQL 数据库服务就绪
until psql -h postgres -p 5432 -U produser -d postgres -c 'SELECT 1' > /dev/null 2>&1; do
  echo 'Waiting for postgres to be ready...'
  sleep 2
done

# 检查 yinghuo-prod 数据库是否存在，不存在则创建
psql -h postgres -p 5432 -U produser -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'yinghuo-prod'" | grep -q 1 || 
psql -h postgres -p 5432 -U produser -d postgres -c "CREATE DATABASE \"yinghuo-prod\";"

# 启动应用程序
exec uvicorn yinghuo_app.app:app --port 8423 --host 0.0.0.0