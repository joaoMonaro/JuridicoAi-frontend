# Escopo Técnico — Front-end de Montador de Peças Jurídicas com IA

> Documento de referência para o desenvolvimento do front-end de uma aplicação web de montagem de peças jurídicas (petições, contestações, recursos, contratos) assistida por Inteligência Artificial.

---

## 1. Visão Geral

Aplicação web destinada a advogados e escritórios para a criação de peças jurídicas com assistência de IA. O sistema combina **templates**, **dados estruturados do caso** e **geração automática de texto**, permitindo montar documentos de forma guiada, editável e revisável.

O coração do produto são dois módulos: o **editor de texto rico** e o **painel de IA**. O restante da aplicação (gestão, dashboard, formulários) é construído sobre uma base de UI consistente e de bom design.

---

## 2. Stack Tecnológica

| Camada | Escolha | Função |
|---|---|---|
| Linguagem / Framework | **React 18 + TypeScript** | Base da aplicação, com tipagem forte para dados complexos (partes, variáveis, versões) |
| Build | **Vite** | Dev server rápido e build otimizado |
| UI / Estilização | **shadcn/ui + Tailwind CSS** | Componentes copiados para o projeto, totalmente customizáveis |
| Componentes complexos | **TanStack Table** | Tabelas com paginação, ordenação, filtro e seleção |
| Estado global (cliente) | **Zustand** | Documento em edição, painel de IA, preferências de UI |
| Estado de servidor | **React Query** | Cache, revalidação, loading e erros das requisições |
| Roteamento | **React Router v6** | Navegação, lazy loading, rotas protegidas |
| Editor de texto | **TipTap (ProseMirror)** | Texto rico, variáveis dinâmicas, controle programático pela IA |
| Formulários | **React Hook Form + Zod** | Formulários performáticos com validação |
| Comunicação com IA | **Fetch + SSE (streaming)** | Geração de texto em tempo real |

### 2.1 Por que shadcn/ui

A escolha do shadcn/ui se apoia em três pontos:

1. **Controle total do código.** Os componentes ficam dentro do projeto, permitindo customização ilimitada — útil para o editor e o painel de IA, onde o comportamento padrão de uma biblioteca de terceiros costuma atrapalhar.
2. **Bundle enxuto.** Você inclui apenas os componentes que usa, mantendo a aplicação leve — relevante num app que já carrega um editor pesado.
3. **Baixo acoplamento.** A aplicação não fica presa ao ecossistema de uma única biblioteca de UI.

> **Nota sobre componentes complexos:** o shadcn/ui não traz tabelas ou date pickers "prontos no nível do Ant Design". Tabelas avançadas são montadas com **TanStack Table**. Para reduzir o custo desse trabalho, a recomendação é **gerar esses componentes complexos uma única vez, com capricho, e transformá-los em componentes reutilizáveis do projeto** (ex.: um `<DataTable>` genérico), evitando reescrever a lógica em cada tela. O uso de IA na geração desse boilerplate acelera bastante essa etapa.

---

## 3. Padrão de Componentes Reutilizáveis

Para capturar a velocidade de desenvolvimento sem perder consistência, o projeto adota componentes-base próprios que encapsulam o shadcn/ui:

- **`<DataTable>`** — wrapper sobre TanStack Table + shadcn, com paginação, ordenação, filtro e seleção padronizados. Usado em todas as listagens (peças, clientes, templates).
- **`<FormField>`** — integração padrão entre React Hook Form, Zod e os inputs do shadcn.
- **`<PageLayout>`** — estrutura consistente de cabeçalho, breadcrumb e área de conteúdo.
- **`<ConfirmDialog>`, `<EmptyState>`, `<LoadingState>`** — estados de UI padronizados.

Esse padrão garante que telas geradas em momentos diferentes (inclusive com auxílio de IA) mantenham coerência visual e comportamental.

---

## 4. Módulos Funcionais

### 4.1 Autenticação e Perfil
- Login, cadastro e recuperação de senha
- Perfil do escritório/advogado (OAB, dados de timbre)
- Controle de planos e limites de uso de IA

### 4.2 Dashboard
- Lista de peças em andamento e concluídas
- Filtros por tipo, cliente, status e data
- Indicadores de uso (tokens/peças no período)

