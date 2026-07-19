-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

ALTER TABLE "Group"
    ADD CONSTRAINT "Group_version_check" CHECK ("version" > 0);
