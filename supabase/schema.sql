create table if not exists profiles (id uuid primary key references auth.users on delete cascade, email text not null, role text not null default 'reviewer' check (role in ('admin','reviewer')), active boolean not null default true, created_at timestamptz not null default now());
create table if not exists cephalograms (id bigint primary key, title text not null, storage_path text not null, majority_label text check (majority_label in ('clear','unclear','tie')), dataset_split text check (dataset_split in ('train','validation','test')));
create table if not exists reviews (reviewer_id uuid references auth.users on delete cascade, cephalogram_id bigint references cephalograms on delete cascade, label text not null check (label in ('clear','unclear')), updated_at timestamptz not null default now(), primary key (reviewer_id, cephalogram_id));
alter table profiles enable row level security; alter table cephalograms enable row level security; alter table reviews enable row level security;
create policy "reviewers read images" on cephalograms for select to authenticated using (true);
create policy "reviewers manage own reviews" on reviews for all to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy "users read own profile" on profiles for select to authenticated using (id = auth.uid());
