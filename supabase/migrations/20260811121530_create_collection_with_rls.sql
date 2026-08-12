create table public.collection (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  name text not null check (char_length(name) between 1 and 60),
  image text not null default '' check (char_length(image) <= 500),
  types text[] not null check (cardinality(types) between 1 and 3),
  note text not null default '' check (char_length(note) <= 500),
  is_favorite boolean not null default false,
  added_at timestamptz not null default now(),
  constraint collection_user_pokemon_unique unique (user_id, pokemon_id)
);

create index collection_user_sort_idx
  on public.collection (user_id, is_favorite desc, added_at desc);

alter table public.collection enable row level security;
alter table public.collection force row level security;

revoke all on table public.collection from anon, authenticated;
revoke all on sequence public.collection_id_seq from anon, authenticated;

grant select, insert, update, delete on table public.collection to authenticated;
grant usage, select on sequence public.collection_id_seq to authenticated;

create policy "users_select_own_collection"
  on public.collection
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users_insert_own_collection"
  on public.collection
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users_update_own_collection"
  on public.collection
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users_delete_own_collection"
  on public.collection
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
