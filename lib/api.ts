import { RuleError } from "./store";

export function errorResponse(e: unknown): Response {
  if (e instanceof RuleError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : String(e);
  console.error(e);
  return Response.json({ error: "INTERNAL", message }, { status: 500 });
}
