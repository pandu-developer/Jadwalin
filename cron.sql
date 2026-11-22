begin;

-- ============================================================
-- AUTO-SELESAI 24/7 — dijalankan di Supabase, tidak butuh web dibuka
-- ============================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste & jalankan seluruh isi file ini sekali saja
--   3. Selesai. Job akan berjalan tiap 1 menit otomatis.
--
-- Catatan zona waktu:
--   Job memakai 'Asia/Jakarta' (WIB). Jika pengguna berada di zona beda
--   (WITA/WIT), ganti semua 'Asia/Jakarta' di bawah sesuai zona tersebut.
-- ============================================================

-- Aktifkan ekstensi pg_cron (jika belum). Bisa juga lewat
-- Dashboard → Database → Extensions → pg_cron.
create extension if not exists pg_cron with schema extensions;

-- Hapus jadwal lama jika file ini dijalankan ulang, agar tidak dobel.
do $$
begin
  perform cron.unschedule('jadwalin-auto-selesai');
exception when others then
  null;
end $$;

-- Daftarkan job tiap 1 menit.
-- Logika sama dengan isOverdue() di script.js:
--   • task tanpa jam  -> terlambat setelah hari berganti
--   • task dengan jam -> terlambat setelah jam tersebut lewat
-- Status diubah hanya untuk task aktif (belum diarsipkan) dan belum done.
select cron.schedule(
  'jadwalin-auto-selesai',
  '*/1 * * * *',
  $$
    update public.tasks
    set status = 'done'
    where status <> 'done'
      and archived_at is null
      and deadline is not null
      and (
        deadline < (now() at time zone 'Asia/Jakarta')::date
        or (
          deadline = (now() at time zone 'Asia/Jakarta')::date
          and deadline_time is not null
          -- Dibulatkan ke menit agar sama persis dengan isOverdue() di script.js.
          and deadline_time < to_char(now() at time zone 'Asia/Jakarta', 'HH24:MI')::time
        )
      );
  $$
);

commit;

-- ------------------------------------------------------------
-- Pengecekan manual (opsional):
--   select jobid, schedule, command from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--
-- Menghentikan job:
--   select cron.unschedule('jadwalin-auto-selesai');
-- ------------------------------------------------------------
