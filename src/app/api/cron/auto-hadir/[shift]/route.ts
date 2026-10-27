import { one } from "@/lib/server/db";

// Called by Vercel Cron (vercel.json). Not pg_cron: Neon's compute sleeps when idle, so in-DB schedules are unreliable.
// The rules (workday, holiday, which shift week) live in the DB function auto_fill_hadir, unchanged.
export async function GET(req: Request, ctx: RouteContext<"/api/cron/auto-hadir/[shift]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { shift } = await ctx.params;
  if (shift !== "pagi" && shift !== "malam") return new Response("Not found", { status: 404 });
  const r = await one<{ n: number }>("select auto_fill_hadir($1) as n", [shift]);
  return Response.json({ shift, inserted: r?.n ?? 0 });
}
