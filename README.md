# Discord Video Previews for Nextcloud using a Cloudflare Worker

Enable Discord video previews for Nextcloud share links using a Cloudflare Worker.

## How It Works

1. Discord fetches your Nextcloud share link
2. Cloudflare Worker intercepts the request
3. Worker removes Nextcloud's `og:type="object"` tag (default embed)
4. Worker adds proper video meta tags for a video preview embed:
   - `og:type="video.movie"`
   - `og:video:url` with working direct video URL
   - Range request support for video seeking

## Setup

### Prerequisites

- Domain managed by Cloudflare
- Nextcloud instance on that domain
- Node.js and npm/pnpm installed locally

### Installation

1. **Install Wrangler CLI**

   ```bash
   pnpm add -g wrangler
   ```

2. **Clone this repository**

   ```bash
   git clone https://github.com/uwuclxdy/nextcloud-discord-preview-cf
   cd nextcloud-discord-preview-cf
   ```

3. **Configure for your domain**

   Edit `cloudflare-worker.js` and replace `YOUR-DOMAIN.com` with your domain:

   ```javascript
   const videoUrl = `https://YOUR-DOMAIN.com/public.php/dav/files/${shareToken}/?accept=zip`
   ```

   Edit `wrangler.toml` to update the route and set your account id (under **Account Details** on **Workers & Pages**):

   ```toml
   routes = [
     { pattern = "YOUR-DOMAIN.com/s/*", zone_name = "YOUR-DOMAIN.com" }
   ]
   ```

4. **Login to Cloudflare**

   ```bash
   wrangler login
   ```

5. **Deploy**

   ```bash
   wrangler deploy
   ```

---

> Discord caches link previews. You may need to add `?v=1` initially to clear the cache:
```
https://your-domain.com/s/ABC123?v=1
```

## Requirements

- ✅ Nextcloud share link must be **public** (no password)
- ✅ Video file formats: `.mp4`, `.webm`, `.mov`
- ✅ Your Nextcloud must be accessible via HTTPS
- ✅ Domain must be on Cloudflare
