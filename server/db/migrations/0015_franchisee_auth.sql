-- Franqueado da unidade (quem autoriza as manutenções).
ALTER TABLE "units" ADD COLUMN "franchisee_name" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "franchisee_email" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "franchisee_phone" text;
