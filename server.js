// Express REST API Backend for TN Government Inward Tapal System
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const {
  TAPAL_TYPES,
  SECTION_LOOKUP,
  SECTIONS,
  getCanonicalSectionCode,
  getSectionFullName,
  EMPLOYEE_DESIGNATIONS,
  getEmployeeDesignations,
  MAIN_OFFICES,
  DEFAULT_OFFICER_DESIGNATIONS,
  OFFICER_DESIGNATIONS_RAW,
  getOfficerDesignations,
  DEFAULT_SUBJECT_IN_BRIEF,
  SUBJECT_IN_BRIEF_RAW,
  getSubjectInBrief,
  STATUSES
} = require('./data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Endpoint to provide master dropdown configuration to API consumers
app.get('/api/config/dropdowns', (req, res) => {
  res.json({
    tapalTypes: TAPAL_TYPES,
    sections: SECTIONS,
    sectionLookup: SECTION_LOOKUP,
    employeeDesignations: EMPLOYEE_DESIGNATIONS,
    mainOffices: MAIN_OFFICES,
    defaultOfficerDesignations: DEFAULT_OFFICER_DESIGNATIONS,
    officerDesignationsRaw: OFFICER_DESIGNATIONS_RAW,
    defaultSubjectInBrief: DEFAULT_SUBJECT_IN_BRIEF,
    subjectInBriefRaw: SUBJECT_IN_BRIEF_RAW,
    statuses: STATUSES
  });
});

// Helper: Check if Date Lock is enabled in database
let memoryDateLockEnabled = true;

async function isDateLockActive() {
  try {
    const res = await db.query("SELECT value FROM system_settings WHERE key = 'date_lock_enabled'");
    if (res.rows && res.rows.length > 0) {
      memoryDateLockEnabled = res.rows[0].value === 'true';
      return memoryDateLockEnabled;
    }
  } catch (e) {
    // If DB is offline or table doesn't exist yet, return in-memory state
  }
  return memoryDateLockEnabled;
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'UP', postgres_time: result.rows[0].now });
  } catch (err) {
    res.status(200).json({ status: 'STANDALONE_FALLBACK', note: 'Running in offline/standalone mode', error: err.message });
  }
});

// -----------------------------------------------------------------------------
// SYSTEM SETTINGS ENDPOINTS (Date Lock & Release Controls)
// -----------------------------------------------------------------------------
app.get('/api/settings/date-lock', async (req, res) => {
  try {
    const isLocked = await isDateLockActive();
    res.json({ date_lock_enabled: isLocked });
  } catch (err) {
    console.error('Error in GET /api/settings/date-lock:', err);
    res.json({ date_lock_enabled: memoryDateLockEnabled });
  }
});

