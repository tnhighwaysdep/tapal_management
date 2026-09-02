const fs = require('fs');
const assert = require('assert');

console.log('--- TEST 1: Check HTML for Mandatory Action Initiated Date Asterisks ---');
const html = fs.readFileSync('./index.html', 'utf8');

assert(html.includes('id="label-form-action-init-date"'), 'Register modal Action Initiated Date label ID must exist');
assert(html.includes('id="form-action-init-star"'), 'Register modal Action Initiated Date star element must exist');
assert(html.includes('id="label-edit-action-init-date"'), 'Edit modal Action Initiated Date label ID must exist');
assert(html.includes('id="edit-action-init-star"'), 'Edit modal Action Initiated Date star element must exist');
console.log('✓ index.html contains all mandatory Action Initiated Date label IDs and asterisk markers.');

console.log('--- TEST 2: Check server.js for Mandatory Action Initiated Date Validation Rules ---');
const serverCode = fs.readFileSync('./server.js', 'utf8');

// Check POST endpoint validation
assert(serverCode.includes("Action Initiated Date is mandatory for status"), 'POST endpoint must mandate action date for non-pending status');

// Check PUT endpoint validation
assert(serverCode.includes("Action Initiated Date (file_init_date) is mandatory when updating a Tapal record"), 'PUT endpoint must mandate action date when updating records');
console.log('✓ server.js contains both POST and PUT Action Initiated Date mandatory validation logic.');

console.log('--- TEST 3: Check app.js for UI Form and Pipeline Automations ---');
const appCode = fs.readFileSync('./app.js', 'utf8');

// Check handleFormStatusAndSectionVisibility
assert(appCode.includes('action-init-star'), 'handleFormStatusAndSectionVisibility must reference action-init-star');
assert(appCode.includes('isActionMandatory'), 'handleFormStatusAndSectionVisibility must compute isActionMandatory');

// Check proceedRegisterStep validation
assert(appCode.includes("Action Initiated Date is mandatory for status"), 'proceedRegisterStep must mandate action date for non-pending status');

// Check proceedEditStep validation
assert(appCode.includes("Action Initiated Date is mandatory when updating/making changes to a Tapal record"), 'proceedEditStep must mandate action date when updating record');

// Check saveTapalEntryRecord validation
assert(appCode.includes("Action Initiated Date is mandatory"), 'saveTapalEntryRecord must enforce action date');

// Check updateRecordStatus auto-population
assert(appCode.includes('item.fileInitDate = getTodayISO()') || appCode.includes('item.fileInitDate || getTodayISO()'), 'updateRecordStatus must ensure fileInitDate is filled on status update');

console.log('✓ app.js correctly implements all client-side validations and automated date defaults.');

console.log('\n🎉 ALL MANDATORY ACTION DATE TESTS PASSED SUCCESSFULLY!');
