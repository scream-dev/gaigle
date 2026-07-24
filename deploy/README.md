# Деплой Gaigle

Сайт → GitHub Pages (`gaigle.screamdev.xyz`), бэкенд → VPS (`gaigle-api.screamdev.xyz`).

## 1. DNS (у регистратора screamdev.xyz)

- `gaigle.screamdev.xyz` — сайт на GitHub Pages. Либо `CNAME` на `<username>.github.io`,
  либо 4 A-записи на IP Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- `gaigle-api.screamdev.xyz` — `A`-запись на IP вашего VPS.

## 2. GitHub Pages (сайт)

1. Settings → Pages → Source: **GitHub Actions**.
2. Settings → Pages → Custom domain: `gaigle.screamdev.xyz`, включить **Enforce HTTPS**
   (файл `client/CNAME` уже добавлен, workflow публикует папку `client/`).
3. Push в `main` — воркфлоу `.github/workflows/deploy.yml` задеплоит сайт.

## 3. VPS (бэкенд)

```bash
# как пользователь gaigle (или свой), путь /srv/gaigle — пример
git clone <repo> /srv/gaigle && cd /srv/gaigle/server
npm ci --omit=dev

# создать server/.env (НЕ коммитить):
cat > .env <<'EOF'
PORT=3000
ALLOWED_ORIGINS=https://gaigle.screamdev.xyz
ONLYSQ_BASE_URL=https://api.onlysq.me/ai/v2
ONLYSQ_API_KEY=<ваш-персональный-ключ>
ONLYSQ_MODEL=deepseek-v4-pro
EOF
chmod 600 .env

# systemd
sudo cp deploy/gaigle.service /etc/systemd/system/gaigle.service
# при необходимости поправьте WorkingDirectory/EnvironmentFile/User в юните
sudo systemctl daemon-reload
sudo systemctl enable --now gaigle
sudo systemctl status gaigle

# Caddy (авто-HTTPS)
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 4. Файрвол

Открыть только `80`, `443`, `ssh`. Порт `3000` наружу не выставлять — Node слушает
локально, наружу проксирует Caddy.

## 5. Проверка

```bash
curl -s https://gaigle-api.screamdev.xyz/api/health
curl -s -X POST https://gaigle-api.screamdev.xyz/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"тест","lang":"ru"}'
```
