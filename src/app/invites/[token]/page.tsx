import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInvitationButton } from "@/features/invitations/accept-invitation-button";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/invites/${token}`)}`);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Join a FairShare group</CardTitle><CardDescription>You’re signed in as {session.user.email}. The server will verify this invitation before adding you.</CardDescription></CardHeader>
        <CardContent className="space-y-4"><AcceptInvitationButton token={token} /><ButtonLink /></CardContent>
      </Card>
    </main>
  );
}

function ButtonLink() {
  return <Link href="/dashboard" className="block text-center text-sm text-muted-foreground hover:underline">Return to dashboard</Link>;
}
