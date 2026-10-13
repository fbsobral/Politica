-- Resumos mais completos: descarta os curtos já gerados (são refeitos sob demanda)
UPDATE "Article" SET "summary" = NULL, "summaryKind" = NULL, "summaryAt" = NULL WHERE "summaryKind" = 'ai';
