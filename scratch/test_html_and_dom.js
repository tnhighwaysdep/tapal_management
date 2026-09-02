const fs = require('fs');
const assert = require('assert');
const data = require('../data.js');

console.log('--- 1. Testing HTML Select Options against data.js ---');
const html = fs.readFileSync('./index.html', 'utf8');

// Check Section Options in HTML
data.SECTIONS.forEach(sec => {
  assert(html.includes(`value="${sec}"`), `index.html should include section value="${sec}"`);
});
console.log('✓ All 9 canonical sections present in index.html');

// Check Tapal Types in HTML
data.TAPAL_TYPES.forEach(t => {
  assert(html.includes(`value="${t}"`), `index.html should include tapal type value="${t}"`);
});
console.log('✓ All 4 canonical tapal types present in index.html');

// Check Main Offices in HTML
data.MAIN_OFFICES.forEach(off => {
  assert(html.includes(`value="${off}"`), `index.html should include main office value="${off}"`);
});
console.log('✓ All 8 canonical main offices present in index.html');

// Check Statuses in HTML
data.STATUSES.forEach(st => {
  assert(html.includes(`value="${st}"`), `index.html should include status value="${st}"`);
});
console.log('✓ All 8 canonical statuses present in index.html');

console.log('--- 2. Testing Cascading Logic with Dummy State ---');
// Verify Section to Employee Designation cascades
data.SECTIONS.forEach(sec => {
  const desigs = data.getEmployeeDesignations(sec);
  assert(Array.isArray(desigs) && desigs.length > 0, `Section ${sec} should have employee designations`);
});
console.log('✓ Every section successfully produces employee designations');

// Verify Main Office to Officer Designation cascades
data.MAIN_OFFICES.forEach(off => {
  const officers = data.getOfficerDesignations(off);
  assert(Array.isArray(officers) && officers.length > 0, `Office ${off} should have officer designations`);
  // Must include defaults
  data.DEFAULT_OFFICER_DESIGNATIONS.forEach(d => {
    assert(officers.includes(d), `Office ${off} officer list must include default ${d}`);
  });
});
console.log('✓ Every main office produces officer designations with all auto-merged defaults');

// Verify Section to Subject in Brief cascades
data.SECTIONS.forEach(sec => {
  const subs = data.getSubjectInBrief(sec);
  assert(Array.isArray(subs) && subs.length > 0, `Section ${sec} should have subject in brief list`);
  data.DEFAULT_SUBJECT_IN_BRIEF.forEach(d => {
    assert(subs.includes(d), `Section ${sec} subject list must include default ${d}`);
  });
});
console.log('✓ Every section produces subjects in brief with all auto-merged defaults');

console.log('\n🎉 ALL HTML & DATA INTEGRITY VERIFICATIONS PASSED SUCCESSFULLY!');
