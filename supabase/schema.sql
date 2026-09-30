-- LaunchJustice schema.
--
-- This is already applied to the project in config.js. It is kept here so the
-- database can be rebuilt from scratch, reviewed alongside the app, or pointed
-- at a second project. Run it once in the Supabase SQL editor of an empty
-- project; the individual migrations are in supabase/migrations/.
--
-- Accounts are optional. A signed-out visitor acts as their browser
-- ('d:<random>'), a signed-in one acts as their account ('u:<uuid>').
-- actor_id is that single key; user_id is the verified identity behind it.


-- ============================================================ profiles ======
-- A public profile for every account, created automatically by a trigger on
-- auth.users so email sign-ups and Google sign-ins both land here.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public display name and avatar for each account. Written by handle_new_user() on sign-up.';

-- Take the best name the provider gave us: what they typed into our own
-- sign-up form, else what Google sent, else the local part of their email.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_avatar text;
begin
  v_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  )), '');

  if v_name is null then
    v_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  v_avatar := nullif(trim(coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  )), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(coalesce(v_name, 'Backer'), 40), v_avatar)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Both only ever run as triggers, so nothing should reach them via /rest/v1/rpc.
revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;


-- ======================================================= case activity ======
-- The check constraints only pin down the shape of actor_id. The binding
-- between actor_id and user_id is enforced by the policies below, which is
-- where it can actually be trusted, and it stays out of the constraints so
-- that deleting an account (which nulls user_id) cannot break its own rows.

create table public.pledges (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  actor_id text not null,
  name text not null,             -- real name: team-only, never exposed to the API
  display_name text not null,     -- shown publicly ('Anonymous backer' if hidden)
  amount integer not null check (amount > 0 and amount <= 10000000),
  note text check (char_length(note) <= 280),   -- team-only, same as name
  created_at timestamptz not null default now(),
  constraint pledges_actor_shape check (actor_id like 'd:%' or actor_id like 'u:%')
);
create index pledges_case_idx  on public.pledges (case_id);
create index pledges_actor_idx on public.pledges (actor_id);
create index pledges_user_idx  on public.pledges (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  actor_id text not null,
  name text not null check (char_length(name) between 1 and 40),
  avatar_url text,
  body text not null check (char_length(body) between 1 and 600),
  is_backer boolean not null default false,
  created_at timestamptz not null default now(),
  constraint comments_actor_shape check (actor_id like 'd:%' or actor_id like 'u:%')
);
create index comments_case_idx on public.comments (case_id, created_at desc);
create index comments_user_idx on public.comments (user_id);

create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  actor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (comment_id, actor_id),
  constraint comment_likes_actor_shape check (actor_id like 'd:%' or actor_id like 'u:%')
);
create index comment_likes_user_idx on public.comment_likes (user_id);


-- ================================================ row level security =======

alter table public.profiles      enable row level security;
alter table public.pledges       enable row level security;
alter table public.comments      enable row level security;
alter table public.comment_likes enable row level security;

-- profiles: names are public, you may only write your own
create policy "profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A signed-out visitor may only write signed-out rows; a signed-in one may only
-- write rows stamped with their own id, so nobody can act as someone else.
create policy "read pledges" on public.pledges
  for select to anon, authenticated using (true);
create policy "pledge signed out" on public.pledges
  for insert to anon
  with check (user_id is null and actor_id like 'd:%');
create policy "pledge as yourself" on public.pledges
  for insert to authenticated
  with check (user_id = (select auth.uid()) and actor_id = 'u:' || (select auth.uid())::text);

create policy "read comments" on public.comments
  for select to anon, authenticated using (true);
create policy "comment signed out" on public.comments
  for insert to anon
  with check (user_id is null and actor_id like 'd:%');
create policy "comment as yourself" on public.comments
  for insert to authenticated
  with check (user_id = (select auth.uid()) and actor_id = 'u:' || (select auth.uid())::text);

create policy "read likes" on public.comment_likes
  for select to anon, authenticated using (true);
create policy "like signed out" on public.comment_likes
  for insert to anon
  with check (user_id is null and actor_id like 'd:%');
