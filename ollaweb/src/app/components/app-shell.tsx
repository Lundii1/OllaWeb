"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppNav, type NavPage } from "./app-nav";
import { Meteors, type MeteorsProps } from "./meteors";

export function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-[18px] transition-transform", !collapsed && "rotate-180")}
      aria-hidden="true"
    >
      <path
        d="M6 2V14M5.2 2H10.8C11.9201 2 12.4802 2 12.908 2.21799C13.2843 2.40973 13.5903 2.71569 13.782 3.09202C14 3.51984 14 4.0799 14 5.2V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V5.2C2 4.07989 2 3.51984 2.21799 3.09202C2.40973 2.71569 2.71569 2.40973 3.09202 2.21799C3.51984 2 4.0799 2 5.2 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.33"
      />
    </svg>
  );
}

interface AppShellProps extends Omit<MeteorsProps, "children"> {
  children: ReactNode;
  contentClassName?: string;
}

export function AppShell({ children, contentClassName, ...meteorProps }: AppShellProps) {
  return (
    <Meteors {...meteorProps}>
      <div className={cn("flex h-full min-w-0 text-foreground", contentClassName)}>
        {children}
      </div>
    </Meteors>
  );
}

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  top?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  currentPage?: NavPage;
  expandedLabel?: string;
  collapsedLabel?: string;
  className?: string;
  bodyClassName?: string;
}

export function AppSidebar({
  open,
  onOpenChange,
  top,
  children,
  footer,
  currentPage,
  expandedLabel = "Hide sidebar",
  collapsedLabel = "Show sidebar",
  className,
  bodyClassName,
}: AppSidebarProps) {
  if (!open) {
    return (
      <aside
        className={cn(
          "flex w-12 shrink-0 flex-col items-center border-r border-white/10 bg-black/60 backdrop-blur-md",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={collapsedLabel}
          title={collapsedLabel}
          className="mt-3 inline-flex size-9 items-center justify-center rounded-lg border border-white/10 text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <SidebarToggleIcon collapsed />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-white/10 bg-black/60 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <div className="min-w-0 flex-1">{top}</div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={expandedLabel}
          title={expandedLabel}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <SidebarToggleIcon collapsed={false} />
        </button>
      </div>
      <div className={cn("flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
      {(footer || currentPage) && (
        <div className="border-t border-white/10 p-3">
          {footer ?? <AppNav current={currentPage!} />}
        </div>
      )}
    </aside>
  );
}

export function AppMain({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", className)} {...props} />;
}

export function VoltaireBrand({ className }: { className?: string }) {
  return (
    <h1
      className={cn("flex items-center gap-1 text-lg font-semibold tracking-normal", className)}
      aria-label="voltaire"
    >
      <span className="text-white/35">[</span>
      <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(34,211,238,0.28)]">
        voltaire
      </span>
      <span className="text-white/35">]</span>
    </h1>
  );
}

interface AppHeaderProps {
  brand?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AppHeader({
  brand,
  actions,
  children,
  className,
  contentClassName,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "z-10 shrink-0 border-b border-white/10 bg-black/40 backdrop-blur-sm",
        className,
      )}
    >
      <div className={cn("flex items-center justify-between gap-4 px-4 py-2", contentClassName)}>
        {children ?? (
          <>
            {brand ?? <VoltaireBrand />}
            {actions}
          </>
        )}
      </div>
    </header>
  );
}

interface StatusToastProps {
  children: ReactNode;
  visible?: boolean;
  className?: string;
  live?: "off" | "polite" | "assertive";
}

export function StatusToast({
  children,
  visible = true,
  className,
  live = "polite",
}: StatusToastProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live={live}
      className={cn(
        "fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-4 py-2 text-muted-foreground shadow-lg backdrop-blur-md",
        className,
      )}
    >
      <div className="whitespace-pre-wrap text-sm text-inherit">{children}</div>
    </div>
  );
}

interface AppFooterProps extends HTMLAttributes<HTMLElement> {
  contentClassName?: string;
}

export function AppFooter({ children, className, contentClassName, ...props }: AppFooterProps) {
  return (
    <footer
      className={cn("shrink-0 border-t border-white/10 bg-black/40 backdrop-blur-sm", className)}
      {...props}
    >
      <div className={cn("mx-auto max-w-3xl p-3", contentClassName)}>{children}</div>
    </footer>
  );
}
