import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinorUnits } from "@/domain/money/minor-units";
import { DeleteExpenseButton } from "@/features/expenses/delete-expense-button";
import { CommentForm, DeleteCommentButton } from "@/features/comments/comment-form";
import { DeleteReceiptButton, ReceiptUploadForm } from "@/features/receipts/receipt-controls";
import { requireActiveMembership } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export default async function ExpensePage({ params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const { groupId, expenseId } = await params;
  const context = await requireActiveMembership(groupId).catch(() => null);
  if (!context) notFound();
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId, status: "ACTIVE" },
    include: {
      createdBy: { select: { name: true, email: true } },
      payers: { include: { member: { include: { user: { select: { name: true, email: true } } } } }, orderBy: { userId: "asc" } },
      splits: { include: { participant: { include: { user: { select: { name: true, email: true } } } } }, orderBy: { userId: "asc" } },
      comments: { where: { deletedAt: null }, include: { author: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      attachments: { where: { status: "READY" }, select: { id: true, fileName: true, contentType: true, sizeBytes: true, uploadedById: true, createdAt: true, uploadedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!expense) notFound();
  const canManage = context.group.status === "ACTIVE" && (context.membership.role === "OWNER" || expense.createdById === context.user.id);
  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><Button variant="link" asChild className="h-auto p-0"><Link href={`/groups/${groupId}`}>← Back to group</Link></Button><div className="mt-3 flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{expense.description}</h1><Badge variant="outline">{expense.splitMethod.toLowerCase()}</Badge></div><p className="mt-2 text-muted-foreground">{expense.currency} {formatMinorUnits(expense.amountMinor)} · {expense.expenseDate.toLocaleDateString("en-MY", { timeZone: "UTC" })}</p></div>{canManage ? <div className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link href={`/groups/${groupId}/expenses/${expenseId}/edit`}>Edit expense</Link></Button><DeleteExpenseButton groupId={groupId} expenseId={expense.id} version={expense.version} /></div> : null}</header>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Paid by</CardTitle><CardDescription>Payer amounts total exactly {expense.currency} {formatMinorUnits(expense.amountMinor)}.</CardDescription></CardHeader><CardContent className="space-y-3">{expense.payers.map((payer) => <div key={payer.id} className="flex justify-between gap-4 border-b pb-3 last:border-0"><span>{payer.member.user.name || payer.member.user.email}</span><strong className="tabular-nums">{expense.currency} {formatMinorUnits(payer.amountMinor)}</strong></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Participant shares</CardTitle><CardDescription>Server-calculated using the {expense.splitMethod.toLowerCase()} method.</CardDescription></CardHeader><CardContent className="space-y-3">{expense.splits.map((split) => <div key={split.id} className="flex justify-between gap-4 border-b pb-3 last:border-0"><div><span>{split.participant.user.name || split.participant.user.email}</span>{split.percentageBasisPoints !== null ? <span className="ml-2 text-xs text-muted-foreground">{(split.percentageBasisPoints / 100).toFixed(2)}%</span> : null}{split.shareUnits !== null ? <span className="ml-2 text-xs text-muted-foreground">{split.shareUnits.toString()} shares</span> : null}</div><strong className="tabular-nums">{expense.currency} {formatMinorUnits(split.amountMinor)}</strong></div>)}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">Created by:</span> {expense.createdBy.name || expense.createdBy.email}</p><p><span className="text-muted-foreground">Notes:</span> {expense.notes || "No notes"}</p><p><span className="text-muted-foreground">Version:</span> {expense.version}</p></CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Comments</CardTitle><CardDescription>Keep expense-specific decisions and context with the transaction.</CardDescription></CardHeader><CardContent className="space-y-5">{expense.comments.length ? <div className="space-y-4">{expense.comments.map((comment) => {
        const canDelete = context.group.status === "ACTIVE" && (context.membership.role === "OWNER" || comment.authorId === context.user.id);
        return <div key={comment.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{comment.author.name || comment.author.email}</p><time className="text-xs text-muted-foreground">{comment.createdAt.toLocaleString("en-MY")}</time></div>{canDelete ? <DeleteCommentButton groupId={groupId} expenseId={expenseId} commentId={comment.id} /> : null}</div><p className="mt-3 whitespace-pre-wrap text-sm">{comment.body}</p></div>;
      })}</div> : <p className="text-sm text-muted-foreground">No comments yet.</p>}{context.group.status === "ACTIVE" ? <CommentForm groupId={groupId} expenseId={expenseId} /> : null}</CardContent></Card>
      <Card><CardHeader><CardTitle>Receipts</CardTitle><CardDescription>Authenticated group members can download stored receipt files.</CardDescription></CardHeader><CardContent className="space-y-5">{expense.attachments.length ? <div className="space-y-3">{expense.attachments.map((attachment) => {
        const canDelete = context.group.status === "ACTIVE" && (context.membership.role === "OWNER" || attachment.uploadedById === context.user.id);
        return <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><Button variant="link" className="h-auto max-w-full justify-start truncate p-0" asChild><a href={`/api/attachments/${attachment.id}`}>{attachment.fileName}</a></Button><p className="text-xs text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(1)} KB · uploaded by {attachment.uploadedBy.name || attachment.uploadedBy.email}</p></div>{canDelete ? <DeleteReceiptButton groupId={groupId} expenseId={expenseId} attachmentId={attachment.id} /> : null}</div>;
      })}</div> : <p className="text-sm text-muted-foreground">No receipts attached.</p>}{context.group.status === "ACTIVE" ? <ReceiptUploadForm groupId={groupId} expenseId={expenseId} /> : null}</CardContent></Card>
    </div>
  </div>;
}
