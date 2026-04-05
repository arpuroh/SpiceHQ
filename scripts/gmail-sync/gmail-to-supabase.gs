/**
 * Gmail → Supabase Sync (Google Apps Script)
 *
 * Syncs Gmail threads to SpiceHQ's Supabase database.
 * Runs as a time-based trigger inside Google Apps Script.
 *
 * SETUP:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this entire file into the editor
 * 3. Set Script Properties (Project Settings → Script Properties):
 *    - SUPABASE_URL       → your Supabase project URL (e.g. https://xijwsuntklvkndaldswh.supabase.co)
 *    - SUPABASE_KEY        → your Supabase service_role secret key
 *    - SYNC_LABEL          → (optional) Gmail label to sync, defaults to "INBOX"
 *    - MAX_THREADS         → (optional) max threads per sync run, defaults to 50
 * 4. Run `initialSync` once manually (Authorize when prompted)
 * 5. Set up a time-based trigger: Triggers → Add Trigger → `incrementalSync` → every 15 minutes
 */

// ============================================================
// CONFIG
// ============================================================

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    SUPABASE_URL: props.getProperty('SUPABASE_URL'),
    SUPABASE_KEY: props.getProperty('SUPABASE_KEY'),
    SYNC_LABEL: props.getProperty('SYNC_LABEL') || 'INBOX',
    MAX_THREADS: parseInt(props.getProperty('MAX_THREADS') || '50', 10),
    LAST_SYNC_TIMESTAMP: props.getProperty('LAST_SYNC_TIMESTAMP'),
    LAST_HISTORY_ID: props.getProperty('LAST_HISTORY_ID'),
  };
}

