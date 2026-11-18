# Assistente — estado atual do frontend

Conferência documental em **2026-11-12**, baseline frontend `50aa439` e backend
`4547485` com ajuste local do setup de avaliação. Esta página orienta a leitura dos
registros por etapa. As atualizações de 2026-11-17 e 2026-11-18 estão abaixo;
não representam homologação jurídica ou deploy.

## Limite mensal — 2026-11-18

O painel consulta `GET /assistente/limite-mensal` com a sessão organizacional e
exibe somente percentuais de limite utilizado, reservado em andamento e
disponível. A interface usa o termo **limite mensal**, com alertas de 70% e 90%
e mensagens de insuficiência ou limite atingido. As reservas descontam a
disponibilidade, sem serem apresentadas como consumo já confirmado.

A consulta é atualizada ao abrir o painel, após conclusão/falha de interações,
enquanto há processamento ou reservas em andamento, ao recuperar foco e na
virada do mês calendário UTC. O fechamento cancela consultas e temporizadores;
respostas lentas são aguardadas antes do próximo polling. Estados bloqueados
também oferecem atualização manual.

O bloqueio de novas chamadas preserva o pedido digitado, histórico e propostas,
edição manual e exportação. Erro de consulta ou configuração indisponível é
informado sem apresentar um consumo fictício de 0%. A autorização de cada
chamada e o saldo são verificados pelo backend, inclusive entre instâncias.
Tarifas reais do modelo e configuração do ambiente continuam necessárias para
liberar chamadas reais. Ver [implementação, operação e evidências de P03](../../JuridicoAi/implementacoes/features/assistente-conversacional/evidencias/p03-limite-mensal-2026-11-18.md).

## Ajuste do painel — 2026-11-17

O painel usa uma única caixa de mensagem e anexos privados. Foram retirados os
atalhos de prompts, modos, escolha de escopo, inclusão manual de dados/contextos
cadastrados, campo separado de informação adicional e ação Desenvolver. Antes do
envio, a Peça é sincronizada; falha ou edição concorrente preserva o pedido e
impede geração com contexto desatualizado. O servidor considera a Peça salva,
conversa e anexos vinculados. Materiais antigos do Caso só são consultados por
pedido expresso na conversa; não integram a lista automática de anexos.

A seleção do editor está pausada: nenhum trecho ou cursor é anexado ao novo
pedido, inclusive em reenvios de mensagens históricas. A decisão futura está em
[PROJ-006 no TODO da raiz](../TODO.md). Pedidos podem descrever um trecho em
linguagem natural. Histórico e propostas anteriores continuam consultáveis, com
aprovação/rejeição e proteções de versão preservadas.

Conversa natural é o padrão do backend; não existe mais a configuração
`AutomaticConversationEnabled`. A capacidade `suportaConversaLivre` continua
informando disponibilidade/compatibilidade da API. Quando indisponível, o painel
mostra aviso geral do assistente e mantém o histórico consultável, sem reativar
modos e ações do fluxo anterior.
As especificações e evidências antigas abaixo preservam seus recortes históricos.

Verificação deste ajuste: **134 testes unitários/componentes** em 16 arquivos,
lint e build aprovados; **56 cenários de Playwright do assistente** aprovados
na rodada combinada `assistant*.spec.ts`.
Incluem a ausência dos atalhos/configurações, ausência de seleção/cursor no envio e no
reenvio histórico, foco após carregar o histórico sem refocar em atualizações,
falha/concorrência no salvamento, anexos privados, exclusão de
materiais antigos do Caso da lista automática, propostas anteriores e aprovação,
teclado, permissões, transparência, retomada/cancelamento e conflitos de salvamento.
O provedor nesses testes é simulado; não há avaliação semântica com modelo real.
O aviso anterior de bundle maior que 500 kB permanece.

Após a retirada da flag separada de conversa livre no backend, passaram novamente
os 134 unitários, lint/build e seis E2Es de disponibilidade/permissões. O aviso
de indisponibilidade é geral do assistente, sem indicar configuração de modo.

O transporte do painel foi simplificado para `streamAssistantInteraction`:
conversa identificada obrigatória e envio exclusivo a `/interacoes`, com
`clientRequestId`, `texto`, `versaoPecaEsperada`, referência opcional de proposta
e anexos. O painel não monta mais um pedido de modo/escopo para convertê-lo
depois. Campos antigos de contexto e seleção não são enviados. O formato
`AssistantRequest` permanece apenas para ler pedidos persistidos; streaming,
cancelamento e leitura de históricos/propostas continuam preservados. O helper
`captureEditorContext` permanece para revisão futura em PROJ-006.

Verificação da limpeza de transporte: **136 unitários**, lint/build e **56 E2Es
do assistente** aprovados. A rodada também conferiu reenvio histórico, anexos,
referência de proposta, streaming, cancelamento e reabertura após análise.
Respostas de consultas de disponibilidade canceladas ou substituídas passaram a
ser ignoradas, preservando o estado de uma consulta mais recente.

## Integrado ao produto atrás de capacidades

- Revisão no editor real, aprovação/rejeição por grupo ou lote, recibo do servidor,
  coordenação com autosave e recuperação de propostas persistidas.
- Conversa livre, perguntas/respostas salvas e contexto automático da Peça/histórico.
- Limite mensal em percentuais, reservas em andamento e bloqueio de novas chamadas
  com preservação do trabalho e das funções de edição/exportação.
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

A rodada anterior registrada do frontend teve **133 testes unitários**, build/lint
aprovados e **30 cenários focados de Playwright**. A rodada técnica de P03 em 2026-11-18 passou com **150 testes unitários em
19 arquivos**, lint/build e a suíte completa de **70 cenários Playwright**. A
matriz ampliada de schema/exportação/acessibilidade e o piloto continuam
pendentes de fechamento; esses testes não substituem a revisão jurídica.
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
