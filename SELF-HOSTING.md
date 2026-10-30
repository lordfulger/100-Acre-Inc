# Running 100 Acre Inc on your own server

Your server runs two things in Docker: the game (the web version plus the multiplayer
server) and **Caddy**, which gives it HTTPS with a free certificate it renews by itself.
HTTPS isn't optional: Google sign-in, phone notifications and adding the game to an
iPhone home screen all need it.

Saves and woods stay in the same Supabase database as now, so nobody loses anything.

## What you need

- A server with **Docker** (and Docker Compose) installed, on Linux or Windows.
- **Ports 80 and 443** open to the internet. If the server is at home, forward both ports on your router to it.
- **A domain name** pointing at the server: an **A record** with your server's public IP. For example `honey.yourdomain.com`.
  - No domain? A free one from [duckdns.org](https://www.duckdns.org) works (e.g. `hundredacre.duckdns.org`).
- Nothing else may already be using ports 80/443. If another web server (nginx, IIS…) is, tell Claude, and the setup can sit behind that instead.

## 1. Get the game onto the server

```
git clone https://github.com/lordfulger/100-Acre-Inc.git
cd 100-Acre-Inc
cp .env.example .env
```

## 2. Fill in `.env`

Open `.env` in a text editor:

- **DOMAIN**: your domain, e.g. `honey.yourdomain.com`
- **PUBLIC_URL**: the same with `https://` in front
- **SESSION_SECRET**, **GOOGLE_CLIENT_ID**, **SUPABASE_URL**, **SUPABASE_SERVICE_KEY**: copy each one from Render (your service → **Environment**). Using the same values means everyone's sign-ins and cloud saves carry straight over.

Keep `.env` private. It never goes into GitHub.

## 3. Start it

```
docker compose up -d --build
```

The first build takes a few minutes. Then open `https://your-domain/health`. It should say `{"ok":true,...}`. The first visit can take a few seconds while Caddy fetches the certificate.

## 4. Let anyone sign in with Google (no more adding Gmail accounts)

In [console.cloud.google.com](https://console.cloud.google.com), pick the game's project, then:

1. **APIs & Services → Credentials →** click the game's **OAuth 2.0 Client ID**. Under **Authorized JavaScript origins**, click **+ Add URI**, enter `https://your-domain`, and **Save**. (Keep the Render one too while you're switching over.)
2. **OAuth consent screen** (or **Google Auth Platform → Audience**) → **Publish app** → **Confirm**. The status changes from *Testing* to *In production*.

From then on, **any Google account can sign in**, and you never add test users again. The game only asks for name and email, so Google doesn't need to review it. Changes can take a few minutes to apply.

## 5. Move everyone over

1. On the **old** Render address, check each player is signed in with Google (☁️ on the Nap tab shows when it last saved). That's their backup.
2. On the **new** address, each player signs in with Google and picks **load the cloud save** when asked. Saves on a phone belong to one web address, so the cloud save is how progress moves.
3. On iPhone, add the new address to the Home Screen and delete the old icon.
4. Turn notifications on again from the Friends tab. They're tied to the address too.
5. **Then stop the Render service** (Render → your service → **Settings → Suspend**). Both copies share the same woods in Supabase, so don't run both for long.

## Updating later

When there's a new version on GitHub:

```
git pull
docker compose up -d --build
```

## If something's wrong

- **See what the game is doing:** `docker compose logs -f game`
- **Certificate problems:** `docker compose logs -f caddy`. Usually the domain doesn't point at the server yet, or ports 80/443 aren't reachable from outside.
- **Google sign-in says "origin not allowed":** the domain isn't in **Authorized JavaScript origins** yet (step 4), or it's still applying.
