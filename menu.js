const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const CONFIG_FILE = path.join(__dirname, 'config.js');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function loadConfig() {
  try { return require(CONFIG_FILE); } catch (e) { return null; }
}

function loadContacts() {
  try { if (fs.existsSync(CONTACTS_FILE)) return require(CONTACTS_FILE); } catch (e) {}
  return { groups: {}, lastUpdated: null };
}

function saveContacts(contacts) {
  contacts.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2), 'utf-8');
}

// Helper untuk simpan config
function saveConfig(config) {
  const content = `// Konfigurasi WhatsApp Scheduler
// Format nomor: Gunakan kode negara tanpa +, contoh: 6281234567890

module.exports = {
  // Pesan yang akan dikirim
  message: ${JSON.stringify(config.message)},

  // Batch jadwal pengiriman
  schedules: ${JSON.stringify(config.schedules, null, 2)},

  // Konfigurasi tambahan
  options: {
    // Jeda antar pesan (dalam milidetik)
    minDelay: ${config.options.minDelay},   // Delay minimum
    maxDelay: ${config.options.maxDelay},  // Delay maximum
    
    // Hari-hari hari yang diizinkan (0 = Minggu, 1 = Senin, ..., 6 = Sabtu)
    allowedDays: ${JSON.stringify(config.options.allowedDays)},
    
    // Hanya mengirim jika hari ini adalah hari kerja (Senin-Jumat)
    weekdaysOnly: ${config.options.weekdaysOnly}
  }
};
`;
  fs.writeFileSync(CONFIG_FILE, content, 'utf-8');
}

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         📱 WhatsApp Scheduler - Menu Utama                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
}

function printSchedules(config) {
  console.log('\n📋 JADWAL TERKINI:\n');
  console.log('┌─────┬────────────────────┬───────────┬────────────────────────────────┐');
  console.log('│ No. │ Nama Batch         │ Waktu     │ Penerima                      │');
  console.log('├─────┼────────────────────┼───────────┼────────────────────────────────┤');
  
  if (config.schedules.length === 0) {
    console.log('│     │ Tidak ada jadwal   │           │                                │');
  } else {
    config.schedules.forEach((schedule, index) => {
      const recipients = schedule.recipients.join(', ');
      const paddedRecipients = recipients.length > 30 
        ? recipients.substring(0, 27) + '...' 
        : recipients.padEnd(30);
      console.log(`│ ${(index + 1).toString().padStart(3)} │ ${schedule.name.padEnd(18)} │ ${schedule.time.padEnd(9)} │ ${paddedRecipients} │`);
    });
  }
  console.log('└─────┴────────────────────┴───────────┴────────────────────────────────┘');
  console.log('\n📝 Pesan Default: ' + config.message.substring(0, 50) + (config.message.length > 50 ? '...' : ''));
  console.log('⏱️ Delay: ' + (config.options.minDelay / 1000) + '-' + (config.options.maxDelay / 1000) + ' detik (random)');
}

// Promise-based question
function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Async functions untuk setiap menu
async function viewSchedules() {
  const config = loadConfig();
  if (!config) {
    console.log('❌ Gagal memuat konfigurasi!');
    return;
  }
  
  printSchedules(config);
  console.log('\n');
  await ask('Tekan Enter untuk kembali...');
}

async function addSchedule() {
  const config = loadConfig();
  if (!config) {
    console.log('❌ Gagal memuat konfigurasi!');
    return;
  }

  console.log('\n➕ TAMBAH JADWAL BARU\n');
  
  const name = await ask('Nama Batch: ');
  if (!name.trim()) {
    console.log('❌ Nama tidak boleh kosong!');
    return;
  }

  let time = '';
  while (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    time = await ask('Waktu (HH:MM format 24 jam, contoh 20:30): ');
  }

  const recipientsInput = await ask('Nomor Penerima (pisahkan dengan koma): ');
  const recipients = recipientsInput
    .split(',')
    .map(r => r.trim().replace(/\D/g, ''))
    .filter(r => r.length > 0);

  if (recipients.length === 0) {
    console.log('❌ Tidak ada nomor yang valid!');
    return;
  }

  const newSchedule = {
    name: name,
    time: time,
    recipients: recipients
  };

  config.schedules.push(newSchedule);
  saveConfig(config);
  
  console.log('\n✅ Jadwal berhasil ditambahkan!');
  console.log(`   Nama: ${newSchedule.name}`);
  console.log(`   Waktu: ${newSchedule.time}`);
  console.log(`   Penerima: ${recipients.length} nomor`);
  await ask('\nTekan Enter untuk kembali...');
}

