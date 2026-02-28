const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const config = require('./config');

console.log('🚀 WhatsApp Scheduler Starting...');
console.log('='.repeat(50));

// ===== LOGGING SYSTEM =====
const logSystem = {
  logFolder: path.join(__dirname, config.logging.logFolder || './logs'),
  csvFolder: path.join(__dirname, config.logging.csvFolder || './logs/exports'),
  
  // Ensure directories exist
  init() {
    if (!config.logging.enabled) return;
    if (!fs.existsSync(this.logFolder)) {
      fs.mkdirSync(this.logFolder, { recursive: true });
    }
    if (config.logging.exportCsv && !fs.existsSync(this.csvFolder)) {
      fs.mkdirSync(this.csvFolder, { recursive: true });
    }
  },
  
  // Get log file path
  getLogPath() {
    if (!config.logging.enabled) return null;
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logFolder, `sending-${date}.log`);
  },
  
  // Write to log file
  write(status, phone, message, error = null) {
    if (!config.logging.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status} | ${phone} | "${message.substring(0, 50)}..." | ${error || 'OK'}\n`;
    
    const logPath = this.getLogPath();
    if (logPath) {
      fs.appendFileSync(logPath, logEntry);
    }
    
    // Also store in memory for CSV export
    this.lastLogs = this.lastLogs || [];
    this.lastLogs.push({
      timestamp,
      status,
      phone,
      message: message.substring(0, 100),
      error: error || ''
    });
  },
  
  // Export to CSV
  exportCsv(filename = null) {
    if (!config.logging.exportCsv || !this.lastLogs || this.lastLogs.length === 0) {
      console.log('❌ Tidak ada data untuk diexport');
      return;
    }
    
    const csvFilename = filename || `export-${new Date().toISOString().split('T')[0]}.csv`;
    const csvPath = path.join(this.csvFolder, csvFilename);
    
    const header = 'Timestamp,Status,Phone,Message,Error\n';
    const rows = this.lastLogs.map(log => 
      `"${log.timestamp}","${log.status}","${log.phone}","${log.message.replace(/"/g, '""')}","${log.error}"`
    ).join('\n');
    
    fs.writeFileSync(csvPath, header + rows);
    console.log(`✅ Log diexport ke: ${csvPath}`);
    this.lastLogs = []; // Clear after export
  },
  
  lastLogs: []
};

// Initialize logging
logSystem.init();

// ===== RETRY MECHANISM =====
const retrySystem = {
  failedMessages: [],
  
  async executeWithRetry(fn, phone, message, media = null) {
    if (!config.retry.enabled) {
      return await fn();
    }
    
    let attempts = 0;
    const maxAttempts = config.retry.maxAttempts || 3;
    
    while (attempts < maxAttempts) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        attempts++;
        const shouldRetry = config.retry.retryOnErrors.some(e => 
          error.message.includes(e)
        );
        
        if (attempts >= maxAttempts || !shouldRetry) {
          // Save to failed messages for manual retry
          this.failedMessages.push({
            phone,
            message,
            media,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          throw error;
        }
        
        console.log(`   ⚠️ Attempt ${attempts}/${maxAttempts} gagal, retry dalam ${config.retry.delayMs/1000} detik...`);
        await new Promise(resolve => setTimeout(resolve, config.retry.delayMs));
      }
    }
  },
  
  getFailedMessages() {
    return this.failedMessages;
  },
  
  clearFailedMessages() {
    this.failedMessages = [];
  },
  
  retryFailed() {
    return this.failedMessages;
  }
};

// ===== MEDIA HANDLER =====
const mediaHandler = {
  // Load media file
  async loadMedia(mediaConfig) {
    if (!mediaConfig || !mediaConfig.path) return null;
    
    const mediaPath = path.isAbsolute(mediaConfig.path) 
      ? mediaConfig.path 
      : path.join(__dirname, mediaConfig.path);
    
    if (!fs.existsSync(mediaPath)) {
      console.log(`   ⚠️ Media file tidak ditemukan: ${mediaPath}`);
      return null;
    }
    
    try {
      const media = await MessageMedia.fromFilePath(mediaPath);
      
      // Set mime type based on config
      if (mediaConfig.type === 'image') {
        // Default mime type is usually set correctly from file
      } else if (mediaConfig.type === 'audio') {
        media.mimetype = 'audio/ogg; codecs=opus'; // WhatsApp audio format
      } else if (mediaConfig.type === 'document') {
        // Document keeps original mimetype
      }
      
      if (mediaConfig.caption) {
        media.caption = mediaConfig.caption;
      }
      
      return media;
    } catch (error) {
      console.log(`   ⚠️ Gagal load media: ${error.message}`);
      return null;
    }
  }
};

// ===== MAIN CLIENT =====
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: 'session'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    timeout: 120000
  }
});

// Status koneksi
let isReady = false;
let scheduledJobs = [];
let todaySent = {}; // Track yang sudah dikirim hari ini
let lastResetDate = '';

// Tampilkan QR Code saat dibutuhkan
client.on('qr', (qr) => {
  console.log('\n📱 SILAHKAN SCAN QR CODE DI BAWAH INI:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n' + '='.repeat(50));
});

client.on('authenticated', () => {
  console.log('✅ Autentikasi berhasil! Terhubung dengan WhatsApp Web');
});

