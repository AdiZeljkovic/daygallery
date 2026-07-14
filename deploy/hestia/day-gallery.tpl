# HestiaCP nginx proxy template (HTTP) — day-gallery.com (PRODUKCIJA)
# Prije SSL-a služi da Let's Encrypt prođe validaciju i da sajt radi na HTTP-u.
# Nakon uključivanja SSL-a Hestia koristi day-gallery.stpl.
#
# Portovi: API 4712, WEB 3712

server {
    listen      %ip%:%web_port%;
    server_name %domain_idn% %alias_idn%;
    root        %docroot%;

    client_max_body_size 25m;

    access_log  /var/log/nginx/domains/%domain%.log combined;
    error_log   /var/log/nginx/domains/%domain%.error.log error;

    # Let's Encrypt validacija mora ići na disk, ne u proxy
    location ~ ^/\.well-known/acme-challenge/ {
        root %docroot%;
        try_files $uri =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4712;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4712;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4712;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3712;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
