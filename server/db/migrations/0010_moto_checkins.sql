-- Check-list de recebimento da moto (fotos de todos os lados, km e observações).
CREATE TABLE "moto_checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"plate" text NOT NULL,
	"model" text NOT NULL,
	"unit" text,
	"km" integer NOT NULL,
	"photos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD CONSTRAINT "moto_checkins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moto_checkins_workspace_idx" ON "moto_checkins" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE TRIGGER moto_checkins_notify_change AFTER INSERT OR UPDATE OR DELETE ON moto_checkins FOR EACH ROW EXECUTE FUNCTION notify_change('motoCheckins', 'workspace_id');
