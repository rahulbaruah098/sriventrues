FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY shared /build/shared
COPY frontend /build/frontend
RUN npm run build

FROM python:3.12-slim AS application
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN addgroup --system sri && adduser --system --ingroup sri sri
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app/backend
COPY shared /app/shared
COPY --from=frontend /build/frontend/dist /app/frontend/dist
COPY deploy/start.sh /app/start.sh
RUN mkdir -p /app/media && chown sri:sri /app/media && chmod +x /app/start.sh
USER sri
EXPOSE 8000
ENTRYPOINT ["/app/start.sh"]
