# Assistente — estado atual do frontend

Conferência documental em **2026-11-12**, baseline frontend `50aa439` e backend
`4547485` com ajuste local do setup de avaliação. Esta página orienta a leitura dos
registros por etapa; não representa novo build, homologação ou deploy.

## Integrado ao produto atrás de capacidades

- Revisão no editor real, aprovação/rejeição por grupo ou lote, recibo do servidor,
  coordenação com autosave e recuperação de propostas persistidas.
- Conversa livre, perguntas/respostas salvas e contexto automático da Peça/histórico.
- Upload privado, extração nativa, fontes autorizadas do Caso e sinalização de qualidade.
- Memória versionada e recuperação de mensagens antigas.
- Análise documental durável e [geração por seções](assistant-durable-generation.md),
  com progresso, consulta de jobs, cancelamento/retomada e resultado após reload.
- [Histórico pessoal](assistant-personal-history.md) fora do guard organizacional,
  leitura/download privados e exclusão autorizada com protocolo.

O frontend usa as capacidades da API. As flags novas permanecem falsas por padrão
no backend. Histórico pessoal e exclusões aceitas não dependem de geração ativa.
OCR continua desligado e em espera.

## Evidências e limites

A última rodada registrada do frontend teve **133 testes unitários**, build/lint
aprovados e **30 cenários focados de Playwright**. A suíte E2E inteira, a matriz
ampliada de schema/exportação/acessibilidade e o piloto não estão homologados.
Contagens menores nos documentos de etapas anteriores não são o total atual.

A avaliação real reduzida de GPT-6.1 Terra exercitou API/worker/PostgreSQL, com
quatro cenários/seis interações tecnicamente aprovadas e custo de US$ 0,04549805.
Não executou o navegador, não valida a apresentação dos alertas nem substitui
revisão jurídica. Consulta simples levou 63,941 s e está em investigação pendente.

## Referências de andamento

- [Estado consolidado no backend](../../JuridicoAi/implementacoes/features/assistente-conversacional/estado-atual.md).
- [TODO da feature e melhorias](../../JuridicoAi/implementacoes/features/assistente-conversacional/TODO.md).
- [Contratos implementados](../../JuridicoAi/implementacoes/features/assistente-conversacional/especificacoes/07-contratos-implementados.md).
- [Avaliação real e limitações](../../JuridicoAi/implementacoes/features/assistente-conversacional/evidencias/avaliacao-reduzida-gpt-6.1-terra-2026-11-12.md).

Os links entre repositórios pressupõem o checkout irmão `../JuridicoAi`. Os
registros `assistant-*.md` preservam o contrato e os resultados da etapa nomeada;
itens chamados de pendentes nesses registros podem ter sido entregues depois.
Para pendências atuais, usar o TODO acima.