async function editSchedule() {
  const config = loadConfig();
  if (!config) {
    console.log('❌ Gagal memuat konfigurasi!');
    return;
  }

  if (config.schedules.length === 0) {
    console.log('\n❌ Tidak ada jadwal untuk diedit!');
    await ask('\nTekan Enter untuk kembali...');
    return;
  }

  printSchedules(config);
  
  console.log('\nPilih jadwal (1-' + config.schedules.length + ') atau 0 untuk batal: ');
  const idxInput = await ask('> ');
  const idx = parseInt(idxInput) - 1;
  
  if (isNaN(idx) || idx < 0 || idx >= config.schedules.length) return;

  const schedule = config.schedules[idx];
  
  console.log(`\nEdit "${schedule.name}":`);
  console.log('  1. Nama');
  console.log('  2. Waktu');
  console.log('  3. Tambah Penerima');
  console.log('  4. Hapus Semua Penerima');
  console.log('  5. Batal');
  
  const editType = await ask('Pilih (1-5): ');

  switch (editType) {
    case '1':
      const newName = await ask('Nama baru: ');
      schedule.name = newName;
      break;
    case '2':
      let newTime = '';
      while (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(newTime)) {
        newTime = await ask('Waktu baru (HH:MM): ');
      }
      schedule.time = newTime;
      break;
    case '3':
      const newRecipients = await ask('Nomor baru (pisahkan dengan koma): ');
      const newNums = newRecipients.split(',').map(r => r.trim().replace(/\D/g, '')).filter(r => r.length > 0);
      schedule.recipients.push(...newNums);
      console.log(`   Ditambahkan ${newNums.length} nomor`);
      break;
    case '4':
      schedule.recipients = [];
      console.log('   Semua penerima dihapus');
      break;
    default:
      return;
  }

  saveConfig(config);
  console.log('\n✅ Jadwal berhasil diupdate!');
  await ask('\nTekan Enter untuk kembali...');
}

async function deleteSchedule() {
  const config = loadConfig();
  if (!config) {
    console.log('❌ Gagal memuat konfigurasi!');
    return;
  }

  if (config.schedules.length === 0) {
    console.log('\n❌ Tidak ada jadwal untuk dihapus!');
    await ask('\nTekan Enter untuk kembali...');
    return;
  }

  printSchedules(config);

  const idxInput = await ask('\nPilih jadwal yang akan dihapus (1-' + config.schedules.length + ') atau 0 untuk batal: ');
  const idx = parseInt(idxInput) - 1;
  
  if (isNaN(idx) || idx < 0 || idx >= config.schedules.length) return;

  const deleted = config.schedules.splice(idx, 1)[0];
  
  saveConfig(config);
  console.log(`\n✅ Jadwal "${deleted.name}" berhasil dihapus!`);
  await ask('\nTekan Enter untuk kembali...');
}

async function editMessage() {
  const config = loadConfig();
  if (!config) {
    console.log('❌ Gagal memuat konfigurasi!');
    return;
  }

  console.log('\n📝 EDIT PESAN DEFAULT\n');
  console.log('Pesan saat ini: ' + config.message);
  
  const message = await ask('Pesan baru: ');
  if (!message.trim()) {
    console.log('❌ Pesan tidak boleh kosong!');
    return;
  }

  config.message = message;
  saveConfig(config);
  console.log('\n✅ Pesan berhasil diupdate!');
  await ask('\nTekan Enter untuk kembali...');
}

