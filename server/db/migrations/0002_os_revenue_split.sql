ALTER TABLE "service_orders" ADD COLUMN "company_share_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "company_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "workshop_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "os_paid_idx" ON "service_orders" USING btree ("paid_at");