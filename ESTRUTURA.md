# Estrutura do Projeto — Jurídico AI (Front-end)

> Documento de referência da arquitetura de pastas e das convenções do projeto.
> Mantenha atualizado conforme o projeto crescer.

---

## Stack do projeto

| Ferramenta | Função |
|---|---|
| **React 18 + TypeScript** | Base da aplicação |
| **Vite** | Build e servidor de desenvolvimento |
| **Tailwind CSS (v4)** | Estilização por classes utilitárias |
| **shadcn/ui (Radix)** | Componentes de UI (copiados para o projeto) |
| **Lucide** | Biblioteca de ícones (padrão do shadcn) |

---

## Comandos essenciais

```bash
npm run dev      # inicia o servidor de desenvolvimento (localhost)
npm run build    # gera a versão de produção (pasta dist/)
npm run preview  # pré-visualiza a build de produção

# Adicionar um componente do shadcn (ex.: input, card, dialog)
npx shadcn@latest add <nome-do-componente>
```

> O servidor de dev fica rodando e "prende" o terminal. Para parar: `Ctrl + C`.
> Para rodar outros comandos sem parar o servidor, use um segundo terminal.

---

## Árvore de pastas

```
JuridicoAi-frontend/
├── node_modules/          # dependências instaladas (ignorada pelo git)
├── public/                # arquivos estáticos servidos como estão
├── src/                   # TODO o código-fonte vive aqui
│   ├── assets/            # imagens, logos e ícones estáticos
│   ├── components/
│   │   ├── ui/            # componentes do shadcn (button, input...) — território do shadcn
│   │   └── shared/        # componentes reutilizáveis PRÓPRIOS (DataTable, PageLayout...)
│   ├── features/          # cada módulo do produto, isolado (auth, dashboard, editor...)
│   ├── hooks/             # hooks customizados reutilizáveis (ex.: useDebounce)
│   ├── lib/               # funções utilitárias (utils.ts do shadcn vive aqui)
│   ├── pages/             # telas completas que viram rotas (DashboardPage, LoginPage...)
│   ├── App.tsx            # componente raiz da aplicação
│   ├── main.tsx           # ponto de entrada (monta o React na página)
│   └── index.css          # CSS global + import do Tailwind + tema do shadcn
├── components.json        # configuração do shadcn/ui
├── index.html             # HTML base onde o React é injetado
├── package.json           # dependências e scripts do projeto
├── tsconfig.json          # config TypeScript (índice + alias @/)
├── tsconfig.app.json       # config TypeScript do código da aplicação
├── tsconfig.node.json     # config TypeScript das ferramentas (Vite etc.)
├── vite.config.ts         # config do Vite (plugins React, Tailwind, alias @/)
└── .gitignore             # arquivos que o git deve ignorar
```

---

## O que cada pasta faz e onde colocar as coisas

### `src/components/ui/`
Componentes gerados pelo **shadcn/ui**. São criados automaticamente pelo comando
`npx shadcn@latest add <componente>`. O código fica no projeto e pode ser editado,
mas em geral é "território do shadcn" — evite misturar componentes próprios aqui.

### `src/components/shared/`
**Seus** componentes reutilizáveis, usados em mais de uma tela.
> **Regra:** é usado em mais de um lugar? Vai para `shared/`.
> Exemplos planejados: `DataTable`, `PageLayout`, `ConfirmDialog`, `EmptyState`.

### `src/features/`
O coração da organização. Cada **módulo do produto** tem a sua própria pasta, contendo
tudo que pertence só a ele (componentes, lógica e tipos específicos daquele módulo).
> **Regra:** isso pertence a um módulo específico? Vai para a feature dele.
> Pastas criadas conforme cada módulo for desenvolvido. Exemplos planejados:
> `auth/`, `dashboard/`, `editor/`, `templates/`, `ai-assistant/`.

### `src/pages/`
Cada arquivo é uma **tela inteira** que corresponde a uma rota (URL). Costumam ser uma
"casca" fina que junta componentes vindos das features.
> Exemplos planejados: `DashboardPage.tsx`, `LoginPage.tsx`, `EditorPage.tsx`.

### `src/hooks/`
Hooks de React reutilizáveis em todo o projeto.
> Exemplo planejado: `useDebounce` (útil para o autosave do editor).

### `src/lib/`
Funções utilitárias gerais. Já contém o `utils.ts` que o shadcn usa.

### `src/assets/`
Imagens, logos e ícones estáticos importados no código.
> Contém arquivos de exemplo do template inicial (`react.svg`, `vite.svg`, `hero.png`)
> que podem ser removidos quando não forem mais usados.

---

## Convenções importantes

### Atalho de import `@/`
O projeto está configurado para usar `@/` como atalho para a pasta `src/`.
Isso vale tanto no TypeScript (`tsconfig`) quanto no Vite (`vite.config.ts`).

```tsx
// ✅ Use o atalho — limpo e independente da profundidade do arquivo
import { Button } from "@/components/ui/button"

// ❌ Evite caminhos relativos longos
import { Button } from "../../../components/ui/button"
```

### Pastas vazias e `.gitkeep`
O git não versiona pastas vazias. Por isso pastas ainda sem conteúdo real
(`shared/`, `features/`, `hooks/`, `pages/`) contêm um arquivo vazio `.gitkeep`
só para mantê-las no repositório. Quando uma pasta passa a ter arquivos de verdade,
o `.gitkeep` dela pode ser removido (opcional — não causa problema se ficar).

---

## Estado atual (setup concluído)

- [x] Ambiente Node + npm
- [x] Projeto React + TypeScript com Vite
- [x] Tailwind CSS instalado e funcionando
- [x] Atalho de import `@/` configurado
- [x] shadcn/ui instalado (tema Slate, ícones Lucide)
- [x] Componente `Button` adicionado
- [x] Estrutura de pastas organizada

## Próximos passos planejados

- [ ] Roteamento (React Router) e primeiras telas
- [ ] Layout base da aplicação (`PageLayout`)
- [ ] Módulos do produto: dashboard, autenticação, editor, painel de IA
