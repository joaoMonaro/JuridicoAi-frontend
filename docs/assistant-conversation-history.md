# Conversa persistida e contexto básico

> Registro da etapa indicada neste documento. Funcionalidades e contagens de testes
> refletem aquele recorte; pendências citadas não substituem o
> [estado consolidado atual](assistant-implementation-status.md).

A API anuncia `suportaHistorico` quando `AssistenteIa:ConversationV2Enabled` e
`ReviewV2Enabled` estão ativos, com IA habilitada e acesso da organização. As duas
flags são desligadas por padrão. Aplicar as migrations `AddAssistantReviewWorkspace`
e `PersistAssistantConversationMessages` antes de ativar em ambiente de teste.

O novo aviso de transparência informa persistência de mensagens e uso do histórico
em pedidos posteriores. A confirmação anterior, limitada a propostas, não vale
para essa nova versão.

## Experiência disponível

- Perguntas e respostas ficam salvas na conversa individual daquela Peça.
- Fechar/reabrir ou recarregar recupera mensagens e resultados estruturados.
- A lista pagina 50 mensagens por vez, com **Carregar mensagens anteriores**.
- A versão atual da Peça é sincronizada antes do envio. O backend compõe o contexto
  com essa versão e o histórico elegível, independentemente das páginas carregadas.
- Falhas e interrupções preservam o pedido, com possibilidade de reenviar
  explicitamente. Rejeições permanecem salvas e são excluídas do contexto automático.
- A resposta pode originar uma revisão salva sem duplicar o par de mensagens.
  As alterações continuam exigindo aprovação visual na comparação.
- Respostas recuperadas não reativam âncoras antigas para modificar o documento.
  Propostas registradas podem ser reabertas pela área de propostas salvas.
- Falha na leitura do histórico bloqueia novo envio até **Recuperar conversa**.

## Código

`conversation-history.ts` converte mensagens em turnos de UI e combina histórico
com respostas locais. Um resultado durável pode recuperar uma confirmação perdida
sem criar outra geração. `use-assistant-history.ts` consulta, pagina e acompanha
respostas ainda em andamento. O POST passa pelo protocolo SSE existente no endpoint
`/assistente/v2/conversas/{id}/mensagens`.

O adaptador desta etapa usa os modos atuais. A flag adicional descrita em
[conversa livre](assistant-free-chat.md) ativa intenção automática e outro endpoint.
Este adaptador não implementa worker
ou eventos duráveis. Fechar/cancelar o stream cancela o pedido; reinício não gera
uma segunda chamada automaticamente. O requestId concluído é recuperável no servidor.

Peças legadas com `content: []` são normalizadas para um parágrafo em memória,
inclusive na base de comparação, alinhando o compilador do backend. Abrir não
cria autosave. A primeira aprovação em Peça vazia foi validada com API e banco reais.

## Limites e verificação

O histórico integral permanece salvo, mas ainda não há resumo nem busca de
mensagens antigas. Excesso da janela atual gera erro explícito; nenhum histórico
é apagado ou apresentado ao modelo como leitura completa truncada. Resultados
históricos dependentes de fontes desatualizadas podem ser omitidos do contexto,
preservando sua leitura no chat.

Anexos/OCR, área pessoal após revogação de acesso e exclusão manual autorizada
continuam pendentes. Desligar as flags preserva os registros existentes.

Passaram 114 testes unitários/componentes, 14 testes de navegador da conversa e
revisão, build e lint. A passagem por navegador + frontend/API/PostgreSQL reais
usou provedor local simulado e apenas dados fictícios; nenhuma chamada ao modelo
real. A suíte legada completa continua com as falhas anteriores documentadas.
