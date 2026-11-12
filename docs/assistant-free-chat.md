# Conversa livre no editor

> Registro da etapa indicada neste documento. Funcionalidades e contagens de testes
> refletem aquele recorte; pendências citadas não substituem o
> [estado consolidado atual](assistant-implementation-status.md).

A capacidade `suportaConversaLivre` ativa o fluxo sem modos técnicos. Ela exige
as flags de revisão, histórico e `AssistenteIa:AutomaticConversationEnabled` no
backend, todas desligadas por padrão. Aplicar as três migrations antes de ativar:
`AddAssistantReviewWorkspace`, `PersistAssistantConversationMessages` e
`TrackSupersededAssistantProposals`.

O usuário relata fatos, corrige informações e pede uma minuta ou melhoria no
mesmo composer. Peça atual e histórico elegível são reunidos pelo servidor.
Selecionar um trecho é opcional; contexto adicional continua no menu existente.
As ações rápidas apenas preenchem pedidos naturais, sem escolher modo técnico.

`POST /assistente/v2/conversas/{id}/interacoes` recebe clientRequestId, texto,
versaoPecaEsperada e, quando houver, seleção/referência da proposta/contextos.
Não envia modo ou operação preferida. Continua usando SSE ligado à requisição;
não há retomada por worker nesta etapa.

Perguntas recebem texto no chat. Pedidos de mudança retornam proposta persistida
e abrem diretamente a comparação no documento, sem botão intermediário para
preparar/aplicar. O conteúdo da Peça só muda na aprovação visual. Em documento
vazio, a ação é **Aprovar minuta**. Depois, o servidor confirma o commit por recibo.

O cartão conserva a explicação e permite **Ver proposta no documento**, buscando
seu estado canônico. Estados aplicados, desatualizados e substituídos não reabrem
como alterações pendentes. Histórico antigo não reutiliza âncoras para aplicar.
Um novo pedido pode referenciar a proposta pendente atual. A substituição é
transacional no backend e preserva grupos já aprovados; não altera a Peça.

Durante commit ou resultado incerto, novo envio fica bloqueado até reconciliação.
O fallback anterior permanece quando a API não anunciar a capacidade. Usuários
com apenas conversa não recebem ações de edição; minuta requer geração integral
além de edição. O servidor sempre revalida acesso, versão, grupos e hashes.

Verificação: 114 testes unitários/componentes, 18 E2Es de conversa/revisão, build
e lint passaram. O novo `assistant-free-chat.spec.ts` cobre minuta com abertura
direta, resposta informativa, ajuste pendente e conversa sem edição. Também houve
teste com frontend/API/PostgreSQL reais e provedor simulado, incluindo aprovação,
revogação de geração integral e reload do histórico. Não houve avaliação com o
modelo real. Permanece aviso de bundle maior que 500 kB.

Limites: sem anexos/OCR, resumo/busca de histórico extenso, geração em etapas,
worker, área pessoal após perda de vínculo ou exclusão manual nesta etapa.
O contexto básico tem limite explícito; excesso não é truncado silenciosamente.
Qualidade semântica e jurídica ainda depende de avaliação com o modelo configurado.
