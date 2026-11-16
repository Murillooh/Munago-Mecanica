-- Fluxo da OS da moto: etapa, pedido do mecânico, linha do tempo e cronômetro da manutenção.
ALTER TABLE "moto_checkins" ADD COLUMN "status" text DEFAULT 'recebida' NOT NULL;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "events" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Registros antigos ganham o primeiro evento (recebida).
UPDATE "moto_checkins" SET "events" = jsonb_build_array(jsonb_build_object(
  'type', 'recebida', 'at', to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'by', "created_by", 'byName', "created_by_name", 'note', "notes"));
