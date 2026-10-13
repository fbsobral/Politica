-- Reabre a classificação das notícias eleitorais para preencher "cargo" e "poll" (o robô reclassifica na próxima coleta).
UPDATE "Article" SET "classified" = false
WHERE "cargo" IS NULL
  AND ("category" = 'ELEICOES' OR "searchText" LIKE '%eleic%' OR "searchText" LIKE '%candidat%' OR "searchText" LIKE '%pesquisa%' OR "searchText" LIKE '%segundo turno%');
