import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const jsonHeaders = {
  "content-type": "application/json",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function extractToken(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return (req.headers.get("x-ingest-token") ?? "").trim();
}

http.route({
  path: "/python-sdk/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const expectedToken = process.env.PYTHON_INGEST_TOKEN ?? "";
    if (!expectedToken) {
      return jsonResponse(503, {
        ok: false,
        error: "PYTHON_INGEST_TOKEN is not configured.",
      });
    }

    const providedToken = extractToken(req);
    if (!providedToken || providedToken !== expectedToken) {
      return jsonResponse(401, { ok: false, error: "Unauthorized." });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON payload." });
    }

    try {
      const result = await ctx.runMutation(
        internal.pythonSdkIngest.internalIngestPayload,
        { payload }
      );
      return jsonResponse(200, {
        ...(result as Record<string, unknown>),
        ok: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ingestion error.";
      return jsonResponse(400, { ok: false, error: message });
    }
  }),
});

export default http;
