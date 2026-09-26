import { redirect } from "next/navigation";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/shell";
import { isAuthed } from "@/lib/server/session";
import { loadTables } from "@/lib/server/db";
import { toState } from "@/lib/db-map";

// Reads the session cookie and live data on every request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!(await isAuthed())) redirect("/login");
  const initial = toState(await loadTables());
  return (
    <StoreProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
