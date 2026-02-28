// Konfigurasi WhatsApp Scheduler
// Format nomor: Gunakan kode negara tanpa +, contoh: 6281234567890

module.exports = {
  // Pesan yang akan dikirim
  message: "Selamat siang mohon ijin memperkenalkan diri dengan kami Letda Laut (E) Abdul Aziz Anaoval, S. Kom NRP 2225101020028400 PAPK 32B sebagai Paurmin Ka Pusdalops Mabes TNI Alumni Universitas Pelita Bangsa Jurusan Teknik Informatika asal Bekasi Selanjutnya mohon ijin arahan terimakasih mohon ijin",

  // Batch jadwal pengiriman
  schedules: [
    {
      "name": "PK31",
      "time": "12:10",
      "recipients": [
        "6281294761235"
      ],
      "media": null
    }
  ],

  // Konfigurasi Media
  media: {
    enabled: false,
    type: "image",
    path: "./media/attachment.jpg",
    caption: ""
  },

  // Konfigurasi Retry
  retry: {
    enabled: true,
    maxAttempts: 3,
    delayMs: 30000,
    retryOnErrors: ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND"]
  },

  // Konfigurasi Logging
  logging: {
    enabled: true,
    logFolder: "./logs",
    logMode: "daily",
    exportCsv: true,
    csvFolder: "./logs/exports"
  },

  // Konfigurasi Contacts
  contacts: {
    filePath: "./contacts.json"
  },

  // Konfigurasi tambahan
  options: {
    minDelay: 8000,
    maxDelay: 15000,
    allowedDays: [0,1,2,3,4,5,6],
    weekdaysOnly: false
  }
};
