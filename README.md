# WhatsApp Scheduler

Aplikasi WhatsApp otomatis untuk menjadwalkan pengiriman pesan dengan fitur media attachments, manajemen kontak, retry mechanism, dan logging.

## ✨ Fitur

- 📅 **Penjadwalan Pesan** - Kirim pesan terjadwal ke banyak penerima
- 📎 **Media Attachments** - Kirim gambar, dokumen, audio, atau video
- 👥 **Manajemen Kontak** - Kelola grup kontak yang bisa reusable
- 🔄 **Auto Retry** - Kirim ulang otomatis jika gagal
- 📊 **Logging** - Log semua aktivitas pengiriman
- 📥 **Import CSV** - Import kontak dari file CSV

## 📋 Persiapan

1. **Clone repo:**
```bash
git clone https://github.com/noval1802/whatsapp-scheduler.git
cd whatsapp-scheduler
```

2. **Install dependencies:**
```bash
npm install
```

3. **Jalankan:**
```bash
npm run menu   # Buka menu interaktif
# atau
npm start      # Langsung jalankan scheduler
```

4. **Scan QR Code** dengan WhatsApp kamu

## 🔧 Konfigurasi

Edit `config.js` atau gunakan menu interaktif:

### Media
```javascript
media: {
  enabled: false,      // Aktifkan/nonaktifkan
  type: "image",       // image, document, audio, video
  path: "./media/foto.jpg",  // Path file
  caption: ""          // Caption untuk gambar/video
}
```

### Retry
```javascript
retry: {
  enabled: true,
  maxAttempts: 3,      // Maksimal percobaan
  delayMs: 30000       // Delay antar retry (ms)
}
```

### Logging
```javascript
logging: {
  enabled: true,
  logFolder: "./logs",
  exportCsv: true      // Export ke CSV
}
```

## 📱 Cara Penggunaan

### Menu Interaktif
```bash
npm run menu
```

Menu tersedia:
1. Lihat Jadwal
2. Tambah Jadwal
3. Edit Jadwal
4. Hapus Jadwal
5. Edit Pesan Default
6. Konfigurasi Media
7. Konfigurasi Retry
8. Manajemen Kontak
9. Lihat Log
10. Jalankan Scheduler

### Manajemen Kontak
Buat grup kontak untuk reuse di多个 jadwal:
- Tambah grup dengan kontak
- Import dari CSV (format: nama,nomor)
- Pilih grup saat membuat jadwal

### Format Nomor
Gunakan kode negara tanpa +:
```
6281234567890  ✅
+6281234567890 ❌
```

## 📁 Struktur File

```
whatsapp-scheduler/
├── config.js         # Konfigurasi utama
├── contacts.json     # Data kontak
├── index.js          # Core logic
├── menu.js           # Menu interaktif
├── package.json      # Dependencies
├── logs/             # Log files
└── media/            # Folder untuk media
```

## ⚠️ Catatan

- Harus scan QR Code sekali untuk autentikasi
- Session tersimpan di folder `session/`
- Jeda antar pesan: 8-15 detik (random)
- Hanya satu instance yang bisa berjalan

## 📄 Lisensi

MIT