async function manageMedia() {
  const config = loadConfig();
  if (!config) { console.log('❌ Gagal!'); return; }
  
  console.log('\n📎 KONFIGURASI MEDIA\n');
  console.log('   Enable: ' + (config.media && config.media.enabled ? '✅ Ya' : '❌ Tidak'));
  if (config.media) {
    console.log('   Type: ' + (config.media.type || 'image'));
    console.log('   Path: ' + (config.media.path || '-'));
    console.log('   Caption: ' + (config.media.caption || '-'));
  }
  
  console.log('\n1. Enable/Disable  2. Ubah Type  3. Ubah Path  4. Ubah Caption  0. Kembali');
  const ch = await ask('Pilih: ');
  
  if (!config.media) config.media = { enabled: false, type: 'image', path: '', caption: '' };
  
  switch (ch) {
    case '1': config.media.enabled = !config.media.enabled; break;
    case '2':
      console.log('   Tipe: 1.Image 2.Document 3.Audio 4.Video');
      const t = await ask('Pilih: ');
      config.media.type = ['image', 'document', 'audio', 'video'][parseInt(t)-1] || 'image';
      break;
    case '3': config.media.path = await ask('Path (relative): '); break;
    case '4': config.media.caption = await ask('Caption: '); break;
    default: return;
  }
  saveConfig(config);
  console.log('✅ Disimpan!');
  await ask('\nTekan Enter...');
}

async function manageRetry() {
  const config = loadConfig();
  if (!config) { console.log('❌ Gagal!'); return; }
  
  console.log('\n🔄 KONFIGURASI RETRY\n');
  console.log('   Enable: ' + (config.retry && config.retry.enabled ? '✅ Ya' : '❌ Tidak'));
  if (config.retry) {
    console.log('   Max Attempts: ' + config.retry.maxAttempts);
    console.log('   Delay (ms): ' + config.retry.delayMs);
  }
  
  console.log('\n1. Enable/Disable  2. Max Attempts  3. Delay  0. Kembali');
  const ch = await ask('Pilih: ');
  
  if (!config.retry) config.retry = { enabled: true, maxAttempts: 3, delayMs: 30000, retryOnErrors: ['ETIMEDOUT', 'ECONNRESET'] };
  
  switch (ch) {
    case '1': config.retry.enabled = !config.retry.enabled; break;
    case '2': config.retry.maxAttempts = parseInt(await ask('Max: ')); break;
    case '3': config.retry.delayMs = parseInt(await ask('Delay (ms): ')); break;
    default: return;
  }
  saveConfig(config);
  console.log('✅ Disimpan!');
  await ask('\nTekan Enter...');
}

async function viewLogs() {
  const config = loadConfig();
  const logFolder = path.join(__dirname, config.logging?.logFolder || './logs');
  
  console.log('\n📊 LIHAT LOG\n');
  
  if (!fs.existsSync(logFolder)) {
    console.log('❌ Folder log tidak ada!');
    await ask('\nTekan Enter...');
    return;
  }
  
  const files = fs.readdirSync(logFolder).filter(f => f.endsWith('.log')).sort().reverse();
  
  if (files.length === 0) {
    console.log('❌ Tidak ada file log!');
    await ask('\nTekan Enter...');
    return;
  }
  
  console.log('File log tersedia:\n');
  files.forEach((f, i) => console.log('   ' + (i+1) + '. ' + f));
  
  const sel = await ask('\nPilih file (nomor): ');
  const idx = parseInt(sel) - 1;
  if (isNaN(idx) || idx < 0 || idx >= files.length) return;
  
  const logPath = path.join(logFolder, files[idx]);
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  console.log('\n📄 Log: ' + files[idx] + ' (' + lines.length + ' entries)\n');
  console.log('Showing last 20 entries:\n');
  lines.slice(-20).forEach(l => console.log(l));
  
  await ask('\nTekan Enter...');
}

async function manageContacts() {
  let running = true;
  while (running) {
    clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                   📇 MANAJEMEN KONTAK                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const contacts = loadContacts();
    const groupKeys = Object.keys(contacts.groups);
    
    console.log('┌─────┬──────────────────────────┬──────────────┐');
    console.log('│ No. │ Nama Grup                 │ Jumlah       │');
    console.log('├─────┼──────────────────────────┼──────────────┤');
    if (groupKeys.length === 0) console.log('│     │ Tidak ada grup           │              │');
    else groupKeys.forEach((key, idx) => console.log('│ ' + (idx+1).toString().padStart(3) + ' │ ' + contacts.groups[key].name.padEnd(24) + ' │ ' + contacts.groups[key].contacts.length.toString().padStart(6) + ' │'));
    console.log('└─────┴──────────────────────────┴──────────────┘');

    console.log('\n1.➕Tambah  2.✏️Edit  3.🗑️Hapus  4.📥Import CSV  5.👁️Detail  0.🔙');
    const ch = await ask('\nPilih: ');
    switch (ch) {
      case '1': await addContactGroup(contacts); break;
      case '2': await editContactGroup(contacts); break;
      case '3': await deleteContactGroup(contacts); break;
      case '4': await importContactsFromCsv(contacts); break;
      case '5': await viewContactDetails(contacts); break;
      case '0': running = false; break;
    }
  }
}

