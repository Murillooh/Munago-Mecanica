-- Locatário (dono da moto) na OS: a moto é entregue a ele no fim do fluxo.
ALTER TABLE "moto_checkins" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "customer_phone" text;
