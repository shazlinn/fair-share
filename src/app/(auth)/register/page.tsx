import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/register-form";

export default async function RegisterPage() {
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <Card>
      <CardHeader><CardTitle>Create your account</CardTitle><CardDescription>Use at least 12 characters for your password.</CardDescription></CardHeader>
      <CardContent><RegisterForm /></CardContent>
    </Card>
  );
}
