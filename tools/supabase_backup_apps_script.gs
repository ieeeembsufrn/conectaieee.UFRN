/**
 * Google Apps Script backup runner for Supabase public tables.
 *
 * How to test:
 * 1. Create a Google Apps Script project.
 * 2. Paste this whole file into Code.gs.
 * 3. Edit and run setupBackupConfigOnce().
 * 4. Run runSupabaseBackup().
 * 5. Optional: add a time-driven trigger for runSupabaseBackup().
 *
 * Security note:
 * The legacy service_role key bypasses RLS. Keep the Apps Script project private.
 *
 * How to find the key in Supabase:
 * Project Settings > API > Legacy API keys > service_role
 *
 * Use the legacy JWT key that starts with "eyJ...".
 * Do not use the newer secret key that starts with "sb_secret_..."; Supabase can
 * reject it from Google Apps Script with "Forbidden use of secret API key in browser".
 */

const BACKUP_CONFIG = {
  pageSize: 1000,
  gzipFiles: true,
  includeSensitiveTables: false,
  includeAuthUsers: false,
  requestRetries: 3,
  retryBaseSleepMs: 700,
  tables: [
    { name: 'chapters', order: 'id.asc' },
    { name: 'permissions', order: 'id.asc' },
    { name: 'profiles', order: 'id.asc' },
    { name: 'profile_chapters', order: 'id.asc' },
    { name: 'projects', order: 'id.asc' },
    { name: 'project_members', order: 'project_id.asc,profile_id.asc' },
    { name: 'project_chapters', order: 'project_id.asc,chapter_id.asc' },
    { name: 'tasks', order: 'id.asc' },
    { name: 'task_assignees', order: 'task_id.asc,profile_id.asc' },
    { name: 'events', order: 'id.asc' },
    { name: 'classifieds', order: 'id.asc' },
    { name: 'chapter_goals', order: 'id.asc' },
    { name: 'tools', order: 'id.asc' },
    { name: 'finances', order: 'id.asc', sensitive: true },
    { name: 'profile_private_data', order: 'profile_id.asc', sensitive: true },
    { name: 'notification_tokens', order: 'id.asc', sensitive: true }
  ]
};

const JSON_MIME_TYPE = 'application/json';

/**
 * Run once, then remove the literal values from this file if you prefer.
 * You can also set these in Project Settings > Script properties.
 */
function setupBackupConfigOnce() {
  PropertiesService.getScriptProperties().setProperties({
    SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
    SUPABASE_LEGACY_SERVICE_ROLE_KEY: 'YOUR_LEGACY_SERVICE_ROLE_JWT_KEY_STARTING_WITH_eyJ',
    BACKUP_FOLDER_ID: 'GOOGLE_DRIVE_FOLDER_ID'
  }, true);
}

function runSupabaseBackup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Another backup is already running.');
  }

  try {
    const props = getRequiredProperties_();
    const startedAt = new Date();
    const stamp = Utilities.formatDate(startedAt, 'GMT', "yyyy-MM-dd'T'HH-mm-ss'Z'");
    const rootFolder = DriveApp.getFolderById(props.BACKUP_FOLDER_ID);
    const runFolder = rootFolder.createFolder('supabase-backup-' + stamp);
    const manifest = {
      startedAt: startedAt.toISOString(),
      supabaseUrl: props.SUPABASE_URL,
      pageSize: BACKUP_CONFIG.pageSize,
      gzipFiles: BACKUP_CONFIG.gzipFiles,
      includeSensitiveTables: BACKUP_CONFIG.includeSensitiveTables,
      includeAuthUsers: BACKUP_CONFIG.includeAuthUsers,
      files: [],
      errors: []
    };

    getTablesToBackup_().forEach(function(table) {
      try {
        const result = backupTable_(props, runFolder, stamp, table);
        manifest.files.push(result);
      } catch (error) {
        manifest.errors.push({
          table: table.name,
          message: String(error && error.message ? error.message : error)
        });
      }
    });

    if (BACKUP_CONFIG.includeAuthUsers) {
      try {
        const result = backupAuthUsers_(props, runFolder, stamp);
        manifest.files.push(result);
      } catch (error) {
        manifest.errors.push({
          table: 'auth.users',
          message: String(error && error.message ? error.message : error)
        });
      }
    }

    manifest.finishedAt = new Date().toISOString();
    const manifestName = 'manifest-' + stamp + '.json';
    runFolder.createFile(
      manifestName,
      JSON.stringify(manifest, null, 2),
      JSON_MIME_TYPE
    );

    Logger.log('Backup finished: ' + runFolder.getUrl());
    Logger.log(JSON.stringify(manifest, null, 2));
    return manifest;
  } finally {
    lock.releaseLock();
  }
}

function backupTable_(props, runFolder, stamp, table) {
  let offset = 0;
  let totalRows = 0;
  const rows = [];

  while (true) {
    const page = fetchTablePage_(props, table, BACKUP_CONFIG.pageSize, offset);
    rows.push.apply(rows, page);
    totalRows += page.length;

    if (page.length < BACKUP_CONFIG.pageSize) {
      break;
    }

    offset += BACKUP_CONFIG.pageSize;
  }

  const payload = {
    table: table.name,
    exportedAt: new Date().toISOString(),
    rowCount: totalRows,
    rows: rows
  };
  const fileName = table.name + '-' + stamp + '.json';
  const file = createBackupFile_(runFolder, fileName, payload);

  Logger.log('Backed up ' + table.name + ': ' + totalRows + ' rows');
  return {
    table: table.name,
    rowCount: totalRows,
    fileName: file.getName(),
    fileUrl: file.getUrl()
  };
}

