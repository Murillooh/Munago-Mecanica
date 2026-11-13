-- Tipo de manutenção da OS; OS antigas ficam como corretiva.
ALTER TABLE "service_orders" ADD COLUMN "maintenance_type" text DEFAULT 'corretiva' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_maintenance_type_ck" CHECK ("maintenance_type" IN ('corretiva', 'preventiva'));
