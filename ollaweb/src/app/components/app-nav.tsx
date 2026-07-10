import Link from "next/link";

export type NavPage = "chat" | "resume" | "finance";

export interface AppNavProps {
  current: NavPage;
  className?: string;
}

const pages: { key: NavPage; label: string; href: string }[] = [
  { key: "chat", label: "Chat", href: "/" },
  { key: "finance", label: "Finance", href: "/finance" },
  { key: "resume", label: "Resume", href: "/resume" },
];

export function AppNav({ current, className }: AppNavProps) {
  return (
    <nav aria-label="Primary" className={`flex items-center gap-1 ${className ?? ""}`}>
      {pages.map((p) => {
        const itemClassName =
          "rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

        if (p.key === current) {
          return (
            <span
              key={p.key}
              aria-current="page"
              className={`${itemClassName} bg-white/10 text-foreground`}
            >
              {p.label}
            </span>
          );
        }

        return (
          <Link
            key={p.key}
            href={p.href}
            className={`${itemClassName} text-muted-foreground hover:bg-white/5 hover:text-foreground`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