function fetchTablePage_(props, table, limit, offset) {
  const query = [
    'select=*',
    'limit=' + encodeURIComponent(String(limit)),
    'offset=' + encodeURIComponent(String(offset))
  ];

  if (table.order) {
    query.push('order=' + encodeURIComponent(table.order));
  }

  const url = trimSlash_(props.SUPABASE_URL) +
    '/rest/v1/' +
    encodeURIComponent(table.name) +
    '?' +
    query.join('&');

  const response = fetchWithRetry_(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: supabaseHeaders_(props)
  });

  assertOk_(response, 'fetch table ' + table.name);
  return JSON.parse(response.getContentText() || '[]');
}

function backupAuthUsers_(props, runFolder, stamp) {
  let page = 1;
  let totalRows = 0;
  const users = [];

  while (true) {
    const url = trimSlash_(props.SUPABASE_URL) +
      '/auth/v1/admin/users?page=' +
      encodeURIComponent(String(page)) +
      '&per_page=' +
      encodeURIComponent(String(BACKUP_CONFIG.pageSize));

    const response = fetchWithRetry_(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: supabaseHeaders_(props)
    });

    assertOk_(response, 'fetch auth users');
    const body = JSON.parse(response.getContentText() || '{}');
    const batch = body.users || [];
    users.push.apply(users, batch);
    totalRows += batch.length;

    if (batch.length < BACKUP_CONFIG.pageSize) {
      break;
    }

    page += 1;
  }

  const payload = {
    table: 'auth.users',
    exportedAt: new Date().toISOString(),
    rowCount: totalRows,
    rows: users
  };
  const file = createBackupFile_(runFolder, 'auth-users-' + stamp + '.json', payload);

  Logger.log('Backed up auth.users: ' + totalRows + ' rows');
  return {
    table: 'auth.users',
    rowCount: totalRows,
    fileName: file.getName(),
    fileUrl: file.getUrl()
  };
}

function createBackupFile_(folder, fileName, payload) {
  const json = JSON.stringify(payload, null, 2);

  if (!BACKUP_CONFIG.gzipFiles) {
    return folder.createFile(fileName, json, JSON_MIME_TYPE);
  }

  const blob = Utilities.newBlob(json, JSON_MIME_TYPE, fileName);
  const gzipped = Utilities.gzip(blob, fileName + '.gz');
  return folder.createFile(gzipped);
}

function getTablesToBackup_() {
  return BACKUP_CONFIG.tables.filter(function(table) {
    return BACKUP_CONFIG.includeSensitiveTables || !table.sensitive;
  });
}

function getRequiredProperties_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const required = [
    'SUPABASE_URL',
    'SUPABASE_LEGACY_SERVICE_ROLE_KEY',
    'BACKUP_FOLDER_ID'
  ];

  required.forEach(function(key) {
    if (!props[key]) {
      throw new Error('Missing script property: ' + key);
    }
  });

  props.SUPABASE_URL = normalizeSupabaseUrl_(props.SUPABASE_URL);
  props.SUPABASE_LEGACY_SERVICE_ROLE_KEY = String(props.SUPABASE_LEGACY_SERVICE_ROLE_KEY).trim();

  if (!isLegacyJwtKey_(props.SUPABASE_LEGACY_SERVICE_ROLE_KEY)) {
    throw new Error(
      'SUPABASE_LEGACY_SERVICE_ROLE_KEY must be the legacy service_role JWT key that starts with "eyJ...". ' +
      'Find it in Supabase: Project Settings > API > Legacy API keys > service_role. ' +
      'Do not use the newer "sb_secret_..." key in Google Apps Script.'
    );
  }

  return props;
}

function supabaseHeaders_(props) {
  const key = props.SUPABASE_LEGACY_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: 'Bearer ' + key,
    Accept: 'application/json',
    'User-Agent': 'SupabaseBackupAppsScript/1.0'
  };
}

function fetchWithRetry_(url, options) {
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 1; attempt <= BACKUP_CONFIG.requestRetries; attempt++) {
    try {
      lastResponse = UrlFetchApp.fetch(url, options);
      const code = lastResponse.getResponseCode();

      if (code < 500 && code !== 429) {
        return lastResponse;
      }
    } catch (error) {
      lastError = error;
    }

    Utilities.sleep(BACKUP_CONFIG.retryBaseSleepMs * attempt);
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('Request failed without a response.');
}

function assertOk_(response, action) {
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    return;
  }

  throw new Error(
    'Supabase request failed while trying to ' +
    action +
    '. HTTP ' +
    code +
    ': ' +
    response.getContentText()
  );
}

function trimSlash_(value) {
  return String(value).replace(/\/+$/, '');
}

function normalizeSupabaseUrl_(value) {
  const raw = String(value).trim();
  const markdownLinkMatch = raw.match(/^\[(https:\/\/[^\]]+)\]\(https:\/\/[^\)]+\)$/);
  const url = markdownLinkMatch ? markdownLinkMatch[1] : raw;
  return trimSlash_(url);
}

function isLegacyJwtKey_(value) {
  return String(value).trim().indexOf('eyJ') === 0;
}
