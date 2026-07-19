ALTER TABLE "ReceiptAttachment"
    ADD CONSTRAINT "ReceiptAttachment_data_state_check" CHECK (
        ("status" = 'READY' AND "data" IS NOT NULL AND "deletedAt" IS NULL)
        OR ("status" IN ('PENDING', 'FAILED') AND "data" IS NULL AND "deletedAt" IS NULL)
        OR ("status" = 'DELETED' AND "data" IS NULL AND "deletedAt" IS NOT NULL)
    );