create policy "like as yourself" on public.comment_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and actor_id = 'u:' || (select auth.uid())::text);
-- A signed-in person's like can only be removed by them. Signed-out likes carry
-- no identity to check against, so they stay removable by any signed-out
-- visitor who knows the row; signing in is what makes a like properly yours.
create policy "unlike signed out" on public.comment_likes
  for delete to anon using (user_id is null and actor_id like 'd:%');
create policy "unlike your own" on public.comment_likes
  for delete to authenticated using (user_id = (select auth.uid()));


-- ====================================================== column grants ======
-- Supabase grants everything on new public tables by default. Pull that back so
-- the browser can only touch the columns it needs: real names and the private
-- notes to the legal team stay readable in the dashboard, never over the API.
-- Nothing here grants update or delete on a pledge, so a pledge cannot be
-- edited or withdrawn from the browser at all.

revoke all on public.profiles      from anon, authenticated;
revoke all on public.pledges       from anon, authenticated;
revoke all on public.comments      from anon, authenticated;
revoke all on public.comment_likes from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert (id, display_name, avatar_url) on public.profiles to authenticated;
grant update (display_name, avatar_url)     on public.profiles to authenticated;

grant select (id, case_id, user_id, actor_id, display_name, amount, created_at)
  on public.pledges to anon, authenticated;
grant insert (case_id, user_id, actor_id, name, display_name, amount, note)
  on public.pledges to anon, authenticated;

grant select on public.comments to anon, authenticated;
grant insert (case_id, user_id, actor_id, name, avatar_url, body, is_backer)
  on public.comments to anon, authenticated;

grant select, delete on public.comment_likes to anon, authenticated;
grant insert (comment_id, actor_id, user_id) on public.comment_likes to anon, authenticated;


-- ========================================================== realtime =======
alter publication supabase_realtime add table public.pledges;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.comment_likes;


-- ================================================================ admin ======
-- Everything /admin needs. Access is one list of emails, checked against the
-- signed-in account's confirmed address, so a hidden URL is never the lock.

create table public.admins (
  email text primary key check (email = lower(email) and email like '%@%'),
  added_by text,
  created_at timestamptz not null default now()
);
comment on table public.admins is
  'Who can use /admin. Matched against the signed-in account''s confirmed email.';

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;
create policy "admins read admins" on public.admins
  for select to authenticated using ((select public.is_admin()));
create policy "admins add admins" on public.admins
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins remove admins" on public.admins
  for delete to authenticated using ((select public.is_admin()));
revoke all on public.admins from anon, authenticated;
grant select, insert, delete on public.admins to authenticated;

-- The first admin has to be added here, by hand:
--   insert into public.admins (email, added_by) values ('you@example.com', 'setup');

-- Cases written in the admin. data has exactly the shape of a CASES entry in
-- data.js. published: on the site, replacing a demo case with the same id.
-- hidden: taken off the site. draft: admin only.
create table public.cases (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index cases_updated_by_idx on public.cases (updated_by);

create trigger cases_touch_updated_at
  before update on public.cases
  for each row execute function public.touch_updated_at();

alter table public.cases enable row level security;
create policy "read live cases" on public.cases
  for select to anon, authenticated
  using (status <> 'draft' or (select public.is_admin()));
create policy "admins add cases" on public.cases
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins edit cases" on public.cases
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete cases" on public.cases
  for delete to authenticated using ((select public.is_admin()));
revoke all on public.cases from anon, authenticated;
grant select on public.cases to anon, authenticated;
grant insert, update, delete on public.cases to authenticated;

-- Moderation, and the one way real names and notes leave the database.
create policy "admins delete comments" on public.comments
  for delete to authenticated using ((select public.is_admin()));
grant delete on public.comments to authenticated;

create function public.admin_pledges()
returns setof public.pledges
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return query select * from public.pledges order by created_at desc limit 5000;
end;
$$;
revoke all on function public.admin_pledges() from public, anon;
grant execute on function public.admin_pledges() to authenticated;

-- Video and photographs. Public to read, admins to write.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('media', 'media', true, array['video/*','image/*'])
on conflict (id) do nothing;

create policy "admins list media" on storage.objects
  for select to authenticated using (bucket_id = 'media' and (select public.is_admin()));
create policy "admins upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select public.is_admin()));
create policy "admins replace media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy "admins delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));
