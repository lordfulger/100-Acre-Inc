# Running 100 Acre Inc on your own server (Linux + Apache)

The game runs in a Docker container that only listens on the server itself
(`127.0.0.1:3001`). Your Apache passes your domain's traffic to it, including the
game's live connections, and **certbot** gives it HTTPS. HTTPS isn't optional:
Google sign-in, phone notifications and adding the game to an iPhone home screen all need it.

Saves and woods stay in the same Supabase database as now, so nobody loses anything.

These steps are for Debian or Ubuntu (the usual home of `apache2`). Run them as a user with `sudo`.

## What you need

- **Apache 2.4.47 or newer.** Check with `apache2 -v`. Ubuntu 22.04+ and Debian 12 are fine. If yours is older, tell Claude: there's another way to pass the live connections through.
- **A domain name** (or a subdomain of yours) pointing at the server: an **A record** with the server's public IP, e.g. `honey.yourdomain.com`.
  - No domain? A free one from [duckdns.org](https://www.duckdns.org) works.
- **Ports 80 and 443** reachable from the internet. Apache is probably already using them.
- **Docker.** Check with `docker --version`. If it's missing:

  ```
  curl -fsSL https://get.docker.com | sudo sh
  ```

## 1. Get the game onto the server

```
git clone https://github.com/lordfulger/100-Acre-Inc.git
cd 100-Acre-Inc
cp .env.example .env
```

## 2. Fill in `.env`

Open it with `nano .env`:

- **PUBLIC_URL**: `https://` plus your domain, e.g. `https://honey.yourdomain.com`
- **SESSION_SECRET**, **GOOGLE_CLIENT_ID**, **SUPABASE_URL**, **SUPABASE_SERVICE_KEY**: copy each one from Render (your service → **Environment**). Using the same values means everyone's sign-ins and cloud saves carry straight over.
- **DOMAIN** isn't needed with Apache. Leave it blank.

Keep `.env` private. It never goes into GitHub.

## 3. Start the game

```
sudo docker compose -f docker-compose.apache.yml up -d --build
```

The first build takes a few minutes. Check it's running:

```
curl http://127.0.0.1:3001/health
```

It should print `{"ok":true,...}`.

## 4. Point Apache at it

Turn on the proxy modules (harmless if they're already on):

```
sudo a2enmod proxy proxy_http proxy_wstunnel
```

Add the site. Copy the ready-made file, then put your domain in it (replace `honey.example.com`):

```
sudo cp deploy/apache-100acre.conf /etc/apache2/sites-available/100acre.conf
sudo nano /etc/apache2/sites-available/100acre.conf
sudo a2ensite 100acre
sudo apache2ctl configtest
sudo systemctl reload apache2
```

`configtest` should say `Syntax OK`.

## 5. Turn on HTTPS

If certbot isn't installed yet:

```
sudo apt install certbot python3-certbot-apache
```

Then:

```
sudo certbot --apache -d honey.yourdomain.com
```

Choose to **redirect** HTTP to HTTPS when it asks. certbot makes the HTTPS version of the site, copying the game's settings across, and renews the certificate by itself.

Open `https://honey.yourdomain.com/health`: it should say `{"ok":true,...}`. Then open `https://honey.yourdomain.com` and the game should load.

## 6. Let anyone sign in with Google (no more adding Gmail accounts)

In [console.cloud.google.com](https://console.cloud.google.com), pick the game's project, then:

1. **APIs & Services → Credentials →** click the game's **OAuth 2.0 Client ID**. Under **Authorized JavaScript origins**, click **+ Add URI**, enter `https://honey.yourdomain.com`, and **Save**. (Keep the Render one too while you're switching over.)
2. **OAuth consent screen** (or **Google Auth Platform → Audience**) → **Publish app** → **Confirm**. The status changes from *Testing* to *In production*.

From then on, **any Google account can sign in**, and you never add test users again. The game only asks for name and email, so Google doesn't need to review it. Changes can take a few minutes to apply.

## 7. Move everyone over

1. On the **old** Render address, check each player is signed in with Google (the ☁️ card on the Nap tab shows when it last saved). That's their backup.
2. On the **new** address, each player signs in with Google and picks **load the cloud save** when asked. Saves on a phone belong to one web address, so the cloud save is how progress moves.
3. On iPhone, add the new address to the Home Screen and delete the old icon.
4. Turn notifications on again from the Friends tab. They're tied to the address too.
5. **Then stop the Render service** (Render → your service → **Settings → Suspend**). Both copies share the same woods in Supabase, so don't run both for long.

## Updating later

When there's a new version on GitHub:

```
cd 100-Acre-Inc
git pull
sudo docker compose -f docker-compose.apache.yml up -d --build
```

The game restarts by itself if the server reboots.

## If something's wrong

- **See what the game is doing:** `sudo docker compose -f docker-compose.apache.yml logs -f game`
- **Apache's side:** `sudo tail -f /var/log/apache2/100acre-error.log`
- **The page loads but stays "Connecting…" on the Friends tab:** the live connections aren't getting through. Check `proxy_wstunnel` is enabled (step 4), and that the HTTPS site (`/etc/apache2/sites-available/100acre-le-ssl.conf`) has the `ProxyPass ... upgrade=websocket` line.
- **Google sign-in says "origin not allowed":** the domain isn't in **Authorized JavaScript origins** yet (step 6), or it's still applying.

## Not using Apache?

On a server where nothing else uses ports 80/443, `docker-compose.yml` runs the game together with **Caddy**, which handles HTTPS by itself. Put your domain in `DOMAIN` in `.env` and run `sudo docker compose up -d --build`. Steps 4 and 5 aren't needed then.
