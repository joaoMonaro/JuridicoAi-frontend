# React + TypeScript + Vite

## Revisão visual da Peça — E0

A primeira etapa da comparação pode ser testada em `/dev/revisao-peca`, com
`npm run dev`. Usa documento e propostas fictícios, sem chamadas à IA/API ou
salvamento no servidor. Permite aprovar/rejeitar alterações no documento e testar
desfazer/refazer. Disponível somente em desenvolvimento.

Veja [instruções e limites desta etapa](docs/assistant-review-e0.md).

## Revisão persistida no editor real

O editor também consome a revisão persistida quando a API anuncia
`suportaRevisaoPersistida`. Sugestões são salvas e revisadas antes da aprovação;
o servidor aplica e retorna um recibo sem PATCH duplicado do autosave.
Veja [ativação, fluxo e limites](docs/assistant-review-persistent.md).

O chat também recupera mensagens e respostas quando a API anuncia
`suportaHistorico`, usando esse histórico como contexto no backend.
Veja [a etapa de conversa persistida](docs/assistant-conversation-history.md).

Com `suportaConversaLivre`, o painel recebe pedidos naturais, prepara propostas
diretamente na comparação e permite ajustar pendências pelo chat. A Peça só muda
após a aprovação. Veja [conversa livre, ativação e limites](docs/assistant-free-chat.md).

A etapa de [documentos no chat](docs/assistant-documents.md) integra anexos privados,
fontes do Caso, leitura nativa e progresso. OCR permanece separado e desativado
até concluir a calibração.

## Testes automatizados

Os testes unitários e de componentes usam Vitest, jsdom e React Testing
Library. O fluxo de navegador usa Playwright com uma API fake local e não faz
chamadas à OpenAI.

```bash
# preparação da máquina para os E2E
npx playwright install chromium

# modo interativo durante o desenvolvimento
npm test

# unitários e componentes
npm run test:run

# somente E2E
npm run test:e2e

# acessibilidade automatizada
npm run test:a11y

# suíte completa não interativa: Vitest e Playwright
npm run test:ci
```

O arquivo `src/test/setup.ts` concentra os matchers de DOM e a limpeza após
cada teste. Novos testes devem consultar elementos por papel, nome acessível ou
rótulo sempre que existir uma semântica adequada. A suíte de acessibilidade usa
axe-core no Chromium e reprova violações críticas ou sérias. Falhas E2E
preservam trace, screenshot e vídeo em `test-results/`, diretório ignorado pelo
Git.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
