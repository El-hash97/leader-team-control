import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/shell";

// Mock data depends on today's date (Asia/Jakarta). Render per request so the
// server HTML matches the browser instead of freezing the build date.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <StoreProvider>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
