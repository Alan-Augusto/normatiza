-- Exporta os catálogos da análise do legado (MySQL), só leitura.
--
-- Rode no banco do legado e exporte o resultado inteiro em JSON (uma lista de
-- objetos, como o cliente SQL já exporta). O arquivo vai para
-- apps/api/prisma/catalogos/legado.json e é carregado por `catalogos:importar`
-- (docs/migracao §7). Rodar de novo, com uma exportação recente, só atualiza.
--
-- Uma consulta só, com as sete tabelas empilhadas, para sair um arquivo só:
--   tabela  qual catálogo
--   id      o id no legado, que vai para legacy_refs
--   pai_id  o capítulo do item de norma, o tipo da origem/consequência/proteção
--   codigo  só no item de norma ("12.38.1")
--   nome    o nome, ou o título do capítulo
--   texto   só no item de norma: o texto da exigência

SELECT 'standard_title' AS tabela, id, NULL AS pai_id, NULL AS codigo, name AS nome, NULL AS texto FROM standard_title
UNION ALL
SELECT 'standard', id, standardTitleId, code, NULL, description FROM standard
UNION ALL
SELECT 'danger_type', id, NULL, NULL, name, NULL FROM danger_type
UNION ALL
SELECT 'danger_origin', id, dangerTypeId, NULL, name, NULL FROM danger_origin
UNION ALL
SELECT 'danger_consequence', id, dangerTypeId, NULL, name, NULL FROM danger_consequence
UNION ALL
SELECT 'security_type', id, NULL, NULL, name, NULL FROM security_type
UNION ALL
SELECT 'security', id, securityTypeId, NULL, name, NULL FROM security
ORDER BY tabela, id;
