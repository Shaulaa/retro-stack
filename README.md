# Retro Stack

Retro Stack adalah game puzzle bergaya arcade klasik yang dibuat menggunakan HTML, CSS, dan JavaScript murni. Susun balok yang jatuh, hapus baris sebanyak mungkin, dan raih skor tertinggi dengan tampilan retro neon.

## Fitur

- Mode Marathon untuk bermain selama mungkin
- Mode Sprint 40 untuk menyelesaikan 40 baris secepat mungkin
- Sistem skor, level, combo, dan rekor tertinggi
- Fitur hold untuk menyimpan satu balok
- Tampilan tiga balok berikutnya
- Ghost piece untuk membantu memperkirakan posisi jatuh
- Dukungan T-spin dan Tetris
- Efek suara yang dapat dinyalakan atau dimatikan
- Kontrol keyboard dan tombol sentuh untuk perangkat mobile
- Rekor tersimpan otomatis di browser
- Tampilan kabinet arcade dengan efek scanline

## Cara Menjalankan

1. Clone repository ini
2. Buka folder project
3. Buka file `index.html` di browser
4. Pilih mode Marathon atau Sprint 40

Game ini tidak membutuhkan instalasi package atau server khusus. Kamu juga dapat menjalankannya dengan ekstensi Live Server di VS Code.

## Kontrol Keyboard

| Tombol | Fungsi |
| --- | --- |
| Panah kiri | Menggeser balok ke kiri |
| Panah kanan | Menggeser balok ke kanan |
| Panah bawah | Menurunkan balok lebih cepat |
| Panah atas | Memutar balok |
| Spasi | Menjatuhkan balok secara instan |
| C | Menyimpan atau mengambil balok dari hold |
| P | Menjeda atau melanjutkan permainan |
| M | Menyalakan atau mematikan suara |

## Kontrol Mobile

Pada layar kecil, tombol kontrol akan muncul di bawah papan permainan. Tombol tersebut menyediakan fungsi hold, geser, putar, turun, jatuh instan, dan jeda.

## Mode Permainan

### Marathon

Bermain tanpa batas baris. Kecepatan balok akan meningkat setiap kali jumlah baris yang dihapus bertambah sepuluh.

### Sprint 40

Selesaikan 40 baris secepat mungkin. Waktu terbaik akan disimpan di browser dan dapat digunakan untuk mengejar rekor baru.

## Struktur Project

| File | Keterangan |
| --- | --- |
| `index.html` | Struktur halaman dan elemen antarmuka game |
| `style.css` | Tampilan visual, layout, dan responsivitas |
| `game.js` | Logika permainan, kontrol, skor, animasi, dan suara |

## Teknologi

- HTML5 Canvas
- CSS3
- JavaScript
- Web Audio API
- Local Storage

## Catatan

Rekor tersimpan menggunakan penyimpanan lokal browser. Data tersebut hanya tersedia pada browser dan perangkat yang sama.

## Lisensi

Project ini dibuat untuk tujuan pembelajaran dan eksperimen web game.