-- Acesso por perfil e por unidade (Base/CD).
CREATE TABLE "units" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'base' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_kind_ck" CHECK ("kind" IN ('base', 'cd'))
);
--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "units_workspace_name_uq" ON "units" USING btree ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "unit_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD COLUMN "unit_id" text;--> statement-breakpoint
ALTER TABLE "moto_checkins" ADD CONSTRAINT "moto_checkins_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER units_notify_change AFTER INSERT OR UPDATE OR DELETE ON units FOR EACH ROW EXECUTE FUNCTION notify_change('units', 'workspace_id');
