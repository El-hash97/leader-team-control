import { one } from "@/lib/server/db";

// Vercel Cron replacement for the old Supabase pg_cron jobs (Neon's compute sleeps, so in-DB cron is unreliable).
// The rules (workday, holiday, which shift week) live in the DB function auto_fill_hadir, unchanged.
export async function GET(req: Request, ctx: RouteContext<"/api/cron/auto-hadir/[shift]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { shift } = await ctx.params;
  if (shift !== "pagi" && shift !== "malam") return new Response("Not found", { status: 404 });
  const r = await one<{ n: number }>("select auto_fill_hadir($1) as n", [shift]);
  return Response.json({ shift, inserted: r?.n ?? 0 });
}
