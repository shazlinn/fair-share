import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/features/auth/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  if ((await auth())?.user) redirect("/dashboard");
  const requestedPath = (await searchParams).callbackUrl;
  const redirectTo = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/dashboard";
  return (
    <Card>
      <CardHeader><CardTitle>Welcome back</CardTitle><CardDescription>Sign in to manage your shared expenses.</CardDescription></CardHeader>
      <CardContent><SignInForm redirectTo={redirectTo} /></CardContent>
    </Card>
  );
}
