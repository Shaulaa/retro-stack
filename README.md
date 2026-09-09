# Retro Stack

Game bertumpuk balok bergaya arcade CRT retro. Ditulis pakai HTML/CSS/JS murni (tanpa build tool, tanpa dependency).

## Fitur

- 7-bag randomizer, hold piece, antrean 3 balok berikutnya
- Lock delay, DAS (auto-repeat gerak), animasi hard-drop yang smooth
- Deteksi T-spin, combo counter, notifikasi naik level
- Mode Marathon (endless) & Sprint 40 baris
- Skor tertinggi tersimpan permanen per mode (localStorage)
- Efek suara sintesis (tanpa file audio eksternal)
- Kontrol keyboard + tombol sentuh untuk mobile, layout responsif

## Cara main

Cukup buka `index.html` di browser — tidak butuh server atau build step.

## Deploy ke GitHub Pages

1. Push ketiga file (`index.html`, `style.css`, `game.js`) ke repo GitHub.
2. Buka **Settings → Pages** di repo tersebut.
3. Di bagian **Source**, pilih branch `main` (atau branch tempat file ini berada) dan folder `/ (root)`.
4. Simpan — GitHub akan memberi URL publik (biasanya `https://<username>.github.io/<nama-repo>/`) dalam beberapa menit.

## Kontrol

| Aksi | Keyboard | Sentuh |
|---|---|---|
| Geser kiri/kanan | ← → | ◀ ▶ |
| Turun cepat | ↓ | ▼ |
| Putar | ↑ | ⟳ |
| Jatuh instan | Spasi | JATUH |
| Tahan balok | C | HOLD |
| Jeda | P | JEDA |
| Suara on/off | M | — |
