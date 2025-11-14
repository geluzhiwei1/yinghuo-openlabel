# Production environment
FROM nginx:alpine

ARG VITE_APP_BASE_URI=/guis/yinghuo
# Copy pre-built assets from local dist directory
COPY apps/web-app/dist /usr/share/nginx/html/yinghuo/${VITE_APP_BASE_URI}

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]