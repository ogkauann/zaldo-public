# Escopo — SaaS de Controle Financeiro Pessoal

> Documento de planejamento. Produto original, inspirado na proposta de valor de referências de mercado (ex.: Contas Online), **sem** copiar código, marca ou identidade visual de terceiros.

---

## 1. Visão do produto

Aplicação web (SaaS) que centraliza a vida financeira pessoal do usuário: receitas, despesas, transferências, cartões de crédito, contas a pagar/receber, metas e relatórios. Multi-tenant, com contas individuais e compartilhamento familiar. Monetização **100% por assinatura paga** com período de trial.

**Proposta de valor:** "Todas as suas contas sob controle — ontem, hoje e mês que vem." Alertas de vencimento, visão de saldo consolidada e planejamento simples do quanto ainda dá para gastar.

---

## 2. Stack recomendada

Para um SaaS onde **visual e API precisam ser fortes** e o time é enxuto, a melhor relação custo/velocidade/robustez é:

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | **Next.js 14+ (App Router) + TypeScript** | SSR/ISR para landing rápida (SEO/ads) + SPA autenticada no mesmo projeto |
| UI | **Tailwind CSS + shadcn/ui + Recharts** | Design system consistente, acessível e rápido de evoluir; gráficos financeiros prontos |
| Backend/API | **Next.js Route Handlers + Server Actions** (mesmo repo) | Full-stack unificado; menos superfície para manter |
| Banco/Auth | **Supabase (Postgres + Auth + RLS + Storage)** | Postgres real, autenticação pronta, **Row Level Security** garante isolamento multi-tenant no nível do banco |
| ORM | **Prisma** ou **Drizzle** | Migrations versionadas e tipagem end-to-end |
| Pagamentos | **Stripe** (internacional) ou **Mercado Pago/Asaas** (BR, Pix + boleto + cartão) | Assinatura recorrente, trial e webhooks |
| Jobs/alertas | **Supabase Cron / Edge Functions** (ou Trigger.dev) | Alertas de vencimento por e-mail/push |
| E-mail | **Resend** | Transacional e alertas |
| Deploy | **Vercel** (front/API) + **Supabase Cloud** | Zero-ops, escala automática |
| Observabilidade | **Sentry + PostHog** | Erros + analytics de produto |

Alternativa se você preferir controle total do backend: **NestJS + Postgres/Prisma** como API dedicada. Recomendo começar com o modelo unificado (Next + Supabase) pela velocidade de chegar ao mercado; migrar para API dedicada depois é viável.

---

## 3. Personas e planos

- **Individual** — controla as próprias finanças.
- **Família** — titular convida membros (esposo(a), filhos) com papéis e permissões.

**Modelo de cobrança (só assinatura paga):**

| Plano | Preço (sugestão) | Limites |
|---|---|---|
| Trial | 7 dias grátis, sem cartão | Acesso completo, expira |
| Essencial | mensal | 1 usuário, contas/cartões ilimitados, relatórios básicos |
| Família | mensal (maior) | até 5 usuários, compartilhamento, relatórios avançados |
| Anual | desconto vs. mensal | mesmos recursos, cobrança anual |

Sem plano gratuito permanente. Após o trial, acesso bloqueado até assinar.

---

## 4. Funcionalidades (MVP → evolução)

### MVP (v1)
1. **Autenticação** — cadastro, login, recuperação de senha, verificação de e-mail.
2. **Onboarding** — escolher tipo de conta (pessoal/família), criar primeira conta bancária.
3. **Contas** (bancárias/carteira) — saldo inicial, saldo atual consolidado.
4. **Lançamentos** — receita, despesa e transferência; data, valor, categoria, descrição, status (previsto/realizado), recorrência.
5. **Categorias** — padrão + personalizadas, com ícone/cor.
6. **Cartões de crédito** — fechamento, vencimento, limite; despesas viram fatura.
7. **Dashboard** — saldo atual, receitas/despesas do mês, vencidos/vencendo hoje/futuro, gráfico de gastos por categoria.
8. **Agenda/Calendário** — visão mensal com valores realizados/previstos por dia.
9. **Alertas** — contas a vencer (e-mail).
10. **Assinatura** — checkout, trial, gestão do plano, bloqueio pós-trial.