async function addContactGroup(contacts) {
  console.log('\n➕ TAMBAH GRUP\n');
  const name = await ask('Nama Grup: ');
  if (!name) { console.log('❌ Nama kosong!'); return; }
  const key = name.toUpperCase().replace(/\s+/g, '_');
  if (contacts.groups[key]) { console.log('❌ Sudah ada!'); return; }

  console.log('Format: nama,nomor (SELESAI utk selesai)\n');
  const list = [];
  while (true) {
    const inp = await ask('> ');
    if (inp.trim().toUpperCase() === 'SELESAI') break;
    const p = inp.split(',');
    if (p.length >= 2) list.push({ name: p[0].trim(), phone: p[1].trim().replace(/\D/g, '') });
  }
  if (list.length === 0) { console.log('❌ Tidak ada!'); return; }
  contacts.groups[key] = { name, contacts: list };
  saveContacts(contacts);
  console.log('\n✅ Grup "' + name + '" (' + list.length + ' kontak)!');
  await ask('\nTekan Enter...');
}

async function editContactGroup(contacts) {
  const keys = Object.keys(contacts.groups);
  if (keys.length === 0) { console.log('❌ Tidak ada!'); await ask('\nTekan Enter...'); return; }
  console.log('\nPilih: ');
  keys.forEach((k, i) => console.log('   ' + (i+1) + '. ' + contacts.groups[k].name));
  const idx = parseInt(await ask('Nomor: ')) - 1;
  if (isNaN(idx) || idx < 0 || idx >= keys.length) return;
  const key = keys[idx];
  
  console.log('1.Tambah  2.Hapus semua  3.Batal');
  const act = await ask('Pilih: ');
  if (act === '1') {
    console.log('nama,nomor (SELESAI utk selesai)\n');
    while (true) {
      const inp = await ask('> ');
      if (inp.trim().toUpperCase() === 'SELESAI') break;
      const p = inp.split(',');
      if (p.length >= 2) contacts.groups[key].contacts.push({ name: p[0].trim(), phone: p[1].trim().replace(/\D/g, '') });
    }
    saveContacts(contacts);
    console.log('✅ Ditambahkan!');
  } else if (act === '2') {
    contacts.groups[key].contacts = [];
    saveContacts(contacts);
    console.log('✅ Dihapus!');
  }
  await ask('\nTekan Enter...');
}

async function deleteContactGroup(contacts) {
  const keys = Object.keys(contacts.groups);
  if (keys.length === 0) { console.log('❌ Tidak ada!'); await ask('\nTekan Enter...'); return; }
  console.log('\nPilih: ');
  keys.forEach((k, i) => console.log('   ' + (i+1) + '. ' + contacts.groups[k].name));
  const idx = parseInt(await ask('Nomor: ')) - 1;
  if (isNaN(idx) || idx < 0 || idx >= keys.length) return;
  const name = contacts.groups[keys[idx]].name;
  delete contacts.groups[keys[idx]];
  saveContacts(contacts);
  console.log('\n✅ Grup "' + name + '" dihapus!');
  await ask('\nTekan Enter...');
}

async function viewContactDetails(contacts) {
  const keys = Object.keys(contacts.groups);
  if (keys.length === 0) { console.log('❌ Tidak ada!'); await ask('\nTekan Enter...'); return; }
  console.log('\nPilih: ');
  keys.forEach((k, i) => console.log('   ' + (i+1) + '. ' + contacts.groups[k].name));
  const idx = parseInt(await ask('Nomor: ')) - 1;
  if (isNaN(idx) || idx < 0 || idx >= keys.length) return;
  
  const group = contacts.groups[keys[idx]];
  console.log('\n📁 ' + group.name + ' (' + group.contacts.length + ' kontak):\n');
  group.contacts.forEach((c, i) => console.log('   ' + (i+1) + '. ' + c.name + ' - ' + c.phone));
  await ask('\nTekan Enter...');
}

