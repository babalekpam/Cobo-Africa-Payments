#!/bin/bash
set -e

DOMAIN="cob-o.com"
APP_DIR="/opt/cobo-africa"
SSH_HOST="$VPS_SSH_HOST"
SSH_USER="$VPS_SSH_USER"
SSH_PASS="$VPS_SSH_PASSWORD"

if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ] || [ -z "$SSH_PASS" ]; then
  echo "ERROR: VPS_SSH_HOST, VPS_SSH_USER, VPS_SSH_PASSWORD must be set"
  exit 1
fi

SSH_CMD="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $SSH_USER@$SSH_HOST"
SCP_CMD="sshpass -p '$SSH_PASS' scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "=== Building frontend ==="
PORT=3000 BASE_PATH="/" pnpm --filter @workspace/cobo-payments run build

echo "=== Building backend ==="
pnpm --filter @workspace/api-server run build

echo "=== Preparing deployment package ==="
rm -rf /tmp/cobo-deploy
mkdir -p /tmp/cobo-deploy/api/dist
mkdir -p /tmp/cobo-deploy/frontend

cp -r artifacts/api-server/dist/* /tmp/cobo-deploy/api/dist/
cp artifacts/api-server/package.json /tmp/cobo-deploy/api/

cp -r artifacts/cobo-payments/dist/public/* /tmp/cobo-deploy/frontend/
cp -r artifacts/cobo-payments/public/* /tmp/cobo-deploy/frontend/ 2>/dev/null || true

cat > /tmp/cobo-deploy/api/ecosystem.config.cjs << 'PMEOF'
module.exports = {
  apps: [{
    name: "cobo-api",
    script: "./dist/index.mjs",
    env: {
      NODE_ENV: "production",
      PORT: 8080,
    },
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "512M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }]
};
PMEOF

cat > /tmp/cobo-deploy/setup-server.sh << 'SETUPEOF'
#!/bin/bash
set -e

DOMAIN="cob-o.com"
APP_DIR="/opt/cobo-africa"

echo "=== Installing system dependencies ==="
apt-get update -y
apt-get install -y curl nginx certbot python3-certbot-nginx postgresql postgresql-contrib

if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "=== Installing Node.js 20 ==="
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
  echo "=== Installing PM2 ==="
  npm install -g pm2
fi

echo "=== Setting up PostgreSQL ==="
systemctl enable postgresql
systemctl start postgresql

if ! su - postgres -c "psql -lqt" | grep -q "cobo_africa"; then
  su - postgres -c "psql -c \"CREATE USER cobo WITH PASSWORD 'CoboDb2024!';\""
  su - postgres -c "psql -c \"CREATE DATABASE cobo_africa OWNER cobo;\""
  su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE cobo_africa TO cobo;\""
  echo "PostgreSQL database 'cobo_africa' created"
else
  echo "PostgreSQL database 'cobo_africa' already exists"
fi

echo "=== Setting up application directory ==="
mkdir -p $APP_DIR/api/dist
mkdir -p $APP_DIR/frontend

cp -r /tmp/cobo-deploy/api/* $APP_DIR/api/
cp -r /tmp/cobo-deploy/frontend/* $APP_DIR/frontend/

cat > $APP_DIR/api/.env << 'ENVEOF'
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://cobo:CoboDb2024!@localhost:5432/cobo_africa
JWT_SECRET=cobo-jwt-secret-production-2024-change-me
SESSION_SECRET=cobo-session-secret-production-2024-change-me
ENVEOF

echo "=== Configuring Nginx ==="
cat > /etc/nginx/sites-available/$DOMAIN << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR/frontend;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "=== Starting application with PM2 ==="
cd $APP_DIR/api

if [ ! -d "node_modules" ]; then
  npm init -y > /dev/null 2>&1
  npm install nodemailer handlebars pg > /dev/null 2>&1
fi

pm2 delete cobo-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "=== Setting up SSL with Let's Encrypt ==="
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect 2>/dev/null || echo "SSL setup requires DNS to point to this server first. Run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo ""
echo "============================================"
echo "  COBO Africa deployed successfully!"
echo "  Domain: https://$DOMAIN"
echo "  API: https://$DOMAIN/api"
echo "============================================"
echo ""
echo "IMPORTANT: Update these in $APP_DIR/api/.env:"
echo "  - JWT_SECRET (use a secure random string)"
echo "  - SESSION_SECRET (use a secure random string)"
echo "  - DATABASE_URL (if different from default)"
echo ""
echo "After updating .env, restart with: pm2 restart cobo-api"
echo ""
SETUPEOF

chmod +x /tmp/cobo-deploy/setup-server.sh

echo "=== Uploading files to VPS ==="
eval $SSH_CMD "rm -rf /tmp/cobo-deploy && mkdir -p /tmp/cobo-deploy"

cd /tmp && tar czf cobo-deploy.tar.gz cobo-deploy/
eval $SCP_CMD /tmp/cobo-deploy.tar.gz $SSH_USER@$SSH_HOST:/tmp/
eval $SSH_CMD "cd /tmp && tar xzf cobo-deploy.tar.gz"

echo "=== Running server setup ==="
eval $SSH_CMD "bash /tmp/cobo-deploy/setup-server.sh"

echo ""
echo "=== Deployment complete! ==="
echo "Make sure your DNS records point to $SSH_HOST:"
echo "  A record: $DOMAIN → $SSH_HOST"
echo "  A record: www.$DOMAIN → $SSH_HOST"
