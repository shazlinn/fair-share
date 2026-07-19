import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const user = await requireUser().catch(() => null);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const { attachmentId } = await params;
  const metadata = await prisma.receiptAttachment.findFirst({
    where: { id: attachmentId, status: "READY", data: { not: null } },
    select: { id: true, groupId: true },
  });
  if (!metadata) return new NextResponse("Not found", { status: 404 });
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: metadata.groupId, userId: user.id } },
  });
  if (!membership || membership.leftAt) return new NextResponse("Not found", { status: 404 });
  const attachment = await prisma.receiptAttachment.findUnique({
    where: { id: metadata.id },
    select: { data: true, fileName: true, contentType: true, sizeBytes: true },
  });
  if (!attachment?.data) return new NextResponse("Not found", { status: 404 });

  const asciiName = attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(Buffer.from(attachment.data), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": attachment.sizeBytes.toString(),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
