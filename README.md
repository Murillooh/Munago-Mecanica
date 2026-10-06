<div align="center">

# Munago Estoque

**Gestão inteligente para oficinas mecânicas**

Controle de estoque, ordens de serviço e inteligência artificial em uma única plataforma.

<img width="1200" alt="Tela de login do Munago Estoque" src="docs/images/login.png" />

</div>

## Sobre

O Munago Estoque é um sistema web para a operação diária de oficinas e almoxarifados de peças. Ele reúne em um só lugar o cadastro de peças, as entradas e saídas de estoque, as ordens de serviço dos veículos, a equipe com seus níveis de acesso e relatórios gerados com ajuda de IA.

## O que o sistema faz

### Painel de monitoramento
- Indicadores gerais: total de peças, unidades em estoque, valor total do estoque e itens em ruptura.
- Balanço de movimentações e situação das ordens de serviço em andamento.
- Central de reposição, com as peças abaixo do mínimo e a distribuição por categoria.
- Gráfico de tendência de movimentação em barras, área ou linha de saldo.
- Modo monitor que alterna os painéis sozinho, pensado para uma TV na oficina.
- Diagnóstico operacional feito pela IA, com os itens críticos e um plano de ação para a semana.

### Almoxarifado e estoque
- Cadastro de peças com SKU, categoria, preço, quantidade, estoque mínimo, fornecedor, lote, validade, foto e observações.
- Peças ativas ou inativas, com visualização em grade compacta ou em tabela.
- Entrada e saída de estoque direto na peça.
- Categorias com ícone gerado por IA e sugestões de organização.
- Relatório inteligente do estoque: saúde geral, produtos críticos e recomendações.
- Perguntas em linguagem natural sobre o estoque, como "quais peças estão acabando?".
- Exportação para PDF, Excel e CSV.
- Sincronização com Google Sheets.

### Movimentações
- Histórico completo de entradas e saídas, com motivo, responsável e data.
- Resumo de entradas, saídas e balanço líquido.
- Exportação para PDF e Excel.

### Ordens de serviço
- Cliente, telefone, modelo e placa do veículo.
- Peças usadas e mão de obra por item, além da mão de obra geral.
- Total de peças, de mão de obra e da OS calculados automaticamente.
- Etapas: rascunho, em andamento, concluída e paga.
- Data agendada, data de conclusão e observações.

### Alertas
- Aviso automático quando uma peça chega ao estoque mínimo.
- Central de notificações com lidas e não lidas e um som de aviso que pode ser configurado.

### Assistente de mercado (IA)
- Chat com respostas em tempo real e pesquisa na web, para cotar peças, comparar fornecedores e tirar dúvidas técnicas.
- Histórico das pesquisas feitas.

### Equipe e acesso
- Login com e-mail e senha ou com conta Google.
- Cadastro próprio com confirmação por código enviado por e-mail.
- Formulário de solicitação de acesso para novas oficinas.
- Aprovação ou recusa de novos usuários pelo administrador.
- Três perfis de acesso:

| Perfil | Estoque | Movimentações | Ordens de serviço | Relatórios | Usuários |
|---|:-:|:-:|:-:|:-:|:-:|
| Administrador | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editor | ✓ | ✓ | ✓ | ✓ | — |
| Visualizador | — | — | — | ✓ | — |

- Permissões ajustáveis por pessoa.

### Configurações
- Tema claro ou escuro e cor de destaque personalizada.
- Identidade da empresa: nome da oficina ou loja.
- Backup automático do estoque, das movimentações, das categorias e das ordens de serviço.
- Atualização em tempo real: o que um usuário altera aparece na tela dos outros sem recarregar.

## Tecnologias

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Motion e Recharts.
- **Backend:** Node.js com Express e uma API REST.
- **Banco de dados:** PostgreSQL com Drizzle ORM.
- **Autenticação:** Amazon Cognito, com login Google integrado.
- **Inteligência artificial:** Google Gemini.
- **Relatórios:** jsPDF e SheetJS.

## Como rodar localmente

**Pré-requisitos:** Node.js 22 ou mais recente e um banco PostgreSQL.

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha as variáveis. Nunca faça commit do `.env`.
3. Aplique as migrações do banco:
   ```bash
   npm run db:migrate
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Abra http://localhost:3000.

### Outros comandos

| Comando | Para que serve |
|---|---|
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm start` | Roda a versão de produção |
| `npm test` | Roda os testes |
| `npm run lint` | Verifica os tipos do TypeScript |

---

<div align="center">

Munago Desenvolvedora de Software · © 2026

</div>
