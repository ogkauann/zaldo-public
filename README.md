# 💰 Zaldo — Controle financeiro pessoal e familiar, sem planilha

> **Repositório de demonstração.** O código-fonte completo do Zaldo é privado — aqui está uma
> amostra curada (modelo de dados, políticas de segurança e trechos representativos) para quem
> quer entender como o sistema funciona por trás.
>
> 🌐 Teste grátis: **[zaldo.com.br](https://zaldo.com.br)** · 📧 Contato: comercial.ogkauann@gmail.com

## O problema

A maioria das pessoas tenta organizar as finanças numa planilha que só ela entende — até a
fórmula quebrar, o mês virar e ninguém mais atualizar. O resultado: juros por conta esquecida,
"quanto gastamos esse mês?" sem resposta no grupo da família, e nunca saber quanto realmente
dá pra gastar.

## A solução

O Zaldo é um SaaS 100% no navegador (desktop e mobile) onde você abre o painel de manhã e sabe
o que já foi pago, o que vence hoje e quanto sobra até o fim do mês.

**Funcionalidades em produção:**

- Lançamentos com contas fixas no automático (recorrências e parcelamentos)
- Painel com saldo, "quanto ainda dá pra gastar no mês" e alertas de vencimento
- Controle de cartões de crédito (faturas, limites, fechamento)
- **Workspace família**: até 5 pessoas, com divisão de despesas (igual, percentual ou valores)
- Orçamento por categoria, agenda financeira e busca com prévia ao vivo
- **Simulador de investimentos** com taxas ao vivo do Banco Central (CDI, Selic, poupança) e
  comparação de rendimento por banco (% do CDI)
- Mercado cripto em tempo real
- **Assinaturas recorrentes via Mercado Pago** (checkout hospedado + webhook com HMAC)
- Painel admin com log de auditoria (eventos de segurança, sistema e ações administrativas)
- 2FA (TOTP), PWA instalável, tema claro/escuro

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + Phosphor Icons + Framer Motion + Recharts |
| Banco | PostgreSQL (Supabase) com **Row Level Security** |
| ORM | Prisma 7 (driver adapters) |
| Auth | Supabase Auth (e-mail + 2FA TOTP) |
| Validação | Zod (client e server) |
| Pagamentos | Mercado Pago — API de Assinaturas (preapproval) |
| E-mail | Resend |
| Infra | Vercel (região gru1, São Paulo) + Supabase Cloud (sa-east-1) |

## Arquitetura em 1 minuto

- **Server Actions** para quase todo o CRUD — funções server-side tipadas com Zod, sem camada
  REST intermediária. Toda rota protegida passa por um único gate (`requireWorkspace()`), que
  resolve sessão, workspace ativo e trial expirado.
- **Route Handlers** (`/api/*`) só onde uma URL é necessária: webhook do Mercado Pago,
  busca, cotações, crons e export CSV.
- **Multi-tenant por workspace**: toda tabela carrega `workspace_id` e o isolamento é
  garantido no Postgres via RLS (veja [`prisma/rls.sql`](prisma/rls.sql)) — nem um bug de
  aplicação vaza dados de outro espaço.
- **Auditoria append-only**: eventos de segurança (logins falhos, rate-limit, trocas de
  senha/e-mail) e de sistema (convites, exclusões, pagamentos) num log único com categoria e
  IP (veja [`exemplos/lib/audit.ts`](exemplos/lib/audit.ts)).
- **Pagamento recorrente**: o checkout cria uma assinatura no Mercado Pago; o webhook valida
  a assinatura HMAC, **re-busca o estado na API** (nunca confia no payload) e ativa/suspende o
  plano sozinho.

## O que tem neste repositório

```
prisma/schema.prisma        Modelo de dados completo (multi-tenant, assinaturas, divisão familiar)
prisma/rls.sql              Políticas de Row Level Security + storage de avatares
exemplos/lib/finance.ts     Núcleo de juros compostos do simulador (puro, testado)
exemplos/lib/split-calc.ts  Divisão de despesas em centavos, sem erro de arredondamento
exemplos/lib/audit.ts       Log de auditoria fire-and-forget
exemplos/api/…              Exemplo de Route Handler (busca com prévia)
exemplos/ui/…               Componentes do design system (Select, DatePicker, CurrencyInput)
docs/escopo.md              Escopo original do produto
```

## Roadmap

- 🔜 Open Finance (conexão automática com bancos via Pluggy) — já desenvolvido, em liberação
- 🔜 Relatórios avançados (fluxo de caixa, comparativos)

## Quer contribuir?

O jeito mais valioso: **teste de verdade** ([zaldo.com.br](https://zaldo.com.br), 7 dias grátis,
sem cartão), reporte bugs e mande ideias. Todo feedback é respondido.

---

© Kauan — todos os direitos reservados. Este repositório existe para fins de demonstração;
o código aqui publicado não pode ser reutilizado comercialmente sem autorização.
