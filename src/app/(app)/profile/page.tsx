import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/features/profiles/profile-form";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  return <div className="mx-auto max-w-xl"><Card><CardHeader><CardTitle>Your profile</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader><CardContent><ProfileForm name={user.name ?? ""} image={user.image ?? ""} /></CardContent></Card></div>;
}
