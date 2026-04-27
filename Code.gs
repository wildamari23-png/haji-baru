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

// ==========================================
// 2. PRESENSI KEGIATAN
// ==========================================
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
  if (username === 'admin' && password === 'admin123') {
    return { success: true };
  }
  return { success: false, message: 'Username atau password salah!' };
}
