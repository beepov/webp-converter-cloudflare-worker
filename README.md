# WebP Converter (Cloudflare Worker)

A serverless image converter built with TypeScript on Cloudflare Workers. Send it a JPEG, PNG, GIF, or AVIF image and it returns a WebP image. Optional resizing and quality settings are supported.

Conversion runs on Cloudflare's **Images binding**, so it doesn't use your Worker's CPU budget the way a pure JavaScript or WASM converter would.

## Features

- Converts JPEG, PNG, GIF, WebP, and AVIF to WebP
- Optional `quality` (1-100) and `width` (resize) parameters
- Input validation (content type and file size)
- API key protection
- Runs on Cloudflare's global network with no servers to manage

## Requirements

- Node.js 18 or newer
- A free [Cloudflare account](https://dash.cloudflare.com)
- Wrangler (included as a dev dependency, run with `npx wrangler`)

## Project structure

```
webp-converter-cloudflare-worker/
├── src/
│   └── index.ts        # Worker code
├── wrangler.jsonc      # Worker configuration and bindings
├── .dev.vars           # Local secrets (do not commit)
├── package.json
└── README.md
```

## Setup

### 1. Create the project

```bash
npm create cloudflare@latest webp-converter-cloudflare-worker
```

Choose: **Hello World example**, then **Worker only**, then **TypeScript**, Git: yes, Deploy now: **no**.

```bash
cd webp-converter-cloudflare-worker
npx wrangler login
```

### 2. Configure `wrangler.jsonc`

```jsonc
{
  "name": "webp-converter-cloudflare-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "observability": { "enabled": true },
  "images": { "binding": "IMAGES" }
}
```

### 3. Generate TypeScript types

```bash
npx wrangler types
```

Run this again whenever you change bindings or secrets in the config.

### 4. Add your code

Put the Worker code in `src/index.ts`. It handles `POST /convert`, validates the request, and uses `env.IMAGES` to output WebP.

### 5. Set the local API key

Create `.dev.vars` in the project root:

```
API_KEY=test-key
```

Add `.dev.vars` to `.gitignore` so it is never committed.

## API

### `POST /convert`

Converts the image in the request body to WebP.

**Headers**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | One of `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif` |
| `x-api-key` | Yes | Your API key |

**Query parameters**

| Parameter | Default | Description |
|---|---|---|
| `quality` | `80` | WebP quality, 1 to 100 |
| `width` | none | Resize to this width in pixels (maximum 4000), keeping the aspect ratio |

**Body**: the raw image bytes (not multipart form data).

**Responses**

| Status | Meaning |
|---|---|
| `200` | WebP image returned in the body |
| `400` | Empty request body |
| `401` | Missing or wrong API key |
| `404` | Unknown path |
| `405` | Method is not POST |
| `413` | File larger than 10 MB |
| `415` | Unsupported content type |
| `422` | Image could not be converted |

## Run locally

```bash
npx wrangler dev
```

In another terminal:

```bash
curl -X POST "http://localhost:8787/convert?quality=80&width=800" \
  -H "Content-Type: image/jpeg" \
  -H "x-api-key: test-key" \
  --data-binary @photo.jpg \
  --output photo.webp
```

Open `photo.webp` to check the result. If the local Images binding gives you trouble, use `npx wrangler dev --remote` to run against Cloudflare's real service.

## Deploy to production

1. Set the production secret (use a long random value, not the local one):

   ```bash
   npx wrangler secret put API_KEY
   ```

2. Deploy:

   ```bash
   npx wrangler deploy
   ```

3. Test with your `*.workers.dev` URL:

   ```bash
   curl -X POST "https://webp-converter-cloudflare-worker.cheasocheat-km.workers.dev/convert?quality=80" \
     -H "Content-Type: image/png" \
     -H "x-api-key: YOUR_PRODUCTION_KEY" \
     --data-binary @image.png \
     --output image.webp
   ```

## Operations

```bash
npx wrangler tail                # live production logs
npx wrangler deployments list    # deployment history
npx wrangler rollback            # revert to the previous deployment
```

**Custom domain** (domain must use Cloudflare DNS): add this to `wrangler.jsonc` and redeploy.

```jsonc
"routes": [{ "pattern": "images.yourdomain.com", "custom_domain": true }]
```

## Security notes

- Keep `API_KEY` in Wrangler secrets only, never in source code.
- Add a **WAF rate limiting rule** for your domain in the Cloudflare dashboard to stop abuse.
- If browsers will call the API directly, add CORS headers and handle `OPTIONS` requests. Don't expose the API key in frontend code; call the Worker from your own backend instead.

## Limits and notes

- Image transformations have a free monthly allowance and are billed beyond that on paid plans. Check the current Cloudflare Images pricing page.
- Cloudflare limits input file size and pixel dimensions. The 10 MB check in the code is a safe guard.
- Animated GIFs may not convert as expected. Test with your own files.
- A quality of 75 to 85 is a good balance of size and appearance for photos.
- [sharp](https://www.npmjs.com/package/sharp) does not run on Workers because it is a native Node.js addon. Use it only on Node servers, containers, or AWS Lambda.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Env` or `env.IMAGES` not recognized in TypeScript | Run `npx wrangler types` |
| `401 Unauthorized` locally | Check that `.dev.vars` contains `API_KEY` and that you restarted `wrangler dev` |
| `401 Unauthorized` in production | Set the secret with `npx wrangler secret put API_KEY` |
| `415 Unsupported type` | Send the correct `Content-Type` header with `--data-binary` (not `-F`) |
| `422 Could not convert image` | Check that the file is a valid image within size limits; view logs with `npx wrangler tail` |

## Possible next steps

- Save converted images to **R2** storage and return a URL
- Add CORS support
- Add per-client rate limiting
