import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";

export default function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
