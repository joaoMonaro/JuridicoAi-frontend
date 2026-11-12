# Histórico pessoal e exclusão autorizada

Implementado em 2026-11-12. A rota `/historico-assistente` fica fora do editor e do
guard de autenticação organizacional. Acesso pelo menu do usuário e pela página de
login. Usa e-mail/senha numa sessão pessoal separada; continua funcionando sem
Membership, enquanto a conta do titular estiver ativa.

A tela lista conversas com paginação, mensagens anteriores, contexto fornecido,
comparações salvas e downloads de anexos privados. Não consulta Casos/Peças atuais,
expõe fontes compartilhadas ou oferece geração/aplicação. Propostas são apenas
comparações históricas renderizadas sem executar HTML, imagens ou links externos.

`personal-history.ts` isola o token organizacional do pessoal. Refresh HttpOnly
com cookie Secure/Strict é compartilhado entre consultas concorrentes. Logout
impede gravação tardia de um refresh e **Sair da conta** também revoga a sessão
pessoal. Se não conseguir revogar, informa a falha sem anunciar encerramento.

A exclusão exige confirmação no diálogo. Cancelar não envia DELETE. O requestId
fica preservado por usuário/conversa no sessionStorage para reconciliar perda de
resposta. Após o aceite, a conversa sai da consulta e o protocolo acompanha o
expurgo mesmo após reload; a Peça e documentos do Caso não são apagados.
O status só confirma remoção do ambiente ativo, sem declarar eliminação de backups.

API usada:

- `POST /auth/pessoal/login`, `/refresh`, `/logout`.
- Sob `/assistente/v2/pessoal`: `GET /conversas`, `/conversas/{id}`,
  `/conversas/{id}/mensagens`, `/conversas/{id}/anexos`,
  `/conversas/{id}/anexos/{anexoId}/arquivo`, `/propostas/{id}`.
- `DELETE /conversas/{id}` com `{requestId, confirmarExclusao:true}`; 202 e protocolo.
- `GET /exclusoes/{requestId}` e `/exclusoes` (até 30 recentes).

Frontend/API precisam manter o mesmo site para o refresh Strict; usar HTTPS em
produção e hostname consistente no desenvolvimento. Origens adicionais devem
constar em `Auth:PersonalHistoryAllowedOrigins` no backend. Migração necessária:
`20261112164027_AddPersonalAssistantHistory`, junto das anteriores. Histórico
pessoal não depende das flags de geração de IA.

Validação: 133 unitários, build e lint aprovados; 30 cenários focados de Playwright,
incluindo cinco pessoais, aprovados. API/PostgreSQL reais validados separadamente
com credenciais e arquivos fictícios e zero chamadas de IA.

Evidência e limites operacionais no backend:
`implementacoes/features/assistente-conversacional/evidencias/e1-historico-pessoal-exclusao-2026-11-12.md`.
Registro externo de exclusões, retenção e ensaio de restauração de backup ainda
precisam ser validados antes da liberação operacional. OCR continua em stand by.
