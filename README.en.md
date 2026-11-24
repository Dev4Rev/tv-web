# Dev4Rev TV

[English](README.en.md) · [Русский](README.md)

**Dev4Rev TV** is a static media player for watching public M3U playlists right in your browser. No build step, backend, or API is needed: everything runs on HTML, CSS, and vanilla JavaScript.

## What this is, in plain words

Open the page and you get a TV and a cinema in one window. You can watch channels from ready-made thematic collections or paste your own playlist URL. Everything works in the browser without installing extra apps.

Technically, it is a demo of a client-side media player and a collection system. The repository contains the site code and M3U files with links to publicly available media resources. Video files are not hosted here: the player only plays what is reachable at the given addresses. Legal films and cartoons with direct HTTPS links are grouped in the "Открытое кино" (open cinema) section and marked "ОТКРЫТОЕ КИНО". Restored full-movie playlists and torrent distributions are still marked "НЕОФИЦИАЛЬНО"; their availability depends on the original sources.

## Features

- Player with HLS, DASH, MPEG-TS and native video support, PiP, mini-player and fullscreen mode.
- Live ambient glow around the video: colors are taken from the current frame (for CORS-accessible streams) or from the collection palette.
- Search across channels and playlists, favorites, user collections and custom M3U uploads — all stored locally in your browser.
- Support for `magnet:` links and local `.torrent` files via the bundled WebTorrent (for legal distributions with web seeds).
- Responsive interface: comfortable on phones, tablets and desktops, with safe-area support and short-landscape rules.
- Separate privacy policy and 404 pages, with public URLs without `.html`.

## Structure

```text
index.html                       Page and player markup
assets/css/main.css              Styles, responsive layout, cinema mode
assets/js/                       Player, playlist and collection logic
assets/data/collections.json     Collection and playlist metadata
assets/data/search-index.json    Search index
assets/data/collections/*.m3u    Built-in playlists
assets/data/torrents/*.torrent   Torrent metadata files
privacy.html, 404.html           Privacy policy and error page
CNAME                            Custom domain
```

## Run locally

With Docker:

```bash
docker compose up -d --build
# open http://localhost:999/
```

Without Docker — `python serve.py`. It also serves `404.html` for unknown paths. A plain `python -m http.server 999` does not support a custom 404, so it cannot be used to test the redirect.

## Publishing

This is a regular static site: publish the repository root via GitHub Pages (branch `main`, root `/`) or copy the files to any static host. `CNAME` sets the domain `tv.dev4rev.ru`; the canonical link in `index.html` points to the same address.

Internal paths are relative (`./assets/...`), but `<base href="/">` binds them to the domain root — this keeps assets and 404 working even on a fallback from a nested URL. The site is designed to be published at the domain root.

## Disclaimer

This project is a technical demo and is not a host for video content. All links point to third-party public resources; availability and legality of specific materials are determined by their owners and the law of the applicable jurisdiction. The user decides which streams to open. Labels in the interface distinguish official, open-licensed and unofficial materials.