async function importContactsFromCsv(contacts) {
  console.log('\n📥 IMPORT DARI CSV\n');
  const csvPath = path.join(__dirname, 'contacts_import.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('❌ File contacts_import.csv tidak ada!');
    console.log('Buat file CSV dengan format: nama,nomor');
    await ask('\nTekan Enter...');
    return;
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const name = await ask('Nama Grup: ');
  if (!name) { console.log('❌ Nama kosong!'); return; }
  const key = name.toUpperCase().replace(/\s+/g, '_');
  
  const list = [];
  lines.forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 2) {
      list.push({ name: parts[0].trim(), phone: parts[1].trim().replace(/\D/g, '') });
    }
  });
  
  if (list.length === 0) { console.log('❌ Tidak ada data!'); return; }
  contacts.groups[key] = { name, contacts: list };
  saveContacts(contacts);
  console.log('\n✅ Grup "' + name + '" import (' + list.length + ' kontak)!');
  await ask('\nTekan Enter...');
}

async function sendTestMessage() {
  console.log('\n📤 KIRIM PESAN TES\n');
  
  const phone = await ask('Nomor tujuan (dengan kode negara): ');
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length < 10) {
    console.log('❌ Nomor tidak valid!');
    await ask('\nTekan Enter untuk kembali...');
    return;
  }

  console.log('\n⚠️ Untuk mengirim pesan, jalankan scheduler dengan:');
  console.log('   npm start');
  console.log('\n   Scheduler akan mengirim pesan sesuai jadwal.');
  await ask('\nTekan Enter untuk kembali...');
}

function runScheduler() {
  console.log('\n🚀 Menjalankan WhatsApp Scheduler...');
  console.log('   Tekan Ctrl+C untuk berhenti\n');
  
  try {
    execSync('node index.js', { cwd: __dirname, stdio: 'inherit' });
  } catch (e) {
    // Scheduler stopped
  }
}

async function mainMenu() {
  let running = true;
  
  while (running) {
    clearScreen();
    printHeader();
    
    const config = loadConfig();
    if (config) {
      printSchedules(config);
    }
    
    console.log('\n');
    console.log('    ┌─────────────────────────────────────────────────┐');
    console.log('    │  1. 📋 Lihat Jadwal                             │');
    console.log('    │  2. ➕ Tambah Jadwal                             │');
    console.log('    │  3. ✏️  Edit Jadwal                              │');
    console.log('    │  4. 🗑️  Hapus Jadwal                            │');
    console.log('    │  5. 📝 Edit Pesan Default                       │');
    console.log('    │  6. 📎 Konfigurasi Media                        │');
    console.log('    │  7. 🔄 Konfigurasi Retry                        │');
    console.log('    │  8. 📇 Manajemen Kontak                         │');
    console.log('    │  9. 📊 Lihat Log                                │');
    console.log('    │  10. 🚀 Jalankan Scheduler                       │');
    console.log('    │  11. ❌ Keluar                                  │');
    console.log('    └─────────────────────────────────────────────────┘');
    
    const choice = await ask('\nPilih menu (1-11): ');
    
    switch (choice) {
      case '1':
        clearScreen();
        printHeader();
        await viewSchedules();
        break;
      case '2':
        clearScreen();
        printHeader();
        await addSchedule();
        break;
      case '3':
        clearScreen();
        printHeader();
        await editSchedule();
        break;
      case '4':
        clearScreen();
        printHeader();
        await deleteSchedule();
        break;
      case '5':
        clearScreen();
        printHeader();
        await editMessage();
        break;
      case '6':
        clearScreen();
        await manageMedia();
        break;
      case '7':
        clearScreen();
        await manageRetry();
        break;
      case '8':
        clearScreen();
        await manageContacts();
        break;
      case '9':
        clearScreen();
        await viewLogs();
        break;
      case '10':
        clearScreen();
        runScheduler();
        break;
      case '11':
        console.log('\n👋 Terima kasih! Sampai jumpa!\n');
        running = false;
        break;
      default:
        break;
    }
  }
}

// Jalankan menu
mainMenu().catch(console.error);
