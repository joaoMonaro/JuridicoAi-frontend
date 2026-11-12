# Documentos no chat

> Registro da etapa indicada neste documento. Funcionalidades e contagens de testes
> refletem aquele recorte; pendências citadas não substituem o
> [estado consolidado atual](assistant-implementation-status.md).

A capacidade `documentos` habilita **Anexar documento**, lista de fontes e
processamento no painel. Depende da conversa livre e da flag adicional
`AssistenteDocumentos:Enabled`, desligada por padrão. A API precisa da migration
`20261111191036_AddAssistantDocuments` e Poppler no host. O aviso de uso inclui
armazenamento e envio de conteúdo documental; requer novo aceite `-documents-v1`.

Anexos pertencem somente ao chat do titular. Documentos do Caso aparecem como
fontes separadas, conforme acesso atual. Upload usa multipart com clientUploadId;
somente anexos selecionados acompanham `anexoIds` no próximo pedido. Depois da
associação, continuam no contexto elegível da conversa. Originais sem associação
ficam disponíveis para seleção posterior, sem exclusão automática.

O painel consulta progresso até o processamento terminar e mostra quantidade de
trechos utilizáveis/excluídos. Problemas têm arquivo e página/localizador, com
opções de baixar e reprocessar. Texto duvidoso nunca é enviado à IA. Falha de
consulta impede envio silencioso sem as fontes prometidas; **Atualizar** recupera.

PDF nativo, DOCX e TXT têm leitura implementada. O pipeline local de OCR existe,
mas a calibração inicial reprovou sua liberação por cobertura útil insuficiente.
`ocrHabilitado=false` mostra que imagens e regiões digitalizadas não foram lidas;
um PDF misto pode fornecer texto nativo com aviso de leitura parcial. Não anunciar
suporte completo a digitalizações antes da calibração.

A geração continua ligada ao request SSE. O worker documental é durável e separado
da geração. Há limite explícito de janela de contexto, sem truncamento silencioso;
arquivos que excedam a janela permanecem salvos. Recuperação extensa por ferramentas
e memória resumida ainda não estão integradas. Sem exclusão manual nesta etapa.

Atualização: a [consulta documental por ferramentas](assistant-document-retrieval.md)
está integrada atrás de flag, com busca/leitura por etapas e cobertura. A memória
resumida e leitura integral extensa com resumos/checkpoints continuam pendentes.

Validação: 114 testes unitários, 20 E2Es focados de conversa/revisão/documentos,
build e lint. Inclui multipart, espera, seleção dos anexos no pedido e leitura
parcial. Fluxo adicional com frontend/API/PostgreSQL reais e provedor simulado
conferiu que um trecho duvidoso não entrou no input, além de fonte do Caso,
proposta, aprovação e reload. Nenhuma avaliação com modelo real foi executada.

Playwright agora escolhe portas livres e as compartilha com o fake API e os testes.
Não usa 5173 nem reaproveita um servidor alheio. Para fixar portas em CI, configurar
`JURIDICOAI_E2E_FRONTEND_PORT` e `JURIDICOAI_E2E_API_PORT`; Vite usa strictPort.
