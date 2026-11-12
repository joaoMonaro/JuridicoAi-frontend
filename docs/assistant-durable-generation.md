# Geração durável e minutas por seções

Implementação de 2026-11-12. Usa a capacidade opcional `suportaGeracaoDuravel` e os
contratos do chat v2. A flag correspondente no backend permanece desativada.

O envio salva o pedido e encerra o SSE com `solicitacao.enfileirada`, cujo corpo
traz a geração persistida. Esse evento é terminal para o transporte, mas não
conclui a resposta nem aplica o documento. O chat recupera `geracaoId` nas
mensagens, consulta `GET .../geracoes/{id}` e continua acompanhando após reload.

O painel mostra o estado, a contagem de seções e o plano expansível. Pode mostrar
a análise documental delegada, com suas lacunas de extração. Documentos ainda em
processamento podem acompanhar um pedido quando a capacidade durável estiver
ativa; o backend aguarda a extração antes de usar o modelo. O conjunto de fontes
fica fixado no aceite.

Há cancelamento e retomada explícita. Retomar usa o mesmo pedido e os checkpoints,
podendo consumir novamente a etapa sem conclusão confirmada. A conversa só abre a
comparação depois de receber uma proposta completa. Fechar a tela não cancela o
worker; a revisão visual continua sendo a única aprovação que altera a Peça.

Contratos:

- `solicitacao.enfileirada`: `id`, `estado`, `secoesConcluidas`, `secoesTotal`,
  `secoes`, `codigoErro`, `analiseId`.
- `GET /assistente/v2/conversas/{conversaId}/geracoes/{id}`: o mesmo DTO.
- `POST .../cancelamento`: 204; `POST .../retomada`: 202.
- Mensagem: `geracaoId` e `AguardandoGeracao`/`Gerando`, além dos estados terminais
  existentes. `Gerando` com geração persistida continua representando o pedido em
  segundo plano, inclusive após reabrir a tela.

Verificações: 127 testes unitários, build e lint aprovados; 25 testes focados de
Playwright aprovados, incluindo reabertura durante redação, plano/progresso,
retomada/cancelamento e aprovação apenas da proposta final. O fluxo anterior sem
a nova flag também está nessa seleção. A avaliação com modelo real segue pendente.

A evidência HTTP/DB, os limites e os detalhes de persistência estão no backend em
`implementacoes/features/assistente-conversacional/evidencias/e2-e3-geracao-duravel-2026-11-12.md`.
OCR continua em stand by.
