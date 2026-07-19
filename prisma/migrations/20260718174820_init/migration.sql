-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "SplitMethod" AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('RECORDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GROUP_INVITE', 'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'SETTLEMENT_RECORDED', 'SETTLEMENT_VOIDED', 'COMMENT_ADDED');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_ARCHIVED', 'GROUP_RESTORED', 'MEMBER_JOINED', 'MEMBER_REMOVED', 'INVITE_CREATED', 'INVITE_REVOKED', 'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'SETTLEMENT_RECORDED', 'SETTLEMENT_VOIDED', 'COMMENT_CREATED', 'COMMENT_DELETED', 'RECEIPT_ATTACHED', 'RECEIPT_DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'MYR',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvitationRedemption" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupInvitationRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "splitMethod" "SplitMethod" NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayer" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "ExpensePayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSplit" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "percentageBasisPoints" INTEGER,
    "shareUnits" BIGINT,

    CONSTRAINT "ExpenseSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "memo" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'RECORDED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseComment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAttachment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReceiptAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "ActivityAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Group_createdById_idx" ON "Group"("createdById");

-- CreateIndex
CREATE INDEX "Group_status_idx" ON "Group"("status");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_leftAt_idx" ON "GroupMember"("groupId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitation_tokenHash_key" ON "GroupInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "GroupInvitation_groupId_expiresAt_idx" ON "GroupInvitation"("groupId", "expiresAt");

-- CreateIndex
CREATE INDEX "GroupInvitation_createdById_idx" ON "GroupInvitation"("createdById");

-- CreateIndex
CREATE INDEX "GroupInvitationRedemption_userId_idx" ON "GroupInvitationRedemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitationRedemption_invitationId_userId_key" ON "GroupInvitationRedemption"("invitationId", "userId");

-- CreateIndex
CREATE INDEX "Expense_groupId_status_expenseDate_idx" ON "Expense"("groupId", "status", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_id_groupId_key" ON "Expense"("id", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_groupId_idempotencyKey_key" ON "Expense"("groupId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ExpensePayer_groupId_userId_idx" ON "ExpensePayer"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayer_expenseId_userId_key" ON "ExpensePayer"("expenseId", "userId");

-- CreateIndex
CREATE INDEX "ExpenseSplit_groupId_userId_idx" ON "ExpenseSplit"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSplit_expenseId_userId_key" ON "ExpenseSplit"("expenseId", "userId");

-- CreateIndex
CREATE INDEX "Settlement_groupId_status_settledAt_idx" ON "Settlement"("groupId", "status", "settledAt");

-- CreateIndex
CREATE INDEX "Settlement_fromUserId_idx" ON "Settlement"("fromUserId");

-- CreateIndex
CREATE INDEX "Settlement_toUserId_idx" ON "Settlement"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_groupId_idempotencyKey_key" ON "Settlement"("groupId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ExpenseComment_expenseId_createdAt_idx" ON "ExpenseComment"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseComment_groupId_authorId_idx" ON "ExpenseComment"("groupId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAttachment_storageKey_key" ON "ReceiptAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ReceiptAttachment_expenseId_status_idx" ON "ReceiptAttachment"("expenseId", "status");

-- CreateIndex
CREATE INDEX "ReceiptAttachment_groupId_idx" ON "ReceiptAttachment"("groupId");

-- CreateIndex
CREATE INDEX "ActivityLog_groupId_createdAt_idx" ON "ActivityLog"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_groupId_idx" ON "Notification"("groupId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitationRedemption" ADD CONSTRAINT "GroupInvitationRedemption_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "GroupInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitationRedemption" ADD CONSTRAINT "GroupInvitationRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_expenseId_groupId_fkey" FOREIGN KEY ("expenseId", "groupId") REFERENCES "Expense"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_groupId_userId_fkey" FOREIGN KEY ("groupId", "userId") REFERENCES "GroupMember"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_expenseId_groupId_fkey" FOREIGN KEY ("expenseId", "groupId") REFERENCES "Expense"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_groupId_userId_fkey" FOREIGN KEY ("groupId", "userId") REFERENCES "GroupMember"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fromUserId_fkey" FOREIGN KEY ("groupId", "fromUserId") REFERENCES "GroupMember"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_toUserId_fkey" FOREIGN KEY ("groupId", "toUserId") REFERENCES "GroupMember"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_expenseId_groupId_fkey" FOREIGN KEY ("expenseId", "groupId") REFERENCES "Expense"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_groupId_authorId_fkey" FOREIGN KEY ("groupId", "authorId") REFERENCES "GroupMember"("groupId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAttachment" ADD CONSTRAINT "ReceiptAttachment_expenseId_groupId_fkey" FOREIGN KEY ("expenseId", "groupId") REFERENCES "Expense"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAttachment" ADD CONSTRAINT "ReceiptAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Financial and lifecycle checks that Prisma's schema language cannot express.
ALTER TABLE "Group"
    ADD CONSTRAINT "Group_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "Group_archive_state_check" CHECK (
        ("status" = 'ACTIVE' AND "archivedAt" IS NULL)
        OR ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
    );

ALTER TABLE "GroupInvitation"
    ADD CONSTRAINT "GroupInvitation_member_role_check" CHECK ("role" = 'MEMBER'),
    ADD CONSTRAINT "GroupInvitation_use_count_check" CHECK (
        "maxUses" > 0 AND "useCount" >= 0 AND "useCount" <= "maxUses"
    );

ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_amount_check" CHECK ("amountMinor" > 0),
    ADD CONSTRAINT "Expense_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "Expense_version_check" CHECK ("version" > 0),
    ADD CONSTRAINT "Expense_deletion_state_check" CHECK (
        ("status" = 'ACTIVE' AND "deletedAt" IS NULL AND "deletedById" IS NULL)
        OR ("status" = 'DELETED' AND "deletedAt" IS NOT NULL AND "deletedById" IS NOT NULL)
    );

ALTER TABLE "ExpensePayer"
    ADD CONSTRAINT "ExpensePayer_amount_check" CHECK ("amountMinor" > 0);

ALTER TABLE "ExpenseSplit"
    ADD CONSTRAINT "ExpenseSplit_amount_check" CHECK ("amountMinor" >= 0),
    ADD CONSTRAINT "ExpenseSplit_percentage_check" CHECK (
        "percentageBasisPoints" IS NULL
        OR "percentageBasisPoints" BETWEEN 0 AND 10000
    ),
    ADD CONSTRAINT "ExpenseSplit_share_units_check" CHECK (
        "shareUnits" IS NULL OR "shareUnits" >= 0
    );

ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_amount_check" CHECK ("amountMinor" > 0),
    ADD CONSTRAINT "Settlement_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "Settlement_parties_check" CHECK ("fromUserId" <> "toUserId"),
    ADD CONSTRAINT "Settlement_version_check" CHECK ("version" > 0),
    ADD CONSTRAINT "Settlement_void_state_check" CHECK (
        ("status" = 'RECORDED' AND "voidedAt" IS NULL)
        OR ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL)
    );

ALTER TABLE "ReceiptAttachment"
    ADD CONSTRAINT "ReceiptAttachment_size_check" CHECK ("sizeBytes" > 0);

-- This guarantees at most one active owner. Application transactions additionally
-- guarantee that a group never has zero active owners during ownership changes.
CREATE UNIQUE INDEX "GroupMember_one_active_owner_idx"
    ON "GroupMember" ("groupId")
    WHERE "role" = 'OWNER' AND "leftAt" IS NULL;
