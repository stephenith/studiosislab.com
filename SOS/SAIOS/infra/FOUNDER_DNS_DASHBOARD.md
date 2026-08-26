# Founder DNS step (Phase D)

Create an A record:

  founder.studiosislab.com → 178.104.94.0

Until DNS propagates, Caddy cannot issue TLS for the site.
Password is stored on VPS only at:

  /root/founder-dashboard-password.txt (mode 600)
  user: founder

After DNS:

  https://founder.studiosislab.com → basic auth → 127.0.0.1:4310
