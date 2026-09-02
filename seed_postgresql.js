// Seed Script to populate PostgreSQL tapal_register table from initial dataset
const fs = require('fs');
const path = require('path');
const db = require('./db');

// Load INITIAL_TAPAL_DATA from data.js
function parseDataFile() {
  const fileContent = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  // Match content between INITIAL_TAPAL_DATA = [ ... ];
  const jsonMatch = fileContent.match(/const INITIAL_TAPAL_DATA = (\[[\s\S]*?\]);/);
  if (!jsonMatch) {
    throw new Error('Failed to parse INITIAL_TAPAL_DATA from data.js');
  }
  return JSON.parse(jsonMatch[1]);
}

async function seedPostgreSQL() {
  console.log('--- Starting PostgreSQL Data Seeding ---');
  const records = parseDataFile();
  console.log(`Parsed ${records.length} records from data.js.`);

  try {
    // Truncate existing entries for clean re-seed
    await db.query('TRUNCATE TABLE tapal_register RESTART IDENTITY CASCADE');
    console.log('Truncated tapal_register table.');

    let inserted = 0;
    for (const r of records) {
      const sql = `
        INSERT INTO tapal_register (
          s_no, month_year, tapal_type, curr_no, office_seal_date, received_sec_date,
          subject, letter_ref, letter_date, short_sub, main_office, officer_desig,
          status, action_initiated, file_no_ref, file_init_date, file_appr_date,
          follow_up, follow_up_date, follow_up_closed_date, follow_up_status, remarks, tech_sec_ref, section,
          emp_desig, sent_letter_no, accounts_ref_no, dispatch_date, sent_to
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      `;

      const values = [
        r.sNo || inserted + 1,
        r.month || 'FEB-2023',
        r.tapalType || 'Tapal',
        r.currNo ? parseInt(r.currNo, 10) : 0,
        r.sealDate && r.sealDate !== '' ? r.sealDate : null,
        r.recSecDate && r.recSecDate !== '' ? r.recSecDate : '2023-02-01',
        r.subject || 'N/A',
        r.letterRef ? String(r.letterRef) : null,
        r.letterDate && r.letterDate !== '' ? r.letterDate : null,
        r.shortSub || null,
        r.mainOffice || 'CE',
        r.officerDesig || 'General',
        r.status || 'Pending',
        r.actionInitiated || null,
        r.fileNoRef || null,
        r.fileInitDate && r.fileInitDate !== '' ? r.fileInitDate : null,
        r.fileApprDate && r.fileApprDate !== '' ? r.fileApprDate : null,
        r.followUp || null,
        r.followUpDate && r.followUpDate !== '' ? r.followUpDate : null,
        r.followUpClosedDate && r.followUpClosedDate !== '' ? r.followUpClosedDate : null,
        r.followUpStatus || 'Open',
        r.remarks || null,
        r.techSecRef || null,
        r.section || 'Planning/Budget',
        r.empDesig || null,
        r.sentLetterNo ? String(r.sentLetterNo) : null,
        r.accountsRefNo ? String(r.accountsRefNo) : null,
        r.dispatchDate && r.dispatchDate !== '' ? r.dispatchDate : null,
        r.sentTo || null
      ];

      await db.query(sql, values);
      inserted++;
    }

    console.log(`Successfully seeded ${inserted} records into PostgreSQL tapal_register!`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedPostgreSQL();
}
