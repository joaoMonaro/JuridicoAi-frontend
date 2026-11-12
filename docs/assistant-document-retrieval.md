# Consulta documental por etapas

A flag de backend `AssistenteDocumentos:RetrievalEnabled` integra a recuperação
documental ao fluxo livre. Requer a migration `TrackAssistantDocumentCoverage` e
as flags de documentos/conversa já existentes. O default continua desligado.
OCR permanece em stand by, sem ativação nesta etapa.

O usuário escreve normalmente. O backend envia um catálogo de fontes e permite
que a IA busque trechos ou leia uma fonte em sequência/página. O arquivo inteiro
não precisa caber no primeiro pedido. O conjunto autorizado fica fixado para aquela
execução; permissões e versões são revalidadas antes das consultas e chamadas.

O evento SSE `contexto.documental` atualiza **Cobertura da consulta documental**
durante a geração, com o mesmo contador sequencial do stream. A conclusão inclui
`coberturaDocumental`; mensagens históricas também têm esse campo, permitindo
mostrar o último checkpoint quando uma resposta foi interrompida.

O painel exibe quantos trechos foram consultados, o escopo Relevantes/Todos,
fontes não consultadas e trechos excluídos. Consultar metadados não conta como
leitura; repetir o mesmo trecho não aumenta a cobertura. O registro comprova o
conteúdo fornecido à IA, não a correção jurídica da resposta.

Se o pedido interpretado exige Todos e a cobertura fica incompleta, o servidor
retorna uma explicação sem proposta aplicável. Consulta seletiva pode produzir
uma proposta com aviso de leitura parcial. A aprovação visual continua sendo a
única autorização para alterar a Peça.

Limites por execução: oito consultas e uma geração final, orçamento acumulado
de tokens, limite de contexto e timeout. Limite atingido é indicado na cobertura;
o chat não insiste automaticamente nem aplica minuta truncada. Geração ainda
depende do request; retomada por worker e compactação do histórico seguem pendentes.

Validação: 118 testes unitários e 22 E2Es de conversa/revisão/documentos,
build e lint passaram. Novos casos verificam progresso SSE, contagens inválidas,
reabertura da cobertura e pedido integral incompleto. Fluxo adicional com API e
PostgreSQL reais usou provedor simulado: arquivo maior que 100.000 caracteres,
busca, cobertura, bloqueio de minuta integral incompleta, aprovação seletiva e
reload. Não houve avaliação semântica com modelo real.
