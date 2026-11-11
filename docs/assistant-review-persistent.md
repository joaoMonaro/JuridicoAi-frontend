# Revisão persistida no editor real

O frontend utiliza esse fluxo quando `GET /assistente/capacidades` retorna
`suportaRevisaoPersistida: true`. O backend requer a migration
`AddAssistantReviewWorkspace`, `AssistenteIa:ReviewV2Enabled=true` e os acessos
`AI_ASSISTANT`/`AI_EDIT`, além dos controles de IA existentes. A flag é desligada
por padrão; não configurar esse comportamento apenas no frontend.

## Experiência

1. Gere uma sugestão de alteração pelo assistente atual. A sugestão continua
   editável antes do registro.
2. Clique em **Revisar no documento**. O autosave conclui pendências e a API salva
   a proposta na conversa individual da Peça. O corpo permanece intacto.
3. Confira o trecho original e a versão proposta no documento. A barra permite
   navegar e aprovar/rejeitar todas; cada grupo possui seus próprios botões.
4. A aprovação é a autorização de aplicação. O editor aguarda o recibo do
   servidor, aplica o resultado correspondente ao preview e adota a nova versão.
5. Propostas pendentes são recuperadas ao reabrir a Peça. **Propostas salvas**
   permite consultar as mais recentes e reabrir pendências compatíveis.

A paginação fica suspensa durante o preview, com indicação de revisão. Destaques
não integram o JSON do documento. Sair da revisão permite editar manualmente;
essa edição invalida a proposta antiga. Desfazer uma aplicação é uma edição
manual normal, salva sobre a versão confirmada.

Se a resposta da aprovação se perder, **Verificar resultado** consulta o recibo.
Se o comando não chegou, repete o mesmo requestId aprovado; não pede uma segunda
aprovação. O corpo e os controles de mutação ficam bloqueados até reconciliar.
Uma versão incompatível exige recarregar ou gerar outra proposta.

## Organização do código

- `review/persistent-api.ts`: DTOs e chamadas de registro, decisão e recibo.
- `review/legacy-proposal.ts`: compila sugestão legada em splice sem modificar o editor.
- `review/use-persistent-review.ts`: reabertura, coordenação com autosave e recuperação.
- `review/extension.ts`: comparação, bloqueio e aplicação conferida contra o recibo.
- `use-peca-autosave.ts`: `ensurePersisted` e adoção de commit externo sem PATCH duplicado.

O adaptador legado publica um grupo único. O backend/plugin também suportam
múltiplos grupos preparados por um produtor confiável. O frontend envia hashes
opacos do servidor ao aprovar; não calcula uma autorização alternativa.

## Validação e limites

- 109 testes unitários/componentes passaram, incluindo desligamento/reativação
  da capacidade sem apagar a proposta ou prender o editor em revisão.
- Oito E2E dos arquivos `assistant-review.spec.ts` e
  `assistant-persistent-review.spec.ts` passaram: preview, reabertura, aprovação,
  resposta perdida, rejeição, desfazer persistido e acessibilidade do exemplo.
- Build e lint passaram. O aviso existente de tamanho do bundle permanece.
- Testes de navegador usam API fake; atomicidade e isolamento foram verificados
  separadamente no backend com PostgreSQL real e por HTTP autenticado.

Com apenas a flag de revisão, o painel continua em memória; pedidos/respostas
associados ao registro de propostas são persistidos e `suportaHistorico` permanece
falsa. A [etapa adicional de conversa](assistant-conversation-history.md) ativa
persistência geral e contexto cronológico. Chat livre, resumos para conversas
extensas, anexos/OCR e área pessoal ainda estão pendentes. O aviso versionado de transparência é
atualizado pelo backend antes da primeira escrita persistida.

A recuperação de uma aplicação incerta usa o requestId em memória do editor.
Após reload, recuperam-se o documento e a proposta atuais do servidor; ainda não
há journal local de intenções. O acesso histórico após perda de Membership e a
exclusão manual autorizada continuam pendentes. Desligar a flag preserva os dados.
