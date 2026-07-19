import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16 sm:px-10">
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-emerald-700 uppercase">
          FairShare
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Shared expenses, settled fairly.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
          Create private groups, invite members, and keep every sen accounted for with
          deterministic splits and server-enforced access.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/register">Create an account</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/sign-in">Sign in</Link></Button>
        </div>
      </section>
    </main>
  );
}
