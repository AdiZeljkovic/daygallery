# HestiaCP nginx proxy template (HTTP) — daygallery
# Instalacija: kopiraj u /usr/local/hestia/data/templates/web/nginx/
# Rutira: /api /socket.io /uploads → Node API (:4000), sve ostalo → Next (:3005)

server {
    listen      %ip%:%web_port%;
    server_name %domain_idn% %alias_idn%;
    root        %docroot%;

    client_max_body_size 25m;

    access_log  /var/log/nginx/domains/%domain%.log combined;
    error_log   /var/log/nginx/domains/%domain%.error.log error;

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:4711;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Slike
    location /uploads/ {
        proxy_pass http://127.0.0.1:4711;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.io (WebSocket)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4711;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }

    # Next.js frontend
    location / {
        proxy_pass http://127.0.0.1:3711;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    include %home%/%user%/conf/web/%domain%/nginx.forcessl.conf*;
}