app.post('/api/settings/date-lock', async (req, res) => {
  try {
    const { enabled, userId, role } = req.body;
    const userRole = (role || req.headers['x-user-role'] || 'User').toLowerCase();

    const lockValue = enabled === true || enabled === 'true' ? 'true' : 'false';
    memoryDateLockEnabled = (lockValue === 'true');

    // Async non-blocking DB persistence & audit log
    db.query(
      `INSERT INTO system_settings (key, value, updated_at) 
       VALUES ('date_lock_enabled', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [lockValue]
    ).then(() => {
      return db.query(
        `INSERT INTO tapal_audit_logs (user_id, action, changes) VALUES ($1, $2, $3)`,
        [
          userId || null,
          'UPDATE_SETTINGS',
          JSON.stringify({ setting: 'date_lock_enabled', value: lockValue, setByRole: userRole, timestamp: new Date().toISOString() })
        ]
      );
    }).catch(dbErr => {
      // Graceful fallback to memory setting when offline
    });

    res.json({ success: true, date_lock_enabled: memoryDateLockEnabled });
  } catch (err) {
    console.error('Error in POST /api/settings/date-lock:', err);
    res.status(500).json({ error: 'Failed to update date lock setting', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// TAPAL REGISTER CRUD ENDPOINTS
// -----------------------------------------------------------------------------

// 1. GET /api/tapal - Fetch paginated & filtered Tapal entries from PostgreSQL
app.get('/api/tapal', async (req, res) => {
  try {
    const { search, month, status, office, officer, section, page = 1, limit = 15 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = [];
    let queryParams = [];
    let paramIdx = 1;

    if (search) {
      whereClause.push(`(search_vector @@ plainto_tsquery('english', $${paramIdx}) OR sent_letter_no ILIKE $${paramIdx + 1} OR accounts_ref_no ILIKE $${paramIdx + 1} OR curr_no::TEXT ILIKE $${paramIdx + 1})`);
      queryParams.push(search, `%${search}%`);
      paramIdx += 2;
    }

    if (month && month !== 'ALL') {
      whereClause.push(`month_year = $${paramIdx}`);
      queryParams.push(month);
      paramIdx++;
    }

    if (status && status !== 'ALL') {
      whereClause.push(`status = $${paramIdx}`);
      queryParams.push(status);
      paramIdx++;
    }

    if (office && office !== 'ALL') {
      whereClause.push(`main_office = $${paramIdx}`);
      queryParams.push(office);
      paramIdx++;
    }

    if (officer && officer !== 'ALL') {
      whereClause.push(`officer_desig ILIKE $${paramIdx}`);
      queryParams.push(`%${officer}%`);
      paramIdx++;
    }

    if (section && section !== 'ALL') {
      whereClause.push(`section = $${paramIdx}`);
      queryParams.push(section);
      paramIdx++;
    }

    const whereStr = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Total count query
    const countSql = `SELECT COUNT(*) FROM tapal_register ${whereStr}`;
    const countRes = await db.query(countSql, queryParams);
    const totalRecords = parseInt(countRes.rows[0].count, 10);

    // Paginated fetch query with subquery aggregate on tapal_reminders to prevent N+1 query overhead
    const fetchSql = `
      SELECT 
        t.id, t.s_no AS "sNo", t.month_year AS "month", t.tapal_type AS "tapalType",
        t.curr_no AS "currNo", t.office_seal_date AS "sealDate", t.received_sec_date AS "recSecDate",
        t.subject, t.letter_ref AS "letterRef", t.letter_date AS "letterDate",
        t.short_sub AS "shortSub", t.main_office AS "mainOffice", t.officer_desig AS "officerDesig",
        t.status, t.action_initiated AS "actionInitiated", t.file_no_ref AS "fileNoRef",
        t.file_init_date AS "fileInitDate", t.file_appr_date AS "fileApprDate",
        t.follow_up AS "followUp", t.follow_up_date AS "followUpDate", t.follow_up_closed_date AS "followUpClosedDate", t.follow_up_status AS "followUpStatus", t.remarks, t.tech_sec_ref AS "techSecRef", t.section,
        t.emp_desig AS "empDesig", t.sent_letter_no AS "sentLetterNo", t.accounts_ref_no AS "accountsRefNo",
        t.dispatch_date AS "dispatchDate", t.sent_to AS "sentTo",
        COALESCE(rem.reminder_count, 0)::INT AS "reminderCount",
        rem.latest_reminder_date AS "latestReminderDate",
        COALESCE(rem.reminder_history, '[]'::json) AS "reminderHistory"
      FROM tapal_register t
      LEFT JOIN (
        SELECT 
          tapal_id,
          COUNT(*)::INT AS reminder_count,
          MAX(reminder_date) AS latest_reminder_date,
          json_agg(json_build_object('id', id, 'date', reminder_date, 'text', reminder_text, 'createdAt', created_at) ORDER BY reminder_date DESC) AS reminder_history
        FROM tapal_reminders
        GROUP BY tapal_id
      ) rem ON rem.tapal_id = t.id
      ${whereStr ? whereStr.replace(/search_vector/g, 't.search_vector').replace(/sent_letter_no/g, 't.sent_letter_no').replace(/accounts_ref_no/g, 't.accounts_ref_no').replace(/curr_no/g, 't.curr_no').replace(/month_year/g, 't.month_year').replace(/status/g, 't.status').replace(/main_office/g, 't.main_office').replace(/officer_desig/g, 't.officer_desig').replace(/section/g, 't.section') : ''}
      ORDER BY t.id DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataRes = await db.query(fetchSql, [...queryParams, limit, offset]);

    res.json({
      data: dataRes.rows,
      total: totalRecords,
      page: parseInt(page, 10),
      totalPages: Math.ceil(totalRecords / limit)
    });
  } catch (err) {
    console.error('Error in GET /api/tapal:', err);
    res.status(500).json({ error: 'Database query failed', details: err.message });
  }
});

// 2. POST /api/tapal - Create new Tapal Entry in PostgreSQL
app.post('/api/tapal', async (req, res) => {
  try {
    const month_year = req.body.month_year || req.body.month || 'MAR-2023';
    const tapal_type = req.body.tapal_type || req.body.tapalType || 'Tapal';
    const curr_no = req.body.curr_no || req.body.currNo;
    const office_seal_date = req.body.office_seal_date || req.body.sealDate || null;
    const received_sec_date = req.body.received_sec_date || req.body.recSecDate || null;
    const subject = req.body.subject || '-';
    const letter_ref = req.body.letter_ref || req.body.letterRef || null;
    const letter_date = req.body.letter_date || req.body.letterDate || null;
    const short_sub = req.body.short_sub || req.body.shortSub || null;
    const main_office = req.body.main_office || req.body.mainOffice || 'SE';
    const officer_desig = req.body.officer_desig || req.body.officerDesig || null;
    const status = req.body.status || 'Pending';
    const action_initiated = req.body.action_initiated || req.body.actionInitiated || null;
    const file_no_ref = req.body.file_no_ref || req.body.fileNoRef || null;
    const file_init_date = req.body.file_init_date || req.body.fileInitDate || null;
    const file_appr_date = req.body.file_appr_date || req.body.fileApprDate || null;
    const follow_up = req.body.follow_up || req.body.followUp || null;
    const follow_up_date = req.body.follow_up_date || req.body.followUpDate || null;
    const follow_up_closed_date = req.body.follow_up_closed_date || req.body.followUpClosedDate || null;
    const follow_up_status = req.body.follow_up_status || req.body.followUpStatus || 'Pending';
    const remarks = req.body.remarks || null;
    const rawSec = req.body.section || req.body.techSecRef || req.body.tech_sec_ref || null;
    const canonicalSec = rawSec ? getCanonicalSectionCode(rawSec) : null;
    const tech_sec_ref = canonicalSec || rawSec;
    const section = canonicalSec || rawSec;
    const emp_desig = req.body.emp_desig || req.body.empDesig || null;
    const sent_letter_no = req.body.sent_letter_no || req.body.sentLetterNo || null;
    const accounts_ref_no = req.body.accounts_ref_no || req.body.accountsRefNo || null;
    const dispatch_date = req.body.dispatch_date || req.body.dispatchDate || null;
    const sent_to = req.body.sent_to || req.body.sentTo || null;
    const created_by = req.body.created_by || req.body.createdBy || null;

    const currentStatus = status || 'Pending';
    const isFiled = currentStatus === 'Filed';

    // Rule #1: Server-side Date Lock Enforcement
    const isLocked = await isDateLockActive();
    if (isLocked) {
      const today = new Date().toISOString().split('T')[0];
      const datesToCheck = [office_seal_date, received_sec_date, letter_date, file_init_date, file_appr_date, dispatch_date, follow_up_date];
      for (const d of datesToCheck) {
        if (d && d > today) {
          return res.status(400).json({ error: `Date validation error: Future date ${d} is not allowed while Date Lock is enabled.` });
        }
      }
    }

    // Rule #2: Approval Date Mandatory check (exempt for status === 'Filed' and 'Pending')
    const approvalRequiredStatuses = ['Letter', 'Memo', 'Proceedings', 'Proceeding', 'DO Letter', 'Office Order'];
    if (!isFiled && approvalRequiredStatuses.includes(currentStatus) && !file_appr_date) {
      return res.status(400).json({ error: `File Approval Date is mandatory for status '${currentStatus}'.` });
    }

    // Rule #4: Action Date Mandatory check (when status is not Pending)
    if (!isFiled && currentStatus !== 'Pending' && !file_init_date) {
      return res.status(400).json({ error: `Action Initiated Date is mandatory for status '${currentStatus}'.` });
    }

    // Rule #3 & #6: If filed, default current date for action date and clear dispatch fields
    const todayISO = new Date().toISOString().split('T')[0];
    const cleanActionInitiated = isFiled ? (action_initiated || 'Filed') : (action_initiated || null);
    const cleanFileInitDate = isFiled ? (file_init_date || todayISO) : (file_init_date || null);
    const cleanSentLetterNo = isFiled ? null : (sent_letter_no ? String(sent_letter_no).trim() : null);
    const cleanAccountsRefNo = isFiled ? null : (accounts_ref_no ? String(accounts_ref_no).trim() : null);
    const cleanDispatchDate = isFiled ? null : (dispatch_date || null);
    const cleanSentTo = isFiled ? null : (sent_to || null);
    const cleanFileApprDate = isFiled ? (file_appr_date || null) : (file_appr_date || null);

    const countRes = await db.query('SELECT COALESCE(MAX(s_no), 0) + 1 AS next_sno FROM tapal_register');
    const nextSNo = countRes.rows[0].next_sno;

    const insertSql = `
      INSERT INTO tapal_register (
        s_no, month_year, tapal_type, curr_no, office_seal_date, received_sec_date,
        subject, letter_ref, letter_date, short_sub, main_office, officer_desig,
        status, action_initiated, file_no_ref, file_init_date, file_appr_date, follow_up, follow_up_date, follow_up_closed_date, follow_up_status, remarks, tech_sec_ref, section,
        emp_desig, sent_letter_no, accounts_ref_no, dispatch_date, sent_to, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29, $30
      ) RETURNING id, s_no;
    `;

    const result = await db.query(insertSql, [
      nextSNo, month_year, tapal_type, curr_no ? parseInt(String(curr_no).replace(/[^0-9]/g, ''), 10) : nextSNo, office_seal_date, received_sec_date,
      subject, letter_ref, letter_date, short_sub, main_office, officer_desig,
      currentStatus, cleanActionInitiated, file_no_ref, cleanFileInitDate, cleanFileApprDate, follow_up, follow_up_date, follow_up_closed_date, follow_up_status, remarks, tech_sec_ref, section,
      emp_desig, cleanSentLetterNo, cleanAccountsRefNo, cleanDispatchDate, cleanSentTo, created_by
    ]);

    res.status(201).json({
      success: true,
      id: result.rows[0].id,
      sNo: result.rows[0].s_no,
      message: 'Tapal record created successfully in PostgreSQL'
    });
  } catch (err) {
    console.error('Error in POST /api/tapal:', err);
    res.status(500).json({ error: 'Failed to insert Tapal record', details: err.message });
  }
});

// Update Tapal record
app.put('/api/tapal/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      month_year, tapal_type, curr_no, office_seal_date, received_sec_date,
      subject, letter_ref, letter_date, short_sub, main_office, officer_desig,
      status, action_initiated, file_no_ref, file_init_date, file_appr_date,
      follow_up, follow_up_date, follow_up_closed_date, follow_up_status, remarks,
      tech_sec_ref, section: rawSection, emp_desig, sent_letter_no, accounts_ref_no, dispatch_date, sent_to, updated_by
    } = req.body;

    const section = (typeof getCanonicalSectionCode === 'function') 
      ? getCanonicalSectionCode(rawSection || tech_sec_ref) 
      : (rawSection || tech_sec_ref);

    const currentStatus = status || 'Pending';
    const isFiled = currentStatus === 'Filed';

    // Rule #1: Date Lock check
    const isLocked = await isDateLockActive();
    if (isLocked) {
      const today = new Date().toISOString().split('T')[0];
      const datesToCheck = [office_seal_date, received_sec_date, letter_date, file_init_date, file_appr_date, dispatch_date, follow_up_date];
      for (const d of datesToCheck) {
        if (d && d > today) {
          return res.status(400).json({ error: `Date validation error: Future date ${d} is not allowed while Date Lock is enabled.` });
        }
      }
    }

    // Rule #2: Approval Date Mandatory check (exempt for status === 'Filed' and 'Pending')
    const approvalRequiredStatuses = ['Letter', 'Memo', 'Proceedings', 'Proceeding', 'DO Letter', 'Office Order'];
    if (!isFiled && approvalRequiredStatuses.includes(currentStatus) && !file_appr_date) {
      return res.status(400).json({ error: `File Approval Date is mandatory for status '${currentStatus}'.` });
    }

    // Rule #4: Action Date Mandatory check when modifying/updating a Tapal record
    if (!isFiled && !file_init_date) {
      return res.status(400).json({ error: `Action Initiated Date (file_init_date) is mandatory when updating a Tapal record.` });
    }

    // Rule #3 & #6: If filed, default current date for action date and clear dispatch fields
    const todayISO = new Date().toISOString().split('T')[0];
    const cleanActionInitiated = isFiled ? (action_initiated || 'Filed') : (action_initiated || null);
    const cleanFileInitDate = isFiled ? (file_init_date || todayISO) : (file_init_date || null);
    const cleanSentLetterNo = isFiled ? null : (sent_letter_no ? String(sent_letter_no).trim() : null);
    const cleanAccountsRefNo = isFiled ? null : (accounts_ref_no ? String(accounts_ref_no).trim() : null);
    const cleanDispatchDate = isFiled ? null : (dispatch_date || null);
    const cleanSentTo = isFiled ? null : (sent_to || null);
    const cleanFileApprDate = isFiled ? (file_appr_date || null) : (file_appr_date || null);

    const updateSql = `
      UPDATE tapal_register SET
        month_year = COALESCE($1, month_year),
        tapal_type = COALESCE($2, tapal_type),
        curr_no = COALESCE($3, curr_no),
        office_seal_date = $4,
        received_sec_date = COALESCE($5, received_sec_date),
        subject = COALESCE($6, subject),
        letter_ref = $7,
        letter_date = $8,
        short_sub = $9,
        main_office = COALESCE($10, main_office),
        officer_desig = COALESCE($11, officer_desig),
        status = COALESCE($12, status),
        action_initiated = $13,
        file_no_ref = $14,
        file_init_date = $15,
        file_appr_date = $16,
        follow_up = $17,
        follow_up_date = $18,
        follow_up_closed_date = $19,
        follow_up_status = COALESCE($20, follow_up_status),
        remarks = $21,
        tech_sec_ref = $22,
        section = COALESCE($23, section),
        emp_desig = $24,
        sent_letter_no = $25,
        accounts_ref_no = $26,
        dispatch_date = $27,
        sent_to = $28,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $29
      RETURNING *
    `;

    const values = [
      month_year || null, tapal_type || null, curr_no ? parseInt(String(curr_no).replace(/[^0-9]/g, ''), 10) : null,
      office_seal_date || null, received_sec_date || null, subject || null, letter_ref || null, letter_date || null,
      short_sub || null, main_office || null, officer_desig || null, currentStatus, cleanActionInitiated,
      file_no_ref || null, cleanFileInitDate, cleanFileApprDate, follow_up || null, follow_up_date || null,
      follow_up_closed_date || null, follow_up_status || 'Open', remarks || null, tech_sec_ref || null,
      section || null, emp_desig || null, cleanSentLetterNo, cleanAccountsRefNo, cleanDispatchDate, cleanSentTo,
      id
    ];

    const result = await db.query(updateSql, values, updated_by || null, 'UPDATE');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Tapal record with ID ${id} not found` });
    }

    res.json({ message: 'Tapal updated successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error in PUT /api/tapal/:id:', err);
    res.status(500).json({ error: 'Failed to update Tapal record', details: err.message });
  }
});

// 4. DELETE /api/tapal/:id - Delete Tapal Entry
app.delete('/api/tapal/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const recId = parseInt(rawId, 10);
    let deleted = false;

    if (!isNaN(recId)) {
      // Cascading deletions on related tables to satisfy any foreign keys
      await db.query('DELETE FROM tapal_reminders WHERE tapal_id = $1', [recId]).catch(() => {});
      await db.query('DELETE FROM tapal_workflow_history WHERE tapal_id = $1', [recId]).catch(() => {});
      await db.query('DELETE FROM tapal_audit_logs WHERE tapal_id = $1', [recId]).catch(() => {});

      const result = await db.query('DELETE FROM tapal_register WHERE id = $1 RETURNING id', [recId], null, 'DELETE');
      if (result.rows && result.rows.length > 0) {
        deleted = true;
      } else {
        // Fallback by curr_no or s_no
        const fallbackRes = await db.query('DELETE FROM tapal_register WHERE curr_no = $1 OR s_no = $1 RETURNING id', [recId], null, 'DELETE');
        if (fallbackRes.rows && fallbackRes.rows.length > 0) deleted = true;
      }
    }

    res.json({ success: true, message: 'Tapal deleted successfully', id: rawId, deleted });
  } catch (err) {
    console.error('Error in DELETE /api/tapal/:id:', err);
    res.status(500).json({ error: 'Failed to delete Tapal record', details: err.message });
  }
});

// 5. GET /api/tapal/:id/reminders - Fetch all reminders for a specific Tapal
app.get('/api/tapal/:id/reminders', async (req, res) => {
  try {
    const tapalId = parseInt(req.params.id, 10);
    const sql = `
      SELECT id, tapal_id AS "tapalId", reminder_date AS "date", reminder_text AS "text", created_at AS "createdAt"
      FROM tapal_reminders
      WHERE tapal_id = $1
      ORDER BY reminder_date DESC, id DESC
    `;
    const result = await db.query(sql, [tapalId]);
    res.json({ success: true, tapalId, reminders: result.rows });
  } catch (err) {
    console.error('Error in GET /api/tapal/:id/reminders:', err);
    res.status(500).json({ error: 'Failed to fetch reminders', details: err.message });
  }
});

// 6. POST /api/tapal/:id/reminders - Add a reminder log to an existing Tapal record
app.post('/api/tapal/:id/reminders', async (req, res) => {
  try {
    const tapalId = parseInt(req.params.id, 10);
    const { reminder_date, date, reminder_text, text, userId } = req.body;
    const remDate = reminder_date || date || new Date().toISOString().split('T')[0];
    const remText = reminder_text || text || 'Reminder sent';

    const insertSql = `
      INSERT INTO tapal_reminders (tapal_id, reminder_date, reminder_text, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tapal_id AS "tapalId", reminder_date AS "date", reminder_text AS "text", created_at AS "createdAt"
    `;
    const result = await db.query(insertSql, [tapalId, remDate, remText, userId || null]);
    res.status(201).json({ success: true, reminder: result.rows[0] });
  } catch (err) {
    console.error('Error in POST /api/tapal/:id/reminders:', err);
    res.status(500).json({ error: 'Failed to add reminder', details: err.message });
  }
});

// 7. GET /api/kpi - Aggregate Executive Metrics directly from PostgreSQL
app.get('/api/kpi', async (req, res) => {
  try {
    const totalRes = await db.query('SELECT COUNT(*) FROM tapal_register');
    const pendingRes = await db.query("SELECT COUNT(*) FROM tapal_register WHERE status = 'Pending'");
    const statusBreakdown = await db.query('SELECT status, COUNT(*) FROM tapal_register GROUP BY status');
    const officeBreakdown = await db.query('SELECT main_office, COUNT(*) FROM tapal_register GROUP BY main_office');

    const total = parseInt(totalRes.rows[0].count, 10);
    const pending = parseInt(pendingRes.rows[0].count, 10);
    const processed = total - pending;

    res.json({
      totalReceived: total,
      processed,
      pending,
      completionRate: total > 0 ? ((processed / total) * 100).toFixed(1) : 0,
      statusCounts: statusBreakdown.rows,
      officeCounts: officeBreakdown.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute KPI metrics', details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TN Government Inward Tapal API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
