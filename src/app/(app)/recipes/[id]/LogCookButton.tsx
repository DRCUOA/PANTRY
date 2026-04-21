"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logRecipeCook } from "@/actions/recipes";

export function LogCookButton({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLog() {
    setPending(true);
    try {
      const result = await logRecipeCook(recipeId);
      if (result.ok) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void handleLog()}
      className="tap-target rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
    >
      {pending ? "Logging…" : "Log cook"}
    </button>
  );
}
