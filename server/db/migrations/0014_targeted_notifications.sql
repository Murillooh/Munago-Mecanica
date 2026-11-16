-- Avisos dirigidos a um setor (permissão) e unidade: passagem de etapa da OS da moto.
ALTER TABLE "notifications" ADD COLUMN "target" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "unit_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "ref_id" text;
