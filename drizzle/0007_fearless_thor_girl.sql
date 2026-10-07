CREATE TABLE "ai_gasto" (
	"mes" text PRIMARY KEY NOT NULL,
	"micros" bigint DEFAULT 0 NOT NULL,
	"dia" date NOT NULL,
	"dia_micros" bigint DEFAULT 0 NOT NULL,
	"gratis_micros" bigint DEFAULT 0 NOT NULL,
	"gratis_dia_micros" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_uso_heredado" (
	"huella" text NOT NULL,
	"month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_uso_heredado_huella_month_pk" PRIMARY KEY("huella","month")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "impagada_desde" timestamp with time zone;