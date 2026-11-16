-- Prazo da manutenção: tempo estimado pelo mecânico no diagnóstico.
ALTER TABLE "moto_checkins" ADD COLUMN "estimated_minutes" integer;
