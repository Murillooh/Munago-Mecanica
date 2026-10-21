-- Cobrança da OS no Asaas (id da cobrança e link da fatura).
ALTER TABLE "service_orders" ADD COLUMN "asaas_payment_id" text;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "payment_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "os_asaas_payment_uq" ON "service_orders" USING btree ("asaas_payment_id");
