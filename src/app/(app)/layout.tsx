import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <StoreProvider>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
