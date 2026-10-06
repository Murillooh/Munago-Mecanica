CREATE TYPE "public"."access_req_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."os_status" AS ENUM('draft', 'in_progress', 'completed', 'paid');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('ativo', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."tx_type" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"workshop_name" text NOT NULL,
	"phone" text,
	"message" text,
	"status" "access_req_status" DEFAULT 'pending' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"query" text NOT NULL,
	"response" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" text PRIMARY KEY NOT NULL,
	"product_count" integer NOT NULL,
	"transaction_count" integer NOT NULL,
	"category_count" integer NOT NULL,
	"service_order_count" integer NOT NULL,
	"data" jsonb NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"ai_suggestion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"product_id" text,
	"type" text DEFAULT 'low_stock' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"price" numeric(12, 2),
	"labor_cost" numeric(12, 2),
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"status" "product_status" DEFAULT 'ativo' NOT NULL,
	"image_url" text,
	"observation" text,
	"expiration_date" text,
	"batch" text,
	"supplier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"vehicle_model" text,
	"vehicle_plate" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"general_labor_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_labor_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_parts_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" "os_status" DEFAULT 'draft' NOT NULL,
	"scheduled_date" text NOT NULL,
	"completion_date" text,
	"observations" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"type" "tx_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'viewer' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"permissions" jsonb,
	"photo_url" text,
	"legacy_firebase_uid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_user_idx" ON "ai_searches" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_uq" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "notif_unread_idx" ON "notifications" USING btree ("product_id","read","type");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "os_created_idx" ON "service_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tx_timestamp_idx" ON "transactions" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "tx_product_idx" ON "transactions" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");