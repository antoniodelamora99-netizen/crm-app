-- Add optional username to profiles (unique, nullable)
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on public.profiles ((lower(username))) where username is not null;