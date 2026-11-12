# Contexto de conversas extensas

> Registro da etapa indicada neste documento. Funcionalidades e contagens de testes
> refletem aquele recorte; pendências citadas não substituem o
> [estado consolidado atual](assistant-implementation-status.md).

Etapa implementada em 2026-11-12. O backend pode combinar resumo privado versionado,
mensagens recentes e consulta ao histórico original, sem confirmação adicional.
O histórico completo continua salvo. Alterações da Peça passam pela revisão visual
existente; a memória não aplica nem aprova texto.

O painel mostra **Contexto da conversa** quando há resumo, registros invalidados
ou mensagens ainda fora do resumo. Ao expandir, o usuário vê que o resumo é seletivo
e que os originais podem ser consultados. Fontes ou decisões alteradas podem levar
o backend a desconsiderar registros antigos. O painel recupera esses metadados ao
reabrir, inclusive se uma geração foi interrompida após salvar a memória.

O SSE adiciona `contexto.historico` entre `solicitacao.iniciada` e o evento terminal,
seguindo a mesma sequência de IDs. O evento e `contextoHistorico` da conclusão/histórico
carregam `versaoMemoria`, `ateSequencia`, `mensagensRecentes`, `registrosInvalidados`
e `historicoAdicionalDisponivel`. O frontend valida tipos/contagens e preserva o
checkpoint; receber progresso não equivale a concluir a geração. O texto do resumo
e o raciocínio do provedor não são expostos nesses metadados.

Ativação no backend: `AssistenteIa:HistoryMemoryEnabled=true`, com as flags de
conversa livre/revisão/histórico, assistente global, feature da organização e
transparência confirmada. O default é false. Não depende de OCR nem de documentos.
Não há nova seleção de modo ou confirmação para compactar contexto.

Validação: testes de parser SSE e recuperação após interrupção, além de Playwright
para reabertura, avisos, persistência da Peça antes da aprovação e aplicação única.
Os testes usam respostas simuladas; a fidelidade dos resumos ainda requer avaliação
com o modelo real. A calibração do OCR permanece em stand by.
