-- LaunchJustice MVP schema. Run once in the Supabase SQL editor.

create table if not exists public.pledges (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  name text not null,              -- real name, visible to your team in the Supabase dashboard only
  display_name text not null,      -- shown publicly ("Anonymous backer" if hidden)
  amount integer not null check (amount > 0 and amount <= 10000000),
  note text check (char_length(note) <= 280),
  device_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  name text not null check (char_length(name) <= 40),
  body text not null check (char_length(body) between 1 and 600),
  is_backer boolean not null default false,
  device_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  device_id text not null,
  primary key (comment_id, device_id)
);

alter table public.pledges enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;

-- MVP policies: anyone with the link can read and add. No edits from the browser.
create policy "read pledges"  on public.pledges       for select to anon using (true);
create policy "add pledges"   on public.pledges       for insert to anon with check (true);
create policy "read comments" on public.comments      for select to anon using (true);
create policy "add comments"  on public.comments      for insert to anon with check (true);
create policy "read likes"    on public.comment_likes for select to anon using (true);
create policy "add likes"     on public.comment_likes for insert to anon with check (true);
create policy "remove likes"  on public.comment_likes for delete to anon using (true);

-- Keep real names and notes out of the public API; the app only reads display_name.
revoke select on public.pledges from anon;
grant select (id, case_id, display_name, amount, device_id, created_at) on public.pledges to anon;
grant insert (case_id, name, display_name, amount, note, device_id) on public.pledges to anon;

-- Live updates
alter publication supabase_realtime add table public.pledges, public.comments, public.comment_likes;
