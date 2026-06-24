import Link from "next/link";

export type NavPage = "chat" | "resume" | "finance";

interface AppNavProps {
  current: NavPage;
}

const pages: { key: NavPage; label: string; href: string }[] = [
  { key: "chat", label: "Chat", href: "/" },
  { key: "resume", label: "Resume", href: "/resume" },
  { key: "finance", label: "Finance", href: "/finance" },
];

export function AppNav({ current }: AppNavProps) {
  return (
    <div className="flex items-center gap-1">
      {pages.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            p.key === current
              ? "bg-[#2f2f2f] text-foreground"
              : "text-muted-foreground hover:bg-[#2f2f2f] hover:text-foreground"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
