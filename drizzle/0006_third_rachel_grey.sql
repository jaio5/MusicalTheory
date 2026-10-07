CREATE TABLE "metricas_conteo" (
	"dia" date NOT NULL,
	"evento" text NOT NULL,
	"ruta" text DEFAULT '' NOT NULL,
	"cuenta" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "metricas_conteo_dia_evento_ruta_pk" PRIMARY KEY("dia","evento","ruta")
);
--> statement-breakpoint
CREATE TABLE "metricas_dias" (
	"visitante" text NOT NULL,
	"dia" date NOT NULL,
	CONSTRAINT "metricas_dias_visitante_dia_pk" PRIMARY KEY("visitante","dia")
);
--> statement-breakpoint
CREATE TABLE "metricas_visitantes" (
	"visitante" text PRIMARY KEY NOT NULL,
	"primer_dia" date NOT NULL,
	"ultimo_dia" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mayor_de_14_en" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "metricas_dias_dia_idx" ON "metricas_dias" USING btree ("dia");