# Análise documental por etapas

Implementada em 2026-11-12, atrás de `AssistenteDocumentos:AnalysisEnabled=false`
por padrão. Documentos/recuperação e conversa livre precisam estar habilitados no
backend. OCR permanece em stand by.

Quando o servidor agenda a leitura integral dos documentos, a conexão SSE termina
com `solicitacao.aguardando`. O painel registra o pedido como `analyzing` e recupera
o trabalho por `analiseDocumentalId` nas mensagens. Receber esse evento não aplica
texto nem representa resposta concluída; a fila continua independentemente da tela.

O componente de análise consulta o andamento por arquivo e exibe trechos/lotes
confirmados, lacunas e etapas pendentes. É possível fechar a tela, voltar depois e
acompanhar a mesma solicitação. Quando a resposta fica pronta, o histórico
persistido substitui o estado local. Uma proposta acompanhada durante a análise
abre a comparação; propostas antigas já concluídas mantêm o fluxo de revisão
histórica. A Peça só muda com a aprovação visual existente.

Ações disponíveis: cancelar análise e retomar uma análise interrompida. A retomada
é explícita porque uma chamada sem confirmação de conclusão pode ser refeita e
consumir IA novamente; o backend preserva reservas, checkpoints e limites. O servidor
pode recusar retomada por prazo, limite, fonte alterada ou permissão. Em um novo pedido
explícito sobre o mesmo conjunto ainda válido, o backend pode aproveitar etapas
confirmadas da análise anterior. Reconsultar o
andamento é uma leitura sem gerar outra mensagem nem chamada ao modelo.

`trechosAnalisados` distingue o processamento por etapas de `trechosConsultados`
fornecidos diretamente ao modelo da resposta. A cobertura informa uso de síntese
seletiva, preservando os originais para consulta e as lacunas de extração.

Contratos:

- GET `/assistente/v2/conversas/{id}/analises/{analiseId}`: metadados privados.
- POST `.../{analiseId}/cancelamento`: 204, sem apagar o trabalho.
- POST `.../{analiseId}/retomada`: 202; ações sem corpo usam apiFetch.
- Mensagem em `AguardandoAnalise` bloqueia outro pedido ativo na mesma conversa.
- Estados finais: Concluida, Incompleta, Interrompida, Cancelada e Desatualizada.

Verificações: parser SSE, recuperação e substituição do estado local, reabertura
com análise em andamento, proposta sem segundo pedido, aplicação única após
aprovação, cancelamento e retomada sem duplicar mensagem. Modelos/respostas são
simulados; a qualidade das sínteses ainda depende da avaliação com modelo real.
