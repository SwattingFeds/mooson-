# MONSOON — Telegram Rare Finder

A responsive local dashboard for generating username candidates, requesting cautious manual checks, tracking local activity, publishing admin announcements, and playing music through official embeds.

## Requirements
- Node.js 18 or newer
- A browser

## Run locally
1. Copy `.env.example` to `.env`.
2. Set `ADMIN_PASSWORD` to a unique random value of at least 12 characters.
3. Optionally add freshly regenerated Discord webhook URLs to the four `DISCORD_*_WEBHOOK` variables. Do not paste webhook URLs into frontend files or commit `.env`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

No npm dependencies are required.

## Telegram verification limitation
This project deliberately does **not** claim to check Telegram's complete username index or infer availability from a missing public profile. A `t.me/<username>` page, a failed public lookup, and the standard Bot API do not reliably prove that a username can be claimed. The check action therefore records `unknown` and opens Telegram for manual verification. The admin panel can record an independently verified result; these counts are explicitly labeled as manually marked.

The five-letter mode generates exactly five lowercase letters. Rare-word and odd-form modes use a small local word list and are candidate generators, not availability databases. There is no scraping, account enumeration, or automated mass checking.

## Discord integrations
The server can send manually marked statuses to the available/taken webhook variables, admin announcements to the updates webhook, and a system heartbeat every five minutes to the system webhook. Heartbeats and announcements are only delivered when a valid webhook URL is configured. Webhook URLs are secrets: rotate any URL previously shared in chat and use only new URLs in `.env`.

## Admin panel
Set `ADMIN_PASSWORD` before using the admin panel. If it is missing or shorter than 12 characters, admin actions are disabled. The admin password is sent only to this local server in an `x-admin-password` header. For public deployment, add HTTPS, proper user authentication, persistent storage, CSRF protection, and hosting-level rate limiting before exposing it to the internet.

## Music
The player uses official Spotify, SoundCloud, and YouTube embeds. Playback may require provider cookies, an account, or be restricted by region; it does not bypass provider access rules or guarantee every track is free.

## Scope
This is a runnable starter project, not a hosted service. Metrics and announcements are stored in memory and reset when the server restarts. Do not expose the local admin panel to the public internet without additional security hardening.


Discord webhook configuration: set `DISCORD_UPDATES_WEBHOOK`, `DISCORD_BUGS_WEBHOOK`, `DISCORD_SYSTEM_WEBHOOK`, `DISCORD_AVAILABLE_WEBHOOK`, and `DISCORD_TAKEN_WEBHOOK` in your local `.env` file. The bugs webhook receives unexpected server errors. Never commit `.env` or share webhook tokens.


## Mobile and browser support

MONSOON is a responsive web app and installable Progressive Web App (PWA).

- Open the deployed HTTPS URL in a modern browser on desktop, iPhone, iPad, or Android.
- On supported desktop browsers and Android Chrome, use **INSTALL APP** when it appears, or the browser's Install/Add to Home Screen menu.
- On iPhone/iPad, open the HTTPS site in Safari, tap **Share**, then **Add to Home Screen**.
- The service worker caches the app shell (HTML, CSS, JavaScript, manifest, and icon) for a basic offline launch. API calls, live metrics, admin actions, and music embeds still require an internet connection.
- For local development, `http://localhost:3000` is supported. To use from another device on your Wi-Fi, bind the server to your LAN interface and open its LAN address; PWA installation generally requires HTTPS except localhost. For public use, deploy behind HTTPS.

The interface includes mobile-safe touch targets, narrow-screen layouts, safe scrolling, and reduced-motion support. Browser support depends on the browser's support for modern JavaScript, Fetch, EventSource, and service workers.

## Deploy to Render

This repository includes `render.yaml` for a Render Blueprint deployment. Create a new Blueprint from the GitHub repository, then enter the prompted secret environment variables in the Render Dashboard. The web service listens on `0.0.0.0` using Render's injected `PORT` and exposes `/healthz` for health checks.

The current dashboard uses in-memory statistics and announcements. They reset on process restart or instance replacement. Do not treat this starter as a hardened public admin service: add persistent storage, proper account authentication, CSRF protection, and rate limiting before relying on public admin actions. The current `DISCORD_BUGS_WEBHOOK` variable is reserved in the deployment template but bug-event delivery is not yet implemented in this code version.


## Render deployment notes

This repository is configured as a Render Node.js Web Service using `render.yaml`. Connect the Git repository to Render as a Blueprint, or set the service commands manually to `npm install` and `npm start`, with health check path `/healthz`. The app binds to `0.0.0.0` and Render's `PORT`.

Set `ADMIN_PASSWORD` (at least 24 random characters) and the five Discord webhook environment variables in Render's Environment page. Never commit `.env` or paste webhook URLs into source files. The server validates webhook host/path before sending.

The current dashboard data is in memory and resets on restarts/redeploys. Render Free services have an ephemeral filesystem and can spin down after inactivity; the five-minute heartbeat only runs while the service process is awake. Persistent history and dependable scheduled reporting require a persistent datastore and a separately scheduled worker/cron service.

The `/api/check` endpoint intentionally returns `unknown`; it does not claim Telegram username availability. Admin status labels are manual annotations, not automated Telegram verification.