### v2
- Recorrências avançadas e parcelamento.
- Compartilhamento de lançamentos (dividir conta).
- Importação **OFX/CSV** e conciliação bancária.
- Relatórios avançados (fluxo de caixa, DRE pessoal, comparativos).
- App mobile (React Native/Expo reaproveitando a API).

### v3
- **Open Finance** (conexão bancária automática via agregador: Pluggy/Belvo).
- **Metas financeiras** (juntar para viagem, carro).
- Notificações push/SMS.

---

## 5. Modelo de dados (essencial)

```
users            (id, email, nome, created_at)               ← Supabase Auth
workspaces       (id, nome, tipo[pessoal|familia], owner_id)  ← "tenant"
memberships      (id, workspace_id, user_id, papel[owner|admin|membro])
accounts         (id, workspace_id, nome, tipo, saldo_inicial, moeda)
credit_cards     (id, workspace_id, nome, limite, dia_fechamento, dia_vencimento)
categories       (id, workspace_id, nome, tipo[receita|despesa], cor, icone)
transactions     (id, workspace_id, account_id, card_id?, category_id,
                  tipo[receita|despesa|transferencia], valor, data_competencia,
                  data_vencimento, status[previsto|realizado], descricao,
                  recorrencia_id?, transfer_group_id?)
recurrences      (id, workspace_id, regra, proxima_data, ativo)
invoices         (id, card_id, mes_ref, valor_total, status, vencimento)
subscriptions    (id, workspace_id, plano, status, trial_ends_at,
                  gateway_customer_id, gateway_subscription_id)
alerts           (id, workspace_id, transaction_id, canal, enviar_em, enviado)
```

**Isolamento multi-tenant:** toda tabela carrega `workspace_id`. RLS no Postgres garante que cada query só enxerga linhas dos workspaces em que o usuário é membro. Isso protege os dados no nível do banco, independente de bug na aplicação.

---

## 6. Arquitetura

```
[ Navegador ]
     │  (Landing SSR + App autenticado)
[ Next.js (Vercel) ] ── Route Handlers / Server Actions ──┐
     │                                                     │
     ├── Supabase Auth (sessão/JWT)                        │
     ├── Postgres + RLS  ◄── Prisma/Drizzle                │
     ├── Storage (anexos/comprovantes)                     │
     ├── Edge Functions / Cron (alertas, fechamento fatura)│
     │                                                     │
[ Stripe / Mercado Pago ] ◄── webhooks (status assinatura)─┘
[ Resend ] ◄── e-mails transacionais e alertas
```

Segurança: RLS por workspace, validação server-side (Zod), rate limiting, criptografia em trânsito (TLS) e em repouso (Supabase), segredos em variáveis de ambiente, LGPD (consentimento, exportação e exclusão de dados).

---

## 7. Roadmap sugerido

| Fase | Duração | Entrega |
|---|---|---|
| 0 — Setup | 1 sem | Repo, CI, Supabase, design system base |
| 1 — Auth + Onboarding | 1–2 sem | Cadastro, login, workspace, trial |
| 2 — Núcleo financeiro | 3–4 sem | Contas, lançamentos, categorias, cartões |
| 3 — Dashboard + Agenda | 2 sem | Visão consolidada, calendário, gráficos |
| 4 — Assinatura | 1–2 sem | Checkout, webhooks, bloqueio pós-trial |
| 5 — Alertas + Beta | 1 sem | E-mails de vencimento, beta fechado |
| 6 — v2 | contínuo | OFX/CSV, compartilhamento, relatórios |

---

## 8. Próximos passos

1. Validar o protótipo visual (arquivo `prototipo.html`).
2. Fechar identidade visual própria (nome, logo, paleta).
3. Escolher gateway de pagamento (recomendo **Mercado Pago/Asaas** pelo público BR + Pix).
4. Iniciar Fase 0 (setup do repositório e Supabase).
