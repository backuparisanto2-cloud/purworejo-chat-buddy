# Halaman Admin di Statistik (khusus Owner)

Menggabungkan daftar percakapan, status chat, dan statistik pengguna ke halaman **Statistik** yang sudah ada, dan menguncinya hanya untuk akun berperan Owner (saat ini diskominfopurworejo@gmail.com).

## Yang akan terlihat

1. **Kartu ringkasan** (tetap seperti sekarang): percakapan hari ini, minggu ini, menunggu agent, rata-rata waktu respon.
2. **Grafik & kategori** (tetap): pesan masuk 7 hari dan kategori pertanyaan terbanyak.
3. **Baru — Daftar Percakapan**: tabel berisi nama/nomor warga, status chat (Bot Aktif / Menunggu Agent / Ditangani Agent / Selesai), agent yang menangani, jumlah pesan, dan waktu pesan terakhir. Ada kotak pencarian dan filter status, plus tombol menuju percakapan tersebut di Inbox.
4. **Baru — Statistik Pengguna**: jumlah warga unik, warga baru minggu ini, rata-rata pesan per warga, dan daftar warga paling aktif (jumlah pesan dan kontak terakhir).
5. **Kinerja Agent** (tetap di bagian bawah).

## Hak akses

- Akun bukan Owner yang membuka halaman ini melihat pesan "Halaman khusus Owner", bukan data.
- Menu "Statistik" di sidebar hanya muncul untuk Owner.
- Pengecekan juga dilakukan di sisi server: data hanya dikirim bila akun pemanggil benar-benar Owner, jadi tidak bisa diakali dari browser.

## Catatan teknis

- `src/lib/statistics.functions.ts`: tambah pengecekan peran Owner (RPC `has_role`) di awal `getStatistics`; tambah server function `getAdminOverview` (juga Owner-only) yang mengembalikan daftar percakapan (join `conversations` + `contacts`, hitung pesan per percakapan) dan agregat pengguna dari tabel `contacts`/`messages`.
- `src/routes/_authenticated/statistik.tsx`: render dua bagian baru (tabel percakapan dengan filter status + pencarian, kartu statistik pengguna) memakai komponen `Table`, `Input`, `Select`, `Badge` yang sudah ada; tampilkan state Owner-only bila `useAuth().isOwner` bernilai false.
- `src/components/app-shell.tsx`: saring item nav `Statistik` berdasarkan `isOwner`.
- Tidak ada perubahan skema database atau migrasi baru; semua query memakai tabel dan kebijakan RLS yang sudah ada lewat `requireSupabaseAuth`.
