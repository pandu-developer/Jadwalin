# Jadwalin

> Atur task, deadline, dan jadwalmu dalam satu tempat.

**Jadwalin** adalah aplikasi To-Do List berbahasa Indonesia untuk mengelola task, prioritas, dan deadline. Data tiap pengguna tersimpan aman di Supabase dan hanya bisa diakses oleh pemiliknya berkat Row Level Security (RLS).

## ✨ Fitur

- **Autentikasi** — Daftar akun & masuk dengan email/kata sandi via Supabase Auth.
- **Timeline (Gantt)** — Batang task berjalan dari tanggal task dibuat (`created_at`) sampai `deadline`, sehingga lama pengerjaan terlihat sekilas. Dimulai dari hari ini.
- **Daftar task** — Filter status (All / To Do / In Progress / Done) dan prioritas (Tinggi / Sedang / Rendah), plus pencarian judul.
- **Kalender** — Tampilan bulanan dengan titik warna sesuai prioritas; klik tanggal untuk melihat task + deskripsinya.
- **Arsip** — Arsipkan task, pulihkan, atau hapus permanen.
- **Deskripsi** — Setiap task bisa punya catatan tambahan (opsional), tampil di bawah judul.
- **Deadline & jam** — Badge "Hari ini" / "Terlambat" diperbarui otomatis.
- **Auto-selesai 24/7** — Task terlambat otomatis berubah menjadi **Done** lewat job `pg_cron` di Supabase, **walau web tidak dibuka**. Klien juga mengecek tiap 15 detik sebagai respons cepat saat aplikasi aktif. Keduanya memakai aturan yang sama.
- **Progres** — Progress bar menghitung task aktif yang sudah selesai.

## 🛠️ Teknologi

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | HTML, CSS, JavaScript ES Modules (vanilla, tanpa framework) |
| Backend | Supabase (PostgreSQL + Auth + Row Level Security) |
| Library | `@supabase/supabase-js@2` via CDN |
| Font | Instrument Sans (Google Fonts) |
| Linting | ESLint |

Tidak ada build step. Cukup buka lewat HTTP server.

## 📁 Struktur project

| File | Fungsi |
|------|--------|
| `index.html` | Halaman auth, workspace, 4 view, dialog tambah/edit, template kartu task |
| `script.js` | Seluruh logika: auth, CRUD, state, render, filter, timer auto-complete |
| `style.css` | Palet warna, layout grid, timeline, kalender, dialog |
| `database.sql` | Skema tabel `public.tasks` + policy RLS (jalankan di Supabase) |
| `cron.sql` | Job `pg_cron` auto-selesai tiap menit (jalankan di Supabase, opsional tapi direkomendasikan) |
| `config.js` | `SUPABASE_URL` dan `SUPABASE_ANON_KEY` |
| `eslint.config.js` | Aturan ESLint |
| `package.json` | Script `npm run lint` |
| `.gitignore` | Daftar file yang tidak di-push (node_modules, .env, log, dll.) |

## 🚀 Cara menjalankan

Karena projekt memakai ES Module dan Supabase CDN, **jangan dibuka langsung lewat `file://`**. Gunakan HTTP server:

```bash
# Opsi 1 — Python
python -m http.server 8000

# Opsi 2 — Node
npx serve .
```

Lalu buka `http://localhost:8000`.

### Opsional: menjalankan lint

```bash
npm install
npm run lint
```

## ⚙️ Menyiapkan Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan seluruh isi `database.sql`.
   - SQL ini idempoten, aman dijalankan ulang.
   - Membuat tabel `public.tasks` beserta kolom `description`, `user_id`, `archived_at`, `deadline_time`.
   - Mengaktifkan RLS dengan policy: pengguna hanya bisa mengelola task miliknya sendiri.
3. Isi `config.js` dengan **Project URL** dan **anon key** dari dashboard Supabase (menu *Project Settings → API*).
4. **Untuk auto-selesai 24/7:** masih di **SQL Editor**, jalankan seluruh isi `cron.sql` (lihat bagian berikutnya).

> `anon key` berprefix `sb_publishable_...` memang dirancang untuk dipakai di browser dan aman di-commit karena aksesnya dibatasi RLS. Jika ingin menyembunyikannya, aktifkan baris `config.js` di `.gitignore`, buat `config.example.js` sebagai template, lalu isi sendiri setelah clone.

## ⏰ Auto-selesai tanpa web dibuka (pg_cron)

`script.js` hanya bisa mengecek saat browser terbuka. Agar deadline tetap ter-update saat web ditutup, jalankan `cron.sql` **sekali saja** di **Supabase Dashboard → SQL Editor**.

File itu akan:

1. Mengaktifkan ekstensi `pg_cron` (jika belum).
2. Mendaftarkan job bernama `jadwalin-auto-selesai` yang berjalan **tiap 1 menit**.
3. Mengubah `status = 'done'` untuk task aktif yang lewat deadline, dengan aturan identik dengan `isOverdue()` di klien:
   - tanpa jam → terlambat setelah tanggalnya berganti;
   - dengan jam → terlambat setelah jam tersebut lewat (dibulatkan ke menit);
   - task yang sudah `done` atau diarsipkan tidak disentuh.

Catatan:

- Job memakai zona waktu **Asia/Jakarta (WIB)**. Kalau pakai WITA/WIT, ganti semua `'Asia/Jakarta'` di `cron.sql` sesuai zona kamu.
- File ini **idempoten**: aman dijalankan ulang (jadwal lama dihapus dulu, jadi tidak dobel).
- Kalau ekstensi belum tersedia, aktifkan dulu lewat **Dashboard → Database → Extensions → pg_cron**.
- Job dijalankan sebagai peran `postgres` (pemilik tabel), sehingga RLS tidak membatasi pembaruan — task **semua pengguna** ikut ter-update, bukan hanya satu akun.

Cek apakah job berjalan:

```sql
select jobid, schedule, command from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
```

Menghentikan sementara:

```sql
select cron.unschedule('jadwalin-auto-selesai');
```

## 📤 Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit - Jadwalin"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

File seperti `node_modules/`, `.env`, log, dan file sistem tidak akan ikut ter-push berkat `.gitignore`.

## 📝 Catatan

Auto-selesai bekerja berlapis:

- **Database (`cron.sql`)** → sumber kebenaran, jalan 24/7 tiap menit walaupun browser tertutup.
- **Klien (`script.js`)** → pengecekan instan tiap 15 detik / saat jendela difokuskan, supaya perubahan langsung terlihat tanpa menunggu job berikutnya.

Keduanya memakai aturan deadline yang sama, jadi tidak akan saling bertentangan. Cukup jalankan `cron.sql` sekali di Supabase; tidak perlu Edge Function atau server tambahan.
