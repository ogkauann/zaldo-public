# Segurança no Zaldo

Finanças pessoais são o dado mais sensível que alguém confia a um app. As camadas, de fora
pra dentro:

## 1. Transporte e sessão
- HTTPS em tudo; cookies de sessão `httpOnly` + `sameSite`.
- Login gerenciado pelo Supabase Auth (senha com hash forte, confirmação de e-mail,
  recuperação por link verificado).
- **2FA por TOTP** (app autenticador) — quando ativado, o gate de rotas exige o desafio MFA
  antes de qualquer página.

## 2. Anti-abuso
- **Rate-limit por IP no login** (Upstash Redis) — tentativas em excesso são bloqueadas e
  registradas na auditoria.
- Redirecionamentos pós-login validados (`next` só aceita caminho interno — sem open
  redirect).

## 3. Isolamento de dados (a camada mais importante)
- Todas as tabelas de dados carregam `workspace_id`.
- **Row Level Security no Postgres**: as políticas (públicas neste repo, em
  [`../prisma/rls.sql`](../prisma/rls.sql)) garantem que uma sessão só enxerga linhas dos
  workspaces em que o usuário é membro — mesmo que exista um bug na aplicação.
- Storage de avatares com política por pasta: cada usuário só escreve em
  `avatars/<seu-user-id>/`.

## 4. Webhooks e crons
- Webhook do Mercado Pago: valida o header `x-signature` (HMAC-SHA256 do manifest oficial,
  comparação em tempo constante) **e** re-busca o estado da assinatura na API com o nosso
  token — o payload recebido nunca é a fonte da verdade.
- Crons protegidos por Bearer secret com comparação em tempo constante.

## 5. Auditoria
Log append-only com categoria (`security` / `system` / `admin`), ator, IP e detalhes:

| Evento | Exemplos |
|---|---|
| security | login falho, bloqueio por rate-limit, troca de senha/e-mail, assinatura de webhook inválida |
| system | convite enviado/aceito/revogado, membro removido, workspace criado/apagado, checkout iniciado, pagamento autorizado/cancelado |
| admin | ações do painel do operador |

O registro é *fire-and-forget*: uma falha no log jamais derruba a ação do usuário
(veja [`../exemplos/lib/audit.ts`](../exemplos/lib/audit.ts)).

## 6. Segredos
- Nenhuma chave no repositório — tudo em variáveis de ambiente (Vercel, marcadas como
  sensíveis).
- Tokens de terceiros (Mercado Pago, Resend) só existem no servidor; o cliente nunca os vê.
- Credenciais de conexões bancárias (Open Finance) são criptografadas em repouso.
