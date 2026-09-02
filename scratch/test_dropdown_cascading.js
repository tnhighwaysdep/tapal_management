const assert = require('assert');
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
} = require('../data.js');

console.log('--- TEST 1: Tapal Types ---');
assert.deepStrictEqual(TAPAL_TYPES, ['Tapal', 'Email', 'DO-Letter', 'Confidential']);
console.log('✓ Tapal types match specification');

console.log('--- TEST 2: Section Codes and Reverse Lookup ---');
assert.strictEqual(getCanonicalSectionCode('Accounts'), 'ACCT');
assert.strictEqual(getCanonicalSectionCode('ACCT'), 'ACCT');
assert.strictEqual(getCanonicalSectionCode('Drawing Branch'), 'DB');
assert.strictEqual(getCanonicalSectionCode('DB'), 'DB');
assert.strictEqual(getCanonicalSectionCode('Roads & Bridges'), 'R&B');
assert.strictEqual(getCanonicalSectionCode('Budget & CRIF'), 'CRIF');
assert.strictEqual(getSectionFullName('ACCT'), 'Accounts');
assert.strictEqual(getSectionFullName('RSQC'), 'Road Safety & QC');
console.log('✓ Section canonical mapping and reverse lookup work perfectly');

console.log('--- TEST 3: Employee Designations by Section ---');
assert.deepStrictEqual(getEmployeeDesignations('ACCT'), ['CAO', 'AO 1', 'AO 2', 'Suptd 1', 'Suptd 2', 'Asst 1', 'Asst 2', 'Asst 3']);
assert.deepStrictEqual(getEmployeeDesignations('DB'), ['HDO', 'SDO I', 'SDO II', 'JDO 1', 'JDO 2', 'JDO 3', 'JDO 4', 'JDO 5', 'JDO 6']);
assert.deepStrictEqual(getEmployeeDesignations('ESTT'), ['AO', 'Suptd (Establishment)', 'Asst (Estt) 1', 'Asst (Estt) 2', 'Jr. Asst (Estt)']);
assert.deepStrictEqual(getEmployeeDesignations('R&B'), ['AE-RB1', 'AE-RB2']);
assert.deepStrictEqual(getEmployeeDesignations('PLG'), ['AE-PLG1', 'AE-PLG2']);
assert.deepStrictEqual(getEmployeeDesignations('CRIF'), ['AE-CRIF', 'AE-BUD']);
assert.deepStrictEqual(getEmployeeDesignations('CONT'), ['AE-OPP1', 'AE-OPP2']);
assert.deepStrictEqual(getEmployeeDesignations('CMGT'), ['AE-CM1', 'AE-CM2']);
assert.deepStrictEqual(getEmployeeDesignations('RSQC'), ['AE-RS', 'AE-QC']);
console.log('✓ Employee designations cascade correctly on section');

console.log('--- TEST 4: Officer Designations with Auto-Merged Defaults ---');
const govtOfficers = getOfficerDesignations('GOVT');
assert(govtOfficers.includes('ACS'));
assert(govtOfficers.includes('Pr. Secy'));
assert(govtOfficers.includes('AG'));
assert(govtOfficers.includes('Others'));

const morthOfficers = getOfficerDesignations('MORTH');
assert(morthOfficers.includes('DGRD & SS'));
assert(morthOfficers.includes('CE-South Zone'));
assert(morthOfficers.includes('AG'));
assert(morthOfficers.includes('Others'));

const seOfficers = getOfficerDesignations('SE');
assert(seOfficers.includes('CNI-NH'));
assert(seOfficers.includes('SLM-NH'));
assert(seOfficers.includes('MDU-NH'));
assert(seOfficers.includes('C&M'));
assert(seOfficers.includes('CAG Report'));

console.log('✓ Officer designations cascade correctly with auto-merged defaults');

console.log('--- TEST 5: Subject in Brief with Auto-Merged Defaults ---');
const rbSubs = getSubjectInBrief('R&B');
assert(rbSubs.includes('Estimate'));
assert(rbSubs.includes('COS'));
assert(rbSubs.includes('Toll Notification'));
assert(rbSubs.includes('Audit Para'));
assert(rbSubs.includes('Others'));

const cmgtSubs = getSubjectInBrief('CMGT');
assert(cmgtSubs.includes('EOT'));
assert(cmgtSubs.includes('Bonus/Dispute'));
assert(cmgtSubs.includes('Court Case'));
assert(cmgtSubs.includes('Audit Para'));
assert(cmgtSubs.includes('Others'));

const acctSubs = getSubjectInBrief('ACCT');
assert(acctSubs.includes('Leave Application'));
assert(acctSubs.includes('Audit Para/IR'));
assert(acctSubs.includes('UC'));
assert(acctSubs.includes('Audit Para'));
assert(acctSubs.includes('Others'));

console.log('✓ Subject in Brief cascades correctly with auto-merged defaults');

console.log('--- TEST 6: Statuses ---');
assert.deepStrictEqual(STATUSES, ['Pending', 'Memo', 'Letter', 'Proceedings', 'DO Letter', 'Office Order', 'Others', 'Filed']);
console.log('✓ Statuses list matches specification');

console.log('\n🎉 ALL MASTER DATASET & CASCADING TESTS PASSED!');
