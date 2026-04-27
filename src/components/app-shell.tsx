import Link from "next/link";
import { Activity, Gauge, ListChecks, Send, Settings, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Dash", icon: Gauge },
  { href: "/signals", label: "Signals", mobileLabel: "Signals", icon: Activity },
  { href: "/test-signal", label: "Test Signal", mobileLabel: "Test", icon: Send },
  { href: "/orders", label: "Orders", mobileLabel: "Orders", icon: ListChecks },
  { href: "/manual-approval", label: "Approval", mobileLabel: "Approve", icon: ShieldCheck },
  { href: "/settings", label: "Settings", mobileLabel: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-20 border-r bg-card px-3 py-4 md:block xl:hidden">
        <div className="mb-5 flex h-10 items-center justify-center rounded-md border text-sm font-semibold">SC</div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="flex h-11 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              <span className="sr-only">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card px-4 py-5 xl:block">
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">Trade Console</p>
          <h1 className="mt-1 text-xl font-semibold tracking-normal">Signal Control</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="md:pl-20 xl:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:h-16 md:px-6 xl:px-8">
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold sm:text-base">Signal Control</span>
            <span className="hidden text-xs text-muted-foreground sm:block">Demo automation console</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl px-3 py-4 pb-24 sm:px-4 sm:py-6 md:px-6 md:pb-8 xl:px-8">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 gap-1 border-t bg-background/95 px-2 py-2 backdrop-blur md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="w-full truncate text-center leading-none">{item.mobileLabel}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
