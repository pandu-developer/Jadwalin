begin;

-- Database mengisi ID dan nilai bawaan. CHECK membatasi judul, status, dan prioritas.
create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) >= 3),
  description text,
  status text not null default 'todo' check (status in ('todo', 'progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  deadline date,
  created_at timestamp not null default now()
);

alter table public.tasks enable row level security;

-- Pisahkan penambahan kolom dan nilai default agar task lama tidak diklaim otomatis.
alter table public.tasks add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.tasks alter column user_id set default auth.uid();
create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- NULL berarti task masih aktif. Task lama tetap aktif setelah kolom ini ditambahkan.
alter table public.tasks add column if not exists archived_at timestamptz;

-- Jam opsional memakai tanggal deadline yang sudah ada. Task lama tetap berlaku seharian.
alter table public.tasks add column if not exists deadline_time time(0)
  check (deadline_time is null or deadline is not null);

-- Deskripsi task opsional.
alter table public.tasks add column if not exists description text;

drop policy if exists "Anon dapat membaca task" on public.tasks;
drop policy if exists "Anon dapat menambah task" on public.tasks;
drop policy if exists "Anon dapat mengubah task" on public.tasks;
drop policy if exists "Anon dapat menghapus task" on public.tasks;
drop policy if exists "Pemilik dapat mengelola task" on public.tasks;

-- USING memeriksa pemilik baris lama. WITH CHECK memeriksa pemilik baris baru.
create policy "Pemilik dapat mengelola task"
  on public.tasks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- GRANT memberi izin operasi pada tabel. Policy RLS di atas menentukan baris yang boleh diakses.
revoke all on table public.tasks from public, anon, authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;

commit;
