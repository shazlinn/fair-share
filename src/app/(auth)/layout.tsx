import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-xl font-semibold text-emerald-800">
          FairShare
        </Link>
        {children}
      </div>
    </main>
  );
}
