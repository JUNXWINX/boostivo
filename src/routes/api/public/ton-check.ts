import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ton-check")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runTonCheck } = await import("@/lib/processing.server");
          const result = await runTonCheck();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[ton-check]", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const { runTonCheck } = await import("@/lib/processing.server");
          const result = await runTonCheck();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