function saveConfig(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

// ============================================================
// SUPABASE CLIENT
// ============================================================

function supabaseRequest(path, method, body) {
  const config = getConfig();
  const url = config.SUPABASE_URL + '/rest/v1/' + path;

  const options = {
    method: method || 'GET',
    headers: {
      'apikey': config.SUPABASE_KEY,
      'Authorization': 'Bearer ' + config.SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    muteHttpExceptions: true
  };

  if (body) {
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code >= 400) {
    Logger.log('Supabase error (' + code + '): ' + response.getContentText());
    throw new Error('Supabase request failed: ' + code + ' ' + response.getContentText());
  }

  const text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function supabaseUpsert(table, rows) {
  if (!rows || rows.length === 0) return;

  // Batch in chunks of 25 to stay within URL fetch limits
  const CHUNK_SIZE = 25;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    supabaseRequest(table, 'POST', chunk);
  }
}

// ============================================================
// CONTACT MATCHING
// ============================================================

/**
 * Fetches all contacts with email addresses from Supabase
 * Returns a Map of lowercase email → contact record
 */
function getContactEmailMap() {
  const contacts = supabaseRequest(
    'contacts?email=not.is.null&select=id,email,full_name,first_name,last_name',
    'GET'
  );

  const map = {};
  (contacts || []).forEach(function(c) {
    if (c.email) {
      map[c.email.toLowerCase().trim()] = c;
    }
  });
  return map;
}

// ============================================================
// EMAIL PARSING
// ============================================================

function generateId() {
  return Utilities.getUuid();
}

function extractEmail(headerValue) {
  if (!headerValue) return null;
  var match = headerValue.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase().trim() : headerValue.toLowerCase().trim();
}

function extractName(headerValue) {
  if (!headerValue) return null;
  var match = headerValue.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : null;
}

function parseEmailList(headerValue) {
  if (!headerValue) return [];
  return headerValue.split(',').map(function(part) {
    return extractEmail(part.trim());
  }).filter(Boolean);
}

function getMessageBody(message) {
  try {
    var body = message.getPlainBody();
    if (body && body.length > 0) {
      // Truncate very long bodies to save DB space (keep first 10KB)
      return body.length > 10000 ? body.substring(0, 10000) + '\n\n[... truncated]' : body;
    }
    // Fallback: strip HTML
    var html = message.getBody();
    if (html) {
      var text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.length > 10000 ? text.substring(0, 10000) + '\n\n[... truncated]' : text;
    }
    return null;
  } catch (e) {
    Logger.log('Error getting message body: ' + e.message);
    return null;
  }
}

// ============================================================
// THREAD PROCESSING
// ============================================================

function processThread(thread, contactEmailMap) {
  var gmailThreadId = thread.getId();
  var messages = thread.getMessages();
  var threadId = generateId();

  // Collect all participants across messages
  var participantSet = {};
  var messageRows = [];

  messages.forEach(function(msg) {
    var fromRaw = msg.getFrom();
    var toRaw = msg.getTo();
    var ccRaw = msg.getCc();

    var fromEmail = extractEmail(fromRaw);
    var fromName = extractName(fromRaw);
    var toEmails = parseEmailList(toRaw);
    var ccEmails = parseEmailList(ccRaw);

    // Track participants
    if (fromEmail) participantSet[fromEmail] = { email: fromEmail, name: fromName, role: 'from' };
    toEmails.forEach(function(e) { if (!participantSet[e]) participantSet[e] = { email: e, name: null, role: 'to' }; });
    ccEmails.forEach(function(e) { if (!participantSet[e]) participantSet[e] = { email: e, name: null, role: 'cc' }; });

    messageRows.push({
      id: generateId(),
      thread_id: threadId,
      gmail_message_id: msg.getId(),
      from_email: fromEmail,
      from_name: fromName,
      to_emails: JSON.stringify(toEmails),
      cc_emails: JSON.stringify(ccEmails),
      subject: msg.getSubject(),
      body_text: getMessageBody(msg),
      body_html: null, // Skip HTML to save space; plain text is stored
      sent_at: msg.getDate().toISOString()
    });
  });

  var participants = Object.keys(participantSet).map(function(k) { return participantSet[k]; });
  var lastMessage = messages[messages.length - 1];
  var labels = thread.getLabels().map(function(l) { return l.getName(); });

  var threadRow = {
    id: threadId,
    gmail_thread_id: gmailThreadId,
    subject: thread.getFirstMessageSubject(),
    snippet: lastMessage ? lastMessage.getPlainBody() : null,
    last_message_at: lastMessage ? lastMessage.getDate().toISOString() : null,
    participants: JSON.stringify(participants),
    message_count: messages.length,
    labels: JSON.stringify(labels),
    is_read: !thread.isUnread(),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Truncate snippet
  if (threadRow.snippet && threadRow.snippet.length > 500) {
    threadRow.snippet = threadRow.snippet.substring(0, 500) + '...';
  }

  // Match participants to contacts
  var contactMatches = [];
  participants.forEach(function(p) {
    var contact = contactEmailMap[p.email];
    if (contact) {
      contactMatches.push({
        id: generateId(),
        thread_id: threadId,
        contact_id: contact.id,
        match_type: p.role,
        matched_email: p.email
      });
    }
  });

  // Also create activities for matched contacts
  var activityRows = [];
  if (contactMatches.length > 0 && lastMessage) {
    contactMatches.forEach(function(match) {
      activityRows.push({
        id: generateId(),
        subject_type: 'contact',
        subject_id: match.contact_id,
        occurred_at: lastMessage.getDate().toISOString(),
        interaction_type: 'email',
        channel: 'gmail',
        title: threadRow.subject || '(no subject)',
        summary: threadRow.snippet ? threadRow.snippet.substring(0, 300) : null,
        source_label: 'Gmail Sync',
        source_url: 'https://mail.google.com/mail/u/0/#inbox/' + gmailThreadId
      });
    });
  }

  return {
    thread: threadRow,
    messages: messageRows,
    contactMatches: contactMatches,
    activities: activityRows
  };
}

// ============================================================
// SYNC OPERATIONS
// ============================================================

/**
 * First-time sync: pulls recent threads (last 30 days by default)
 * Run this ONCE manually after setup.
 */
function initialSync() {
  Logger.log('Starting initial Gmail sync...');
  var config = getConfig();

  if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in Script Properties. Set them first!');
  }

  // Update sync state
  supabaseUpsert('sync_state', [{
    id: generateId(),
    sync_type: 'gmail',
    status: 'running',
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]);

  try {
    var contactMap = getContactEmailMap();
    Logger.log('Loaded ' + Object.keys(contactMap).length + ' contacts with emails');

    // Get threads from the last 30 days
    var thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    var searchQuery = 'after:' + Utilities.formatDate(thirtyDaysAgo, Session.getScriptTimeZone(), 'yyyy/MM/dd');

    var threads = GmailApp.search(searchQuery, 0, config.MAX_THREADS);
    Logger.log('Found ' + threads.length + ' threads to sync');

    var allThreads = [];
    var allMessages = [];
    var allMatches = [];
    var allActivities = [];

    threads.forEach(function(thread) {
      try {
        var result = processThread(thread, contactMap);
        allThreads.push(result.thread);
        allMessages = allMessages.concat(result.messages);
        allMatches = allMatches.concat(result.contactMatches);
        allActivities = allActivities.concat(result.activities);
      } catch (e) {
        Logger.log('Error processing thread ' + thread.getId() + ': ' + e.message);
      }
    });

    // Upsert in order: threads → messages → matches → activities
    Logger.log('Upserting ' + allThreads.length + ' threads...');
    supabaseUpsert('email_threads', allThreads);

    Logger.log('Upserting ' + allMessages.length + ' messages...');
    supabaseUpsert('email_messages', allMessages);

    Logger.log('Upserting ' + allMatches.length + ' contact matches...');
    supabaseUpsert('email_contact_matches', allMatches);

    Logger.log('Creating ' + allActivities.length + ' activity records...');
    supabaseUpsert('activities', allActivities);

    // Save sync timestamp
    saveConfig('LAST_SYNC_TIMESTAMP', new Date().toISOString());

    // Update sync state
    supabaseUpsert('sync_state', [{
      id: 'gmail-sync',
      sync_type: 'gmail',
      status: 'idle',
      last_sync_at: new Date().toISOString(),
      metadata: JSON.stringify({ threads_synced: allThreads.length, messages_synced: allMessages.length, contacts_matched: allMatches.length }),
      updated_at: new Date().toISOString()
    }]);

    Logger.log('Initial sync complete! ' + allThreads.length + ' threads, ' + allMessages.length + ' messages, ' + allMatches.length + ' contact matches');
  } catch (e) {
    Logger.log('Sync failed: ' + e.message);
    supabaseUpsert('sync_state', [{
      id: 'gmail-sync',
      sync_type: 'gmail',
      status: 'error',
      error_message: e.message,
      updated_at: new Date().toISOString()
    }]);
    throw e;
  }
}

/**
 * Incremental sync: pulls only new/updated threads since last sync.
 * Set this on a 15-minute trigger.
 */
function incrementalSync() {
  Logger.log('Starting incremental Gmail sync...');
  var config = getConfig();

  if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in Script Properties.');
  }

  var lastSync = config.LAST_SYNC_TIMESTAMP;
  if (!lastSync) {
    Logger.log('No previous sync found. Running initial sync instead.');
    initialSync();
    return;
  }

  try {
    var contactMap = getContactEmailMap();

    // Search for threads newer than last sync
    var lastSyncDate = new Date(lastSync);
    var searchQuery = 'after:' + Utilities.formatDate(lastSyncDate, Session.getScriptTimeZone(), 'yyyy/MM/dd');

    var threads = GmailApp.search(searchQuery, 0, config.MAX_THREADS);
    Logger.log('Found ' + threads.length + ' threads since last sync');

    if (threads.length === 0) {
      saveConfig('LAST_SYNC_TIMESTAMP', new Date().toISOString());
      Logger.log('No new threads. Sync complete.');
      return;
    }

    // Check which threads we already have
    var existingThreadIds = {};
    try {
      var gmailIds = threads.map(function(t) { return t.getId(); });
      // Query in batches of 10
      for (var i = 0; i < gmailIds.length; i += 10) {
        var batch = gmailIds.slice(i, i + 10);
        var query = 'gmail_thread_id=in.(' + batch.map(function(id) { return '"' + id + '"'; }).join(',') + ')&select=id,gmail_thread_id';
        var existing = supabaseRequest('email_threads?' + query, 'GET');
        (existing || []).forEach(function(row) {
          existingThreadIds[row.gmail_thread_id] = row.id;
        });
      }
    } catch (e) {
      Logger.log('Could not check existing threads, will upsert all: ' + e.message);
    }

    var allThreads = [];
    var allMessages = [];
    var allMatches = [];
    var allActivities = [];

    threads.forEach(function(thread) {
      try {
        var result = processThread(thread, contactMap);

        // If thread already exists, reuse its ID
        var existingId = existingThreadIds[thread.getId()];
        if (existingId) {
          result.thread.id = existingId;
          result.messages.forEach(function(m) { m.thread_id = existingId; });
          result.contactMatches.forEach(function(m) { m.thread_id = existingId; });
          result.activities.forEach(function(a) { a.subject_id = a.subject_id; }); // keep contact id
        }

        allThreads.push(result.thread);
        allMessages = allMessages.concat(result.messages);
        allMatches = allMatches.concat(result.contactMatches);

        // Only create activities for NEW threads (avoid duplicate activity entries)
        if (!existingId) {
          allActivities = allActivities.concat(result.activities);
        }
      } catch (e) {
        Logger.log('Error processing thread ' + thread.getId() + ': ' + e.message);
      }
    });

    // Upsert all data
    if (allThreads.length > 0) supabaseUpsert('email_threads', allThreads);
    if (allMessages.length > 0) supabaseUpsert('email_messages', allMessages);
    if (allMatches.length > 0) supabaseUpsert('email_contact_matches', allMatches);
    if (allActivities.length > 0) supabaseUpsert('activities', allActivities);

    saveConfig('LAST_SYNC_TIMESTAMP', new Date().toISOString());

    // Update sync state
    supabaseUpsert('sync_state', [{
      id: 'gmail-sync',
      sync_type: 'gmail',
      status: 'idle',
      last_sync_at: new Date().toISOString(),
      metadata: JSON.stringify({
        threads_synced: allThreads.length,
        messages_synced: allMessages.length,
        contacts_matched: allMatches.length,
        incremental: true
      }),
      updated_at: new Date().toISOString()
    }]);

    Logger.log('Incremental sync complete! ' + allThreads.length + ' threads updated');
  } catch (e) {
    Logger.log('Incremental sync failed: ' + e.message);
    supabaseUpsert('sync_state', [{
      id: 'gmail-sync',
      sync_type: 'gmail',
      status: 'error',
      error_message: e.message,
      updated_at: new Date().toISOString()
    }]);
  }
}

/**
 * Re-match all existing threads against current contacts.
 * Useful after adding new contacts to find past conversations.
 */
function rematchContacts() {
  Logger.log('Re-matching all threads against contacts...');
  var config = getConfig();
  var contactMap = getContactEmailMap();

  // Fetch all threads
  var offset = 0;
  var limit = 100;
  var totalMatches = 0;

  while (true) {
    var threads = supabaseRequest(
      'email_threads?select=id,gmail_thread_id,participants&order=last_message_at.desc&offset=' + offset + '&limit=' + limit,
      'GET'
    );

    if (!threads || threads.length === 0) break;

    var newMatches = [];

    threads.forEach(function(thread) {
      var participants = [];
      try {
        participants = typeof thread.participants === 'string' ? JSON.parse(thread.participants) : (thread.participants || []);
      } catch (e) { return; }

      participants.forEach(function(p) {
        if (!p.email) return;
        var contact = contactMap[p.email.toLowerCase().trim()];
        if (contact) {
          newMatches.push({
            id: generateId(),
            thread_id: thread.id,
            contact_id: contact.id,
            match_type: p.role || 'participant',
            matched_email: p.email.toLowerCase().trim()
          });
        }
      });
    });

    if (newMatches.length > 0) {
      supabaseUpsert('email_contact_matches', newMatches);
      totalMatches += newMatches.length;
    }

    offset += limit;
    if (threads.length < limit) break;
  }

  Logger.log('Re-match complete. ' + totalMatches + ' contact matches created/updated.');
}

// ============================================================
// UTILITY
// ============================================================

/**
 * Test function — verifies Supabase connectivity
 */
function testConnection() {
  var config = getConfig();
  Logger.log('Testing connection to: ' + config.SUPABASE_URL);

  try {
    var result = supabaseRequest('contacts?select=id&limit=1', 'GET');
    Logger.log('Connection successful! Found contacts table.');
    Logger.log('Result: ' + JSON.stringify(result));
  } catch (e) {
    Logger.log('Connection FAILED: ' + e.message);
  }
}

/**
 * Removes the time-based trigger (for cleanup)
 */
function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log('All triggers removed.');
}

/**
 * Sets up the 15-minute incremental sync trigger
 */
function setupTrigger() {
  // Remove existing triggers first
  removeTriggers();

  ScriptApp.newTrigger('incrementalSync')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Trigger created: incrementalSync every 15 minutes');
}
