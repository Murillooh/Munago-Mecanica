-- Multi-oficina: cada oficina (workspace) tem os próprios dados.
-- Tudo o que já existia vai para a oficina 'default' (do admin geral).
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "workspaces" ("id", "name")
VALUES ('default', COALESCE((SELECT "data"->>'storeName' FROM "settings" WHERE "id" = 'global'), 'Munago Mecânica'));
--> statement-breakpoint
UPDATE "settings" SET "id" = 'default' WHERE "id" = 'global';
--> statement-breakpoint
DROP INDEX "categories_name_uq";--> statement-breakpoint
DROP INDEX "products_name_idx";--> statement-breakpoint
DROP INDEX "products_category_idx";--> statement-breakpoint
DROP INDEX "os_created_idx";--> statement-breakpoint
DROP INDEX "tx_timestamp_idx";--> statement-breakpoint
ALTER TABLE "backups" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "backups" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "service_orders" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "workspace_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_workspace_name_uq" ON "categories" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "notif_workspace_idx" ON "notifications" USING btree ("workspace_id","timestamp");--> statement-breakpoint
CREATE INDEX "users_workspace_idx" ON "users" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("workspace_id","category");--> statement-breakpoint
CREATE INDEX "os_created_idx" ON "service_orders" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "tx_timestamp_idx" ON "transactions" USING btree ("workspace_id","timestamp");--> statement-breakpoint
CREATE TRIGGER workspaces_notify_change AFTER INSERT OR UPDATE OR DELETE ON workspaces FOR EACH STATEMENT EXECUTE FUNCTION notify_change('workspaces');
