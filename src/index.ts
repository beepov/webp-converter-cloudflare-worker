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

const ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"https://webpconverter-nextjs.cheasocheat-km.workers.dev",
];

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
];

function getCorsHeaders(origin: string): Headers {
	return new Headers({
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, X-API-Key",
		"Access-Control-Max-Age": "86400",
		"Vary": "Origin",
	});
}

function corsResponse(response: Response, cors: Headers): Response {
	const headers = new Headers(response.headers);

	cors.forEach((value, key) => headers.set(key, value));

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function jsonError(
	message: string,
	status: number,
	cors: Headers
): Response {
	return corsResponse(
		Response.json({ error: message }, { status }),
		cors
	);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get("Origin");

		// Handle preflight before API authentication.
		if (request.method === "OPTIONS") {
			if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
				return new Response(null, { status: 403 });
			}

			return new Response(null, {
				status: 204,
				headers: getCorsHeaders(origin),
			});
		}

		// Require an allowed browser origin.
		if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
			return new Response("Forbidden", { status: 403 });
		}

		const cors = getCorsHeaders(origin);
		const url = new URL(request.url);

		if (url.pathname !== "/convert") {
			return jsonError("Not found", 404, cors);
		}

		if (request.method !== "POST") {
			return jsonError("Method not allowed", 405, cors);
		}

		// Authenticate.
		const apiKey = request.headers.get("X-API-Key");

		if (!env.API_KEY || !apiKey || apiKey !== env.API_KEY) {
			return jsonError("Unauthorized", 401, cors);
		}

		// Validate content type.
		const contentType = request.headers.get("content-type") ?? "";

		if (!ALLOWED_TYPES.includes(contentType)) {
			return jsonError("Unsupported image type", 415, cors);
		}

		// Validate size.
		const length = Number(request.headers.get("content-length") ?? 0);

		if (length > MAX_BYTES) {
			return jsonError("File too large (max 10 MB)", 413, cors);
		}

		if (!request.body) {
			return jsonError("Empty body", 400, cors);
		}

		const quality = clamp(
			Number(url.searchParams.get("quality") ?? 80),
			1,
			100
		);

		const width = Number(url.searchParams.get("width") ?? 0);

		if (!Number.isFinite(width) || width < 0) {
			return jsonError("Invalid width", 400, cors);
		}

		try {
			let pipeline = env.IMAGES.input(request.body);

			if (width > 0) {
				pipeline = pipeline.transform({
					width: Math.min(Math.floor(width), 4000),
				});
			}

			const result = await pipeline.output({
				format: "image/webp",
				quality,
			});

			return corsResponse(result.response(), cors);
		} catch (err) {
			console.error("Conversion failed:", err);
			return jsonError("Could not convert image", 422, cors);
		}
	},
} satisfies ExportedHandler<Env>;

function clamp(n: number, min: number, max: number): number {
	return Number.isFinite(n)
		? Math.min(Math.max(n, min), max)
		: max;
}
