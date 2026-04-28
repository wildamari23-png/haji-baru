/**
 * ==========================================
 * BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * ==========================================
 * Silakan copy-paste seluruh kode ini ke file Code.gs di project Apps Script Anda.
 */

function doGet(e) {
  // Me-render file index.html sebagai web app
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Sistem Informasi Haji Pro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ==========================================
// 1. DATA JAMAAH
// ==========================================
function getJamaahDataServer() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE HAJI'); 
    const laporanSheet = ss.getSheetByName('LAPORAN_BESAR');
    
    if (!sheet) {
      return { success: false, message: "Sheet 'DATABASE HAJI' tidak ditemukan." };
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) {
      return { success: true, data: [] };
    }
    const headers = data[0];
    const rows = data.slice(1);

    const latestStatusMap = {};
    try {
      if (laporanSheet) {
        const lData = laporanSheet.getDataRange().getValues();
        const lHeaders = (lData && lData.length > 0) ? lData[0] : [];
        const lRows = (lData && lData.length > 1) ? lData.slice(1) : [];
        lRows.forEach(r => {
          const item = {};
          lHeaders.forEach((h, i) => item[h] = r[i]);
          const id = item['ID'];
          if (!id) return;
          if (!latestStatusMap[id]) latestStatusMap[id] = [];
          const rawTanggal = item['TANGGAL'] || '';
          const tanggalText = rawTanggal instanceof Date
            ? Utilities.formatDate(rawTanggal, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
            : String(rawTanggal);

          latestStatusMap[id].push({
            status: item['STATUS'] || 'SEHAT',
            catatan: item['DIAGNOSA_SAKIT'] || item['LOKASI PEMAKAMAN'] || '',
            waktu: tanggalText,
            linkSertifikat: item['LINK_SERTIFIKAT_KEMATIAN'] || '',
            lokasiRawat: item['LOKASI RAWAT'] || '',
            lokasiPemakaman: item['LOKASI PEMAKAMAN'] || ''
          });
        });
      }
    } catch (laporanError) {
      // Tetap lanjutkan load data utama meskipun parsing LAPORAN_BESAR bermasalah.
      Logger.log('Warning LAPORAN_BESAR parse: ' + laporanError);
    }

    const formattedData = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        if (header === null || header === '') return;
        obj[String(header).trim()] = row[index];
      });
      const history = latestStatusMap[obj['ID']] || [];
      const last = history[history.length - 1];
      return {
        id: obj['ID'] || '',
        paspor: obj['NO_PASPORT'] || '',
        nama: obj['NAMA_LENGKAP'] || '',
        gender: obj['GENDER'] || '',
        umur: obj['UMUR'] || '',
        asal: obj['KABUPATEN'] || '',
        status: last ? last.status : 'SEHAT',
        diagnosa: last ? last.catatan : '',
        lokasiRawat: last ? last.lokasiRawat : '',
        lokasiPemakaman: last ? last.lokasiPemakaman : '',
        linkSertifikat: last ? last.linkSertifikat : '',
        statusHistory: history
      };
    });

    return { success: true, data: formattedData };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateJamaahServer(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE HAJI');
    if (!sheet) return { success: false, message: "Sheet 'DATABASE HAJI' tidak ditemukan." };

    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    const idCol = headers.findIndex(h => String(h).trim() === 'ID');
    if (idCol < 0) return { success: false, message: "Kolom ID tidak ditemukan." };

    const rowIndex = data.findIndex((r, idx) => idx > 0 && String(r[idCol]).trim() === String(payload.id).trim());
    if (rowIndex < 0) return { success: false, message: "Data jemaah tidak ditemukan." };

    const map = {};
    headers.forEach((h, i) => map[String(h).trim()] = i);
    if (map['NAMA_LENGKAP'] >= 0) sheet.getRange(rowIndex + 1, map['NAMA_LENGKAP'] + 1).setValue(payload.nama || '');
    if (map['NO_PASPORT'] >= 0) sheet.getRange(rowIndex + 1, map['NO_PASPORT'] + 1).setValue(payload.paspor || '');
    if (map['GENDER'] >= 0) sheet.getRange(rowIndex + 1, map['GENDER'] + 1).setValue(payload.gender || '');
    if (map['UMUR'] >= 0) sheet.getRange(rowIndex + 1, map['UMUR'] + 1).setValue(payload.umur || '');
    if (map['KABUPATEN'] >= 0) sheet.getRange(rowIndex + 1, map['KABUPATEN'] + 1).setValue(payload.asal || '');

    return { success: true, message: 'Data jemaah berhasil diperbarui.' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteJamaahServer(ids) {
  try {
    const idSet = new Set((ids || []).map(String));
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DATABASE HAJI');
    if (!sheet) return { success: false, message: "Sheet 'DATABASE HAJI' tidak ditemukan." };
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    const idCol = headers.findIndex(h => String(h).trim() === 'ID');
    if (idCol < 0) return { success: false, message: "Kolom ID tidak ditemukan." };

    let deleted = 0;
    for (let r = data.length - 1; r >= 1; r--) {
      if (idSet.has(String(data[r][idCol]).trim())) {
        sheet.deleteRow(r + 1);
        deleted++;
      }
    }
    return { success: true, message: deleted + ' data jemaah dihapus.' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function requestDriveAccessServer() {
  try {
    DriveApp.getRootFolder().getId();
    return { success: true, message: 'Akses Google Drive siap digunakan.' };
  } catch (error) {
    return { success: false, message: 'Akses Drive belum tersedia. Jalankan fungsi ini manual di editor GAS untuk memicu otorisasi: ' + error };
  }
}

// ==========================================
// 2. PRESENSI KEGIATAN
// ==========================================
function getPresensiDataServer() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PRESENSI_KEGIATAN');
    if (!sheet) return { success: true, data: [] };

    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return { success: true, data: [] };
    const headers = data[0];
    const rows = data.slice(1);

    const formatted = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => obj[String(h).trim()] = row[i]);
      const tanggalRaw = obj['TANGGAL'];
      const tanggal = tanggalRaw instanceof Date
        ? Utilities.formatDate(tanggalRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(tanggalRaw || '');
      return {
        id: obj['ID'] || '',
        tanggal,
        paspor: obj['NO_PASPORT'] || '',
        nama: obj['NAMA_LENGKAP'] || '',
        gender: obj['GENDER'] || '',
        umur: obj['UMUR'] || '',
        provinsi: obj['PROVINSI'] || '',
        asal: obj['KABUPATEN'] || '',
        statusKehadiran: obj['STATUS KEHADIRAN'] || '',
        kegiatan: obj['KEGIATAN'] || '',
        pj: obj['PJ'] || '',
        noHpPj: obj['NO_HP_PJ'] || ''
      };
    });
    return { success: true, data: formatted };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function savePresensiServer(presensiList) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('PRESENSI_KEGIATAN');
    
    if (!sheet) {
      sheet = ss.insertSheet('PRESENSI_KEGIATAN');
      sheet.appendRow(['ID', 'TANGGAL', 'NO_PASPORT', 'NAMA_LENGKAP', 'GENDER', 'UMUR', 'PROVINSI', 'KABUPATEN', 'STATUS KEHADIRAN', 'KEGIATAN', 'PJ', 'NO_HP_PJ']);
    }

    const rowsToInsert = presensiList.map(p => [
      p.id,
      p.tanggal,
      p.paspor,
      p.nama,
      p.gender,
      p.umur,
      p.provinsi,
      p.asal,
      p.statusKehadiran,
      p.kegiatan,
      p.pj,
      p.noHpPj
    ]);

    if (rowsToInsert.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
    }

    return { success: true, message: "Presensi " + presensiList.length + " Jemaah berhasil disimpan!" };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ==========================================
// 3. UPDATE STATUS (SAKIT/MENINGGAL)
// ==========================================
function saveBulkStatusServer(updatedItems) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('LAPORAN_BESAR');
    
    if (!sheet) {
      sheet = ss.insertSheet('LAPORAN_BESAR');
      sheet.appendRow(['TANGGAL', 'ID', 'NO_PASPORT', 'NAMA_LENGKAP', 'GENDER', 'UMUR', 'PROVINSI', 'KABUPATEN', 'STATUS', 'KEGIATAN', 'DIAGNOSA_SAKIT', 'LOKASI RAWAT', 'LOKASI PEMAKAMAN', 'LINK_SERTIFIKAT_KEMATIAN']);
    }

    const now = new Date();
    // Format timestamp untuk pencatatan Laporan Besar
    const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    const rowsToInsert = updatedItems.map(item => [
      formattedDate,
      item.id,
      item.paspor,
      item.nama,
      item.gender,
      item.umur,
      'KALIMANTAN BARAT', // Hardcode provinsi asal
      item.asal,
      item.status,
      'UPDATE STATUS HARIAN',
      item.diagnosa || '',
      item.lokasiRawat || '',
      item.lokasiPemakaman || '',
      item.linkSertifikat || '' // Mengisi Kolom N dengan Link GDrive jika status meninggal
    ]);

    if (rowsToInsert.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
    }

    return { success: true, message: "Status " + updatedItems.length + " Jemaah berhasil diupdate ke Sheet LAPORAN_BESAR." };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function uploadCertificateServer(fileObj) {
  try {
    const defaultFolderId = '1gZTzNB0YvsgR_rgXwFnIR6m5STwSx5aE';
    const folderId = PropertiesService.getScriptProperties().getProperty('CERT_FOLDER_ID') || defaultFolderId;
    let folder = DriveApp.getRootFolder();
    try {
      if (folderId) folder = DriveApp.getFolderById(folderId);
    } catch (folderError) {
      Logger.log('Folder akses gagal, fallback ke root: ' + folderError);
    }
    const bytes = Utilities.base64Decode(fileObj.base64Data);
    const blob = Utilities.newBlob(bytes, fileObj.mimeType || MimeType.PDF, fileObj.fileName || ('sertifikat_' + Date.now() + '.pdf'));
    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      // Pada sebagian domain, setSharing dibatasi admin. File tetap dianggap berhasil tersimpan.
      Logger.log('setSharing gagal: ' + sharingError);
    }
    return { success: true, url: file.getUrl(), name: file.getName(), id: file.getId() };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ==========================================
// 4. DATA PENANGGUNG JAWAB (PJ)
// ==========================================
function getPjDataServer() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('PJ'); 
    
    if (!sheet) return { success: false, message: "Sheet 'PJ' tidak ditemukan." };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] }; // Hanya ada header

    const headers = data[0];
    const rows = data.slice(1);

    const formattedData = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header.toString().trim()] = row[index];
      });
      return {
        id: obj['ID'] || '',
        nama: obj['NAMA_PJ'] || '',
        noHp: obj['NO_HP'] || ''
      };
    });

    return { success: true, data: formattedData };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function saveNewPjServer(newPjObj) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('PJ');
    
    if (!sheet) {
      sheet = ss.insertSheet('PJ');
      sheet.appendRow(['ID', 'NAMA_PJ', 'NO_HP', 'PROVINSI', 'KABUPATEN']);
    }

    // Masukkan data PJ Baru (ID, NAMA_PJ, NO_HP, PROVINSI, KABUPATEN)
    sheet.appendRow([newPjObj.id, newPjObj.nama, newPjObj.noHp, 'KALIMANTAN BARAT', '']);
    return { success: true, message: "PJ Baru berhasil disimpan!" };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ==========================================
// 5. SISTEM LOGIN DUMMY
// ==========================================
function verifyLoginServer(username, password) {
  const props = PropertiesService.getScriptProperties();
  const appSettings = JSON.parse(props.getProperty('APP_SETTINGS') || '{}');
  const savedUser = appSettings.username || 'admin';
  const savedPass = appSettings.password || 'admin123';
  if (username === savedUser && password === savedPass) {
    return { success: true, role: 'admin', fullName: appSettings.fullName || 'Administrator' };
  }
  if (username === 'viewer' && password === 'viewer123') {
    return { success: true, role: 'viewer', fullName: 'Viewer Dashboard' };
  }
  return { success: false, message: 'Username atau password salah!' };
}

function getAppSettingsServer() {
  try {
    const props = PropertiesService.getScriptProperties();
    const appSettings = JSON.parse(props.getProperty('APP_SETTINGS') || '{}');
    return { success: true, data: appSettings };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function saveAppSettingsServer(settings) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('APP_SETTINGS', JSON.stringify(settings || {}));
    return { success: true, message: 'Pengaturan aplikasi disimpan.' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}
