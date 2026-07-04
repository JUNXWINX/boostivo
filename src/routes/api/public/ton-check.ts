import { createFileRoute } from "@tanstack/react-router";

function checkAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Server misconfigured", { status: 500 });
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  // Length-check first to short-circuit obvious mismatches
  if (provided.length !== secret.length) return new Response("Unauthorized", { status: 401 });
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ provided.charCodeAt(i);
  if (diff !== 0) return new Response("Unauthorized", { status: 401 });
  return null;
}

async function handle(request: Request): Promise<Response> {
  const unauth = checkAuth(request);
  if (unauth) return unauth;
  try {
    const { runTonCheck } = await import("@/lib/processing.server");
    const result = await runTonCheck();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ton-check]", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/ton-check")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
