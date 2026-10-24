# Google Sheets and Drive sync

The app keeps SQLite as its source of truth. When the bridge is configured, it mirrors borrower, contract, transfer-slip, and receipt/payment rows into the four tabs in the configured Google Sheet. Generated contract PDFs and uploaded transaction slips are stored in the private `Loan OBN` Drive folder. Sync errors are logged; they do not undo a successful local save.

## Configure the bridge

1. Open [Google Apps Script](https://script.google.com/) and create a project. Paste `integrations/google-apps-script/Code.gs` into `Code.gs`.
2. In **Project Settings → Script Properties**, add:

   | Property | Value |
   | --- | --- |
   | `SPREADSHEET_ID` | `1RwIqd0sORf0SnUrL-EYSfuc70NbEh1ZoykiX3jKW4cw` |
   | `ROOT_FOLDER_ID` | `1-NhIHgmW2JNk9rg0ELu-qED0Fme8tVEX` |
   | `CONTRACTS_FOLDER_ID` | `1TDbRQVicoGd8aIjYGVV_Bh_uxMEHhVeR` |
   | `SYNC_TOKEN` | A new random secret with at least 32 characters |

3. Deploy as a **Web app**, execute as your Google account, and permit access for the app's server requests. Google may ask you to authorize Sheets, Drive, and external requests. Keep the deployment URL and token private. The token is checked on every request.
4. Put the deployment URL and the same token in the app's `.env`:

   ```env
   GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
   GOOGLE_SYNC_TOKEN="the-same-random-secret"
   ```

5. Restart the app. Open **Dashboard → Admin → Masterdata** and click **ซิงก์ข้อมูลไป Google Sheets** once to send existing rows. Future borrower, contract, and ledger saves sync automatically.

The `สัญญากู้` tab receives the Drive folder link after a generated contract PDF is archived. The `รับ-จ่าย` and `สลิปโอน` tabs receive the Drive file link when a transaction has an uploaded slip. The app does not upload ID-card photos or LINE QR images.

The app only writes columns whose header already exists. It matches records by `ID ระบบ`, `รหัสสัญญา`, or `รหัสรายการ`, so repeating the initial sync updates rows instead of duplicating them. Existing unrelated columns are preserved.
