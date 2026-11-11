# E0 — comparação de alterações no editor

Primeira implementação local da revisão de propostas, com dados fictícios. Não
integra ainda IA, histórico persistente, upload ou aprovação transacional no backend.

## Abrir

```bash
npm ci
npm run dev
```

Acesse `/dev/revisao-peca` na URL do Vite. A rota só existe em desenvolvimento,
dispensa login para este exemplo fictício e não faz requisições à API. Ao recarregar
ou reiniciar o exemplo, o conteúdo local é descartado. A rota e fixtures são
eliminadas do build de produção.

Clique em **Carregar proposta de teste**. O exemplo inclui substituição de
parágrafo, inserção de subtítulo, remoção de repetição e alteração em uma lista.
Navegue entre grupos, aprove/rejeite individualmente ou em conjunto. Use
**Continuar editando** para sair da revisão; editar manualmente invalida pendências.
Após aprovar um lote, **Desfazer** e **Refazer** atuam como uma operação de histórico.

## Estrutura

- `review/types.ts`: adaptador local de proposta com baseDocument e grupos de splices.
- `review/extension.ts`: plugin de revisão, validação de base, aprovação local,
  rejeição e remapeamento após aplicação parcial.
- `review/preview.ts`: decorations/widgets e diff por palavras, incluindo listas.
- `review/review-toolbar.tsx`: navegação e decisões; estado lido do plugin.
- `legal-editor-extensions.ts`: mesmo schema e extensões para editor real e exemplo.

O editor real registra a extensão, inicialmente sem proposta e sem alteração de
comportamento. O fluxo legado da IA continua usando seu contrato atual. Nenhuma
resposta real é convertida automaticamente em proposta local sem aprovação.

O preview não altera o documento ProseMirror, seu JSON nem o HTML serializado.
Aplicar um lote cria uma transação do documento, separada da digitação pelo
histórico. Aprovações repetidas são recusadas. Alteração externa/manual e undo
com grupos pendentes invalidam a base. Esta validade é local; não substitui
versão, hash e autorização do servidor no fluxo futuro.

Propostas são compiladas e validadas antes de entrar na revisão; intervalos
inexistentes, grupos duplicados, sobreposição, nós inválidos e links executáveis
são recusados. Conteúdo textual semelhante a HTML é renderizado como texto.

## Verificação

```bash
npm run test:run
npx playwright test e2e/assistant-review.spec.ts
npm run build
npm run lint
```

Os novos testes cobrem preview sem mutação, formatação preservada, aplicação
parcial em ordens diferentes, lote único de undo/redo, edição manual, base antiga,
conteúdo inválido, criação em documento vazio e acessibilidade. O teste de navegador
gera screenshot em `test-results/assistant-review-preview.png` (ignorado pelo Git).

## Próxima integração

Conectar propostas validadas e recibos à API versionada; adicionar barreira de
autosave e adoção de commit externo; integrar a toolbar no workspace real com
paginação de revisão. Somente depois habilitar o novo fluxo para documentos reais.
O exemplo não comprova atomicidade, retomada de rede ou persistência da aprovação.

Escopo e especificações no repositório irmão:
[assistente conversacional](../../JuridicoAi/implementacoes/features/assistente-conversacional/README.md).