client.on('ready', () => {
  console.log('✅ WhatsApp siap digunakan!');
  isReady = true;
  
  // Reset tracker dan jadwalkan ulang
  todaySent = {};
  lastResetDate = new Date().toDateString();
  scheduledJobs = [];
  
  scheduleAllJobs();
});

client.on('disconnected', () => {
  console.log('❌ Terputus dari WhatsApp Web');
  isReady = false;
});

// Fungsi untuk membersihkan semua job
function cancelAllJobs() {
  scheduledJobs.forEach(job => {
    if (job) job.cancel();
  });
  scheduledJobs = [];
}

// Fungsi untuk mendapatkan random delay
function getRandomDelay() {
  const minDelay = config.options.minDelay || 8000;
  const maxDelay = config.options.maxDelay || 15000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

// Fungsi untuk mengirim pesan dengan media dan retry
async function sendMessage(phoneNumber, message, mediaConfig = null) {
  if (!isReady) {
    console.log(`❌ [${phoneNumber}] WhatsApp belum siap, pesan gagal dikirim`);
    logSystem.write('FAILED', phoneNumber, message, 'WhatsApp not ready');
    return false;
  }

  // Determine media config (batch specific or global)
  const finalMediaConfig = mediaConfig || (config.media.enabled ? config.media : null);
  
  // Load media if configured
  let media = null;
  if (finalMediaConfig && finalMediaConfig.enabled) {
    media = await mediaHandler.loadMedia(finalMediaConfig);
  }

  // Send function with retry
  const sendFn = async () => {
    const formattedNumber = phoneNumber.includes('@c.us') 
      ? phoneNumber 
      : `${phoneNumber}@c.us`;

    if (media) {
      // Send with media
      await client.sendMessage(formattedNumber, media);
    } else {
      // Text only
      await client.sendMessage(formattedNumber, message);
    }
  };

  try {
    await retrySystem.executeWithRetry(sendFn, phoneNumber, message, finalMediaConfig);
    console.log(`✅ [${phoneNumber}] Pesan terkirim: "${message.substring(0, 30)}..."${media ? ' [Media]' : ''}`);
    logSystem.write('SUCCESS', phoneNumber, message);
    return true;
  } catch (error) {
    console.log(`❌ [${phoneNumber}] Gagal mengirim pesan: ${error.message}`);
    logSystem.write('FAILED', phoneNumber, message, error.message);
    return false;
  }
}

// Fungsi untuk mengirim pesan batch
async function sendBatch(recipients, message, batchName, mediaConfig = null) {
  console.log(`\n📤 Memulai ${batchName} - ${recipients.length} penerima...`);
  
  for (let i = 0; i < recipients.length; i++) {
    const phone = recipients[i];
    console.log(`   Mengirim ke ${phone} (${i + 1}/${recipients.length})...`);
    
    await sendMessage(phone, message, mediaConfig);
    
    // Jeda antar pesan (kecuali pesan terakhir)
    if (i < recipients.length - 1) {
      const delay = getRandomDelay();
      console.log(`   ⏳ Menunggu ${delay / 1000} detik...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`✅ ${batchName} selesai!\n`);
  
  // Export logs after batch complete
  if (config.logging.exportCsv) {
    logSystem.exportCsv();
  }
}

// Fungsi untuk menjadwalkan semua batch
function scheduleAllJobs() {
  console.log('\n📅 Menjadwalkan pengiriman...\n');

  // Reset tracker setiap hari baru
  const today = new Date().toDateString();
  if (lastResetDate !== today) {
    todaySent = {};
    lastResetDate = today;
    console.log('🔄 Reset tracker pengiriman harian\n');
  }

  config.schedules.forEach((batch, index) => {
    const [hours, minutes] = batch.time.split(':').map(Number);
    
    const job = schedule.scheduleJob({ hour: hours, minute: minutes }, async () => {
      const batchKey = `${batch.name}-${new Date().toDateString()}`;
      
      // Cek jika sudah dikirim hari ini
      if (todaySent[batchKey]) {
        console.log(`\n⏭️ ${batch.name} sudah dikirim hari ini, dilewati`);
        return;
      }
      
      const todayDay = new Date().getDay();
      
      // Cek hari yang diizinkan
      if (config.options.allowedDays && !config.options.allowedDays.includes(todayDay)) {
        console.log(`\n⏭️ ${batch.name} dilewati - bukan hari yang diizinkan`);
        return;
      }
      
      // Cek weekdays only
      if (config.options.weekdaysOnly && (todayDay === 0 || todayDay === 6)) {
        console.log(`\n⏭️ ${batch.name} dilewati - hari weekend`);
        return;
      }
      
      // Tandai sebagai sudah dikirim
      todaySent[batchKey] = true;
      
      // Get media config for this batch (or use global)
      const mediaConfig = batch.media || (config.media.enabled ? config.media : null);
      
      console.log(`\n🕐 Waktu pengiriman tercapai: ${batch.time}`);
      await sendBatch(batch.recipients, config.message, batch.name, mediaConfig);
    });

    scheduledJobs.push(job);
    console.log(`   📌 ${batch.name}: ${batch.time} - ${batch.recipients.length} penerima${batch.media ? ' [Media]' : ''}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Semua jadwal telah diatur!');
  console.log('   Tunggu hingga waktu pengiriman...');
  console.log('   Tekan Ctrl+C untuk berhenti\n');
}

// ===== EXPORT FUNCTIONS FOR MENU =====
module.exports = {
  logSystem,
  retrySystem,
  client,
  sendMessage,
  sendBatch,
  cancelAllJobs
};
