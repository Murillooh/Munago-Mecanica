# Projeto Mecânica

Stack: React 19 + Vite 6 + Tailwind 4 + TypeScript, servidor Express (`server.ts`, `server/`), Firebase/Firestore, Gemini (`@google/genai`), jsPDF, xlsx, Recharts.

## Regra obrigatória: consultar skill antes de qualquer alteração

Antes de criar, editar ou remover qualquer arquivo, invocar (via Skill tool) a skill de `.claude/skills/` que mais se encaixa na tarefa. Se várias se aplicam, invocar todas as relevantes. Só usar `pre-action-check` quando nenhuma skill do projeto servir.

Mapa rápido:

| Tarefa | Skills |
|---|---|
| Componentes/páginas React | `react-best-practices`, `react-patterns`, `react-ui-patterns`, `react-state-management`, `react-component-performance` |
| TypeScript/tipos | `typescript-expert`, `typescript-advanced-types` |
| Estilo/UI/UX | `tailwind-patterns`, `tailwind-design-system`, `frontend-design`, `ui-ux-pro-max`, `ui-review`, `ux-audit`, `ux-copy`, `web-design-guidelines` |
| Acessibilidade | `fixing-accessibility`, `accessibility-compliance-accessibility-audit` |
| Animações (`motion`) | `fixing-motion-performance` |
| Firebase/Firestore/rules | `firebase` |
| Gemini/IA | `gemini-api-dev`, `gemini-api-integration` |
| Servidor Express/API | `nodejs-backend-patterns`, `nodejs-best-practices`, `api-design-principles`, `error-handling-patterns` |
| Auth/segurança | `auth-implementation-patterns`, `api-security-best-practices`, `backend-security-coder`, `frontend-security-coder`, `security-audit` |
| Validação (zod/express-validator) | `zod-validation-expert` |
| Bugs | `systematic-debugging`, `debugging-strategies` |
| Testes | `test-driven-development`, `javascript-testing-patterns`, `webapp-testing` |
| Refatoração/review | `clean-code`, `code-review-checklist`, `lint-and-validate` |
| Performance/PWA | `web-performance-optimization`, `progressive-web-app` |
| Dashboard/gráficos | `kpi-dashboard-design` |
| Estoque | `inventory-demand-planning` |
| Export PDF/Excel | `pdf-official`, `xlsx-official` |
| Planejamento | `brainstorming`, `writing-plans` |
| Antes de declarar pronto | `verification-before-completion` |

Fonte original das skills: `C:\Users\Murillo Silva\.gemini\skills\skills` (1500+ skills). Para adicionar outra, copiar a pasta dela para `.claude/skills/`.