### 4.3 Montador de Peças (núcleo)
- Seleção do tipo de peça a partir de um catálogo
- Wizard por etapas: dados das partes → fatos → fundamentação → pedidos
- Preenchimento assistido por IA em cada bloco
- Editor rico com inserção de cláusulas e teses
- Variáveis dinâmicas (autor, réu, valor da causa, foro)

### 4.4 Integração com IA
- Painel lateral de comando (chat/prompt)
- Ações contextuais: *gerar fundamentação*, *melhorar redação*, *resumir documento anexado*, *sugerir jurisprudência*
- Geração em **streaming (SSE)** com indicador de progresso
- Histórico de versões e regeneração de trechos
- Marcação de fontes geradas para revisão humana

### 4.5 Biblioteca de Templates e Cláusulas
- CRUD de modelos próprios
- Banco de cláusulas reutilizáveis (tags/categorias)
- Importação de modelos existentes (.docx)

### 4.6 Gestão de Documentos
- Upload de anexos (PDF/DOCX) para contexto da IA
- Exportação para .docx e .pdf
- Versionamento e comparação de versões

---

## 5. Componentes-Chave de UI

| Componente | Responsabilidade |
|---|---|
| `DocumentEditor` | Editor central (TipTap) com toolbar e variáveis |
| `AIAssistantPanel` | Chat lateral com ações rápidas de IA |
| `PieceWizard` | Fluxo passo a passo de montagem |
| `TemplateGallery` | Galeria de modelos |
| `VariableManager` | Campos dinâmicos do documento |
| `VersionHistory` | Linha do tempo de versões |
| `FileUploader` | Upload de anexos com preview |
| `DataTable` | Listagens padronizadas (base reutilizável) |

---

## 6. Integração com Back-end (contratos esperados)

| Método / Rota | Função |
|---|---|
| `POST /ai/generate` | Geração de texto (streaming via SSE) |
| `POST /ai/improve` | Refinamento de um trecho |
| `GET /templates` · `POST /templates` | CRUD de modelos |
| `GET /documents/:id` · `PUT /documents/:id` | Persistência de documentos |
| `POST /documents/:id/export` | Exportação para .docx / .pdf |
| `POST /uploads` | Envio de anexos para contexto da IA |

---

## 7. Requisitos Não-Funcionais

- **Performance:** lazy loading de rotas, debounce no autosave do editor.
- **Acessibilidade:** WCAG AA, navegação por teclado no editor. *(Os componentes do shadcn/ui são construídos sobre Radix UI, que já oferece boa base de acessibilidade.)*
- **Responsividade:** desktop-first (uso profissional), adaptável a tablet.
- **Segurança:** sanitização do HTML do editor, tokens em cookie httpOnly, sinalização visual de limites de uso de IA.
- **LGPD:** consentimento, controle e proteção de dados sensíveis dos clientes.

---

## 8. Considerações de IA no Front-end

- Estados de *loading* e *streaming* claramente sinalizados.
- Aviso de **revisão humana obrigatória** — texto gerado por IA não é definitivo.
- Feedback ao usuário quando o limite de contexto/tokens for excedido.
- *Fallback* amigável para erros da API de IA.

---

## 9. Decisões de Design

O objetivo de design é **qualidade e profissionalismo**, não diferenciação visual como vantagem competitiva. Com shadcn/ui + Tailwind isso se obtém por meio de:

- **Paleta sóbria** adequada ao contexto jurídico (tons de azul-marinho, cinza e um acento).
- **Tipografia refinada** (ex.: Inter) para transmitir seriedade.
- **Espaçamento generoso e consistente**, evitando telas apinhadas.
- **Cuidado nos detalhes de UX:** estados de loading bem resolvidos (essenciais com IA), telas vazias amigáveis e microinterações sutis.

A qualidade percebida vem mais de **como os componentes são configurados e usados** do que da biblioteca em si.

---

## 10. Resumo Executivo

O front-end será construído em **React + TypeScript + Vite**, com **shadcn/ui + Tailwind** como base de UI, **TipTap** para edição de texto e **integração de IA via streaming**. Componentes complexos (tabelas, formulários) são padronizados em uma camada reutilizável própria para garantir velocidade e consistência. O foco técnico está nos dois diferenciais do produto — o **editor** e o **painel de IA** — enquanto o restante da aplicação se apoia em uma base sólida, acessível e de bom design.
