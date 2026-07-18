-- =====================================================================
-- Saldo+ — Fase 1: sincronização de usuários e RLS multi-tenant.
-- Rode APÓS aplicar o schema do Prisma (npm run db:migrate), no
-- SQL Editor do Supabase ou via `supabase db push`.
-- =====================================================================

-- 1) Sincroniza auth.users -> public.users automaticamente no signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        nome  = coalesce(public.users.nome, excluded.nome);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Helper: workspaces em que o usuário logado é membro.
create or replace function public.user_workspace_ids()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select workspace_id from public.memberships where user_id = auth.uid();
$$;

-- 3) Habilita RLS em todas as tabelas de domínio.
alter table public.workspaces    enable row level security;
alter table public.memberships   enable row level security;
alter table public.accounts      enable row level security;
alter table public.credit_cards  enable row level security;
alter table public.categories    enable row level security;
alter table public.transactions  enable row level security;
alter table public.recurrences   enable row level security;
alter table public.subscriptions enable row level security;
alter table public.alerts        enable row level security;
alter table public.users         enable row level security;
alter table public.pluggy_items        enable row level security;
alter table public.pluggy_accounts     enable row level security;
alter table public.pluggy_transactions enable row level security;
alter table public.budgets             enable row level security;
alter table public.workspace_invites   enable row level security;
alter table public.transaction_split_shares enable row level security;

-- 4) Políticas.
-- users: cada um enxerga a própria linha.
drop policy if exists users_self on public.users;
create policy users_self on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: membros podem ver; owner administra.
drop policy if exists ws_member_select on public.workspaces;
create policy ws_member_select on public.workspaces
  for select using (id in (select public.user_workspace_ids()));

drop policy if exists ws_owner_all on public.workspaces;
create policy ws_owner_all on public.workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- memberships: visíveis para membros do mesmo workspace.
drop policy if exists mb_member on public.memberships;
create policy mb_member on public.memberships
  for select using (workspace_id in (select public.user_workspace_ids()));

-- Tabelas com workspace_id: acesso total para membros do workspace.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','credit_cards','categories','transactions',
    'recurrences','subscriptions','alerts',
    'pluggy_items','pluggy_accounts','pluggy_transactions','budgets',
    'workspace_invites'
  ]
  loop
    execute format($f$
      drop policy if exists %1$s_ws on public.%1$s;
      create policy %1$s_ws on public.%1$s
        for all
        using (workspace_id in (select public.user_workspace_ids()))
        with check (workspace_id in (select public.user_workspace_ids()));
    $f$, t);
  end loop;
end $$;

-- transaction_split_shares não tem workspace_id próprio (só via transaction).
drop policy if exists transaction_split_shares_ws on public.transaction_split_shares;
create policy transaction_split_shares_ws on public.transaction_split_shares
  for all using (
    transaction_id in (
      select id from public.transactions
      where workspace_id in (select public.user_workspace_ids())
    )
  );

-- 5) Storage: bucket público de avatares. Caminho esperado:
-- avatars/<user_id>/avatar.<ext> — cada usuário só escreve dentro da sua
-- própria pasta; leitura é pública (bucket público, é foto de perfil).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Observação: o app acessa o banco via Prisma com o papel `postgres`
-- (service role), que ignora RLS — a autorização é feita no código
-- (src/lib/auth.ts, sempre escopando por workspaceId). As políticas acima
-- são defesa em profundidade para qualquer acesso via chave anon/PostgREST.
