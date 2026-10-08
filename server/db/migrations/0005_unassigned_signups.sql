-- Cadastros novos ficam aqui (pendentes) até um admin colocá-los numa oficina.
INSERT INTO "workspaces" ("id", "name") VALUES ('unassigned', 'Aguardando oficina') ON CONFLICT ("id") DO NOTHING;
