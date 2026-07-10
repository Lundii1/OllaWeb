"use client";

import { Suspense } from "react";
import { AppShell } from "../components/app-shell";
import { FinanceWorkspace } from "./finance-workspace";

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Loading finance workspace…
          </div>
        </AppShell>
      }
    >
      <FinanceWorkspace />
    </Suspense>
  );
}
