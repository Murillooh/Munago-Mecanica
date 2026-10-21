-- Catálogo de serviços da mecânica: preço e repasse para a empresa (R$ fixo ou % do preço).
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"repasse_type" text DEFAULT 'fixed' NOT NULL,
	"repasse_value" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_repasse_type_ck" CHECK ("repasse_type" IN ('fixed', 'percent'))
);
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_workspace_idx" ON "services" USING btree ("workspace_id","name");--> statement-breakpoint
-- Serviços da OS congelados na criação; repasse_amount = soma dos repasses (vai para a empresa no pagamento).
ALTER TABLE "service_orders" ADD COLUMN "service_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "repasse_amount" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TRIGGER services_notify_change AFTER INSERT OR UPDATE OR DELETE ON services FOR EACH STATEMENT EXECUTE FUNCTION notify_change('services');
