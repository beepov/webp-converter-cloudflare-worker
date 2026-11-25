/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx): Promise<Response> {
// 		return new Response("Hello World!");
// 	},
// } satisfies ExportedHandler<Env>;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname !== "/convert") {
			return Response.json({ error: "Not found" }, { status: 404 });
		}
		if (request.method !== "POST") {
			return Response.json({ error: "Use POST" }, { status: 405 });
		}

		// Validate content type
		const contentType = request.headers.get("content-type") ?? "";
		if (!ALLOWED_TYPES.includes(contentType)) {
			return Response.json(
				{ error: `Unsupported type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
				{ status: 415 }
			);
		}

		// Validate size
		const length = Number(request.headers.get("content-length") ?? 0);
		if (length > MAX_BYTES) {
			return Response.json({ error: "File too large (max 10 MB)" }, { status: 413 });
		}
		if (!request.body) {
			return Response.json({ error: "Empty body" }, { status: 400 });
		}

		// Optional query params: ?quality=80&width=800
		const quality = clamp(Number(url.searchParams.get("quality") ?? 80), 1, 100);
		const width = Number(url.searchParams.get("width") ?? 0);

		try {
			let pipeline = env.IMAGES.input(request.body);
			if (width > 0) {
				pipeline = pipeline.transform({ width: Math.min(width, 4000) });
			}

			const result = await pipeline.output({ format: "image/webp", quality });
			return result.response(); // WebP image with correct headers
		} catch (err) {
			console.error("Conversion failed:", err);
			return Response.json({ error: "Could not convert image" }, { status: 422 });
		}
	},
} satisfies ExportedHandler<Env>;

function clamp(n: number, min: number, max: number): number {
	return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : max;
}