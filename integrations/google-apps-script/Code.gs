/**
 * Private webhook bridge for Loan OBN.
 * Deploy as a web app that executes as the spreadsheet/Drive owner.
 * Set Script Properties: SYNC_TOKEN, SPREADSHEET_ID, CONTRACTS_FOLDER_ID, ROOT_FOLDER_ID.
 */
function doPost(event) {
  var lock = LockService.getScriptLock();
  try {
    var input = JSON.parse(event.postData.contents || '{}');
    var properties = PropertiesService.getScriptProperties();
    var expected = properties.getProperty('SYNC_TOKEN') || '';
    if (!expected || !constantTimeEqual(String(input.token || ''), expected)) {
      return json({ ok: false, error: 'unauthorized' });
    }

    lock.waitLock(20000);
    var result;
    if (input.action === 'syncRows') {
      result = syncRows(input.rows || []);
    } else if (input.action === 'archiveContractPdf') {
      result = archiveContractPdf(input);
    } else if (input.action === 'archiveLedgerFile') {
      result = archiveLedgerFile(input);
    } else {
      return json({ ok: false, error: 'unsupported_action' });
    }
    return json({ ok: true, result: result });
  } catch (error) {
    console.error('Loan OBN bridge failed: ' + (error && error.message ? error.message : 'unknown'));
    return json({ ok: false, error: 'bridge_failed' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function syncRows(rows) {
  if (!Array.isArray(rows) || rows.length > 250) throw new Error('invalid_row_batch');
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('missing_spreadsheet_id');
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var results = [];
  rows.forEach(function(row) {
    results.push(upsertRow(spreadsheet, row));
  });
  return { count: results.length };
}

function upsertRow(spreadsheet, item) {
  if (!item || typeof item.sheetName !== 'string' || typeof item.keyHeader !== 'string' || typeof item.keyValue !== 'string') {
    throw new Error('invalid_row');
  }
  var sheet = spreadsheet.getSheetByName(item.sheetName);
  if (!sheet) throw new Error('sheet_not_found:' + item.sheetName);
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error('missing_headers:' + item.sheetName);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var keyColumn = headers.indexOf(item.keyHeader) + 1;
  if (!keyColumn) throw new Error('key_header_not_found:' + item.keyHeader);
  var rowNumber = findRow(sheet, keyColumn, item.keyValue);
  if (item.delete === true) {
    if (rowNumber) sheet.deleteRow(rowNumber);
    return { sheetName: item.sheetName, deleted: Boolean(rowNumber), key: item.keyValue };
  }
  if (!rowNumber) rowNumber = Math.max(2, sheet.getLastRow() + 1);
  var existing = rowNumber <= sheet.getLastRow()
    ? sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0]
    : new Array(lastColumn).fill('');
  Object.keys(item.values || {}).forEach(function(header) {
    var column = headers.indexOf(header);
    if (column >= 0) existing[column] = item.values[header] == null ? '' : item.values[header];
  });
  sheet.getRange(rowNumber, 1, 1, lastColumn).setValues([existing]);
  return { sheetName: item.sheetName, row: rowNumber, key: item.keyValue };
}

function findRow(sheet, column, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var match = sheet.getRange(2, column, lastRow - 1, 1)
    .createTextFinder(String(value)).matchEntireCell(true).findNext();
  return match ? match.getRow() : 0;
}

function archiveContractPdf(input) {
  var folderId = PropertiesService.getScriptProperties().getProperty('CONTRACTS_FOLDER_ID');
  if (!folderId) throw new Error('missing_contracts_folder_id');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(input.contractCode || ''))) throw new Error('invalid_contract_code');
  if (!['loan', 'guarantee', 'collateral'].includes(input.documentType)) throw new Error('invalid_document_type');
  if (typeof input.pdfBase64 !== 'string' || input.pdfBase64.length > 20 * 1024 * 1024) throw new Error('invalid_pdf');

  var root = DriveApp.getFolderById(folderId);
  var yearFolder = getOrCreateFolder(root, String(input.year || new Date().getFullYear()));
  var contractFolder = getOrCreateFolder(yearFolder, input.contractCode);
  var filename = input.contractCode + '-' + input.documentType + '.pdf';
  var digest = String(input.sha256 || '');
  var files = contractFolder.getFilesByName(filename);
  var file;
  var bytes = Utilities.base64Decode(input.pdfBase64);
  var blob = Utilities.newBlob(bytes, 'application/pdf', filename);

  if (files.hasNext()) {
    file = files.next();
    if (file.getDescription() !== digest) {
      var upload = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' + file.getId() + '?uploadType=media', {
        method: 'patch',
        contentType: 'application/pdf',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: bytes,
        muteHttpExceptions: true
      });
      if (upload.getResponseCode() < 200 || upload.getResponseCode() >= 300) throw new Error('drive_update_failed');
      file.setDescription(digest);
    }
  } else {
    file = contractFolder.createFile(blob);
    file.setDescription(digest);
  }

  var folderUrl = contractFolder.getUrl();
  upsertRow(SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')), {
    sheetName: 'สัญญากู้', keyHeader: 'รหัสสัญญา', keyValue: input.contractCode,
    values: { 'ลิงก์เอกสารสัญญา': folderUrl }
  });
  return { fileId: file.getId(), fileUrl: file.getUrl(), folderUrl: folderUrl, name: filename };
}

function archiveLedgerFile(input) {
  var rootId = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if (!rootId) throw new Error('missing_root_folder_id');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(input.entryCode || ''))) throw new Error('invalid_entry_code');
  if (!['slip', 'collateral'].includes(input.fileType)) throw new Error('invalid_file_type');
  if (typeof input.fileBase64 !== 'string' || input.fileBase64.length > 20 * 1024 * 1024) throw new Error('invalid_file');
  if (typeof input.mimeType !== 'string' || !/^(application\/pdf|image\/(jpeg|png|webp))$/.test(input.mimeType)) throw new Error('invalid_mime_type');

  var root = DriveApp.getFolderById(rootId);
  var areaFolder = getOrCreateFolder(root, input.fileType === 'slip' ? 'Receipts' : 'Collateral');
  var yearFolder = getOrCreateFolder(areaFolder, String(input.year || new Date().getFullYear()));
  var recordFolder = getOrCreateFolder(yearFolder, input.entryCode);
  var safeName = String(input.originalName || (input.entryCode + '-' + input.fileType)).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 120);
  var digest = String(input.sha256 || '');
  var files = recordFolder.getFilesByName(safeName);
  var bytes = Utilities.base64Decode(input.fileBase64);
  var blob = Utilities.newBlob(bytes, input.mimeType, safeName);
  var file;
  if (files.hasNext()) {
    file = files.next();
    if (file.getDescription() !== digest) {
      var upload = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' + file.getId() + '?uploadType=media', {
        method: 'patch', contentType: input.mimeType,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: bytes, muteHttpExceptions: true
      });
      if (upload.getResponseCode() < 200 || upload.getResponseCode() >= 300) throw new Error('drive_update_failed');
      file.setDescription(digest);
    }
  } else {
    file = recordFolder.createFile(blob);
    file.setDescription(digest);
  }
  return { fileId: file.getId(), fileUrl: file.getUrl(), folderUrl: recordFolder.getUrl(), name: safeName };
}

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function constantTimeEqual(left, right) {
  if (!left || left.length !== right.length) return false;
  var result = 0;
  for (var i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
