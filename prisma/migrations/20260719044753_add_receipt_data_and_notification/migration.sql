-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RECEIPT_ATTACHED';

-- AlterTable
ALTER TABLE "ReceiptAttachment" ADD COLUMN     "data" BYTEA;
