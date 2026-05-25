import { AppShell } from "@/components/app-shell";

export default function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
