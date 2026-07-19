"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("FairShare route error", error); }, [error]);
  return <div role="alert" className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center"><h1 className="text-xl font-semibold">We couldn’t load this page</h1><p className="mt-2 text-sm text-muted-foreground">Your data was not changed. Try the request again.</p><Button className="mt-5" onClick={reset}>Try again</Button></div>;
}
