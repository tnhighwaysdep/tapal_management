// =============================================================================
// TAPAL CHASE - Master Dropdown Data Set & Single Source of Truth
// (Consumed by both Client-Side app.js and Server-Side server.js validation)
// =============================================================================

(function(global) {
  'use strict';

  // 13.1 Tapal / Mail Type
  const TAPAL_TYPES = ['Tapal', 'Email', 'DO-Letter', 'Confidential'];

  // 13.2 Section Master List (Short Code -> Full Name Reverse Lookup)
  const SECTION_LOOKUP = {
    'ACCT': 'Accounts',
    'DB': 'Drawing Branch',
    'ESTT': 'Establishment',
    'R&B': 'Roads & Bridges',
    'PLG': 'Planning',
    'CRIF': 'Budget & CRIF',
    'CONT': 'Contract',
    'CMGT': 'Contract Management',
    'RSQC': 'Road Safety & QC'
  };

  const SECTIONS = ['ACCT', 'DB', 'ESTT', 'R&B', 'PLG', 'CRIF', 'CONT', 'CMGT', 'RSQC'];

  // Alias mapping for backward compatibility with legacy full names
  const SECTION_ALIASES = {
    'accounts': 'ACCT',
    'acct': 'ACCT',
    'accts': 'ACCT',
    'drawing branch': 'DB',
    'db': 'DB',
    'establishment': 'ESTT',
    'estt': 'ESTT',
    'aluvalagam': 'ESTT',
    'roads & bridges': 'R&B',
    'roads': 'R&B',
    'r&b': 'R&B',
    'rab': 'R&B',
    'planning': 'PLG',
    'plg': 'PLG',
    'budget & crif': 'CRIF',
    'budget': 'CRIF',
    'crif': 'CRIF',
    'bud': 'CRIF',
    'contract': 'CONT',
    'cont': 'CONT',
    'c': 'CONT',
    'contract management': 'CMGT',
    'cmgt': 'CMGT',
    'cm': 'CMGT',
    'road safety & qc': 'RSQC',
    'road safety': 'RSQC',
    'rsqc': 'RSQC',
    'rs/qc': 'RSQC'
  };

  function getCanonicalSectionCode(sec) {
    if (!sec) return '';
    const str = String(sec).trim();
    if (SECTION_LOOKUP[str]) return str;
    const lower = str.toLowerCase();
    return SECTION_ALIASES[lower] || str;
  }

  function getSectionFullName(sec) {
    const code = getCanonicalSectionCode(sec);
    return SECTION_LOOKUP[code] || sec || '';
  }

  // 13.3 Employee Designation (Cascades on Section Short Code)
  const EMPLOYEE_DESIGNATIONS = {
    'ACCT': ['CAO', 'AO 1', 'AO 2', 'Suptd 1', 'Suptd 2', 'Asst 1', 'Asst 2', 'Asst 3'],
    'DB': ['HDO', 'SDO I', 'SDO II', 'JDO 1', 'JDO 2', 'JDO 3', 'JDO 4', 'JDO 5', 'JDO 6'],
    'ESTT': ['AO', 'Suptd (Establishment)', 'Asst (Estt) 1', 'Asst (Estt) 2', 'Jr. Asst (Estt)'],
    'R&B': ['AE-RB1', 'AE-RB2'],
    'PLG': ['AE-PLG1', 'AE-PLG2'],
    'CRIF': ['AE-CRIF', 'AE-BUD'],
    'CONT': ['AE-OPP1', 'AE-OPP2'],
    'CMGT': ['AE-CM1', 'AE-CM2'],
    'RSQC': ['AE-RS', 'AE-QC']
  };

  function getEmployeeDesignations(sectionCode) {
    const code = getCanonicalSectionCode(sectionCode);
    return EMPLOYEE_DESIGNATIONS[code] || [];
  }

  // 13.4 Main Office Master List
  const MAIN_OFFICES = ['GOVT', 'MORTH', 'SE', 'DE', 'CE', 'AG', 'NHAI', 'Others'];

  // 13.5 Officer Designation Master & Default Auto-Merged Set (Cascades on Main Office)
  const DEFAULT_OFFICER_DESIGNATIONS = ['AG', 'IR', 'PS', 'DP', 'CAG Report', 'ATR', 'Others'];

  const OFFICER_DESIGNATIONS_RAW = {
    'GOVT': ['ACS', 'Pr. Secy', 'Secy', 'JS', 'DS', 'US', 'HV1', 'HV2', 'HN', 'HK', 'HM', 'HR', 'HQ', 'STF', 'FIN-Infra', 'FIN-BG', 'DS(CB)'],
    'MORTH': ['Secy', 'DGRD & SS', 'ADG', 'CE-South Zone', 'CE-HQ', 'SE-HQ', 'CE-RO-CNI', 'RO-CNI'],
    'SE': ['CNI-NH', 'SLM-NH', 'MDU-NH', 'C&M'],
    'DE': ['CNI-NH', 'VLR-NH', 'VPM-NH', 'SLM-NH', 'GOB-NH', 'MDU-NH', 'TRY-NH', 'TNV-NH', 'CNI-QC', 'SLM-QC', 'MDU-QC', 'C&M'],
    'CE': ['CE-NH', 'RCE-CNI', 'RCE-TRY', 'RCE-CBE', 'RCE-MDU', 'CE-PDI', 'CE-TNRSP', 'CE-CKICP', 'DRS-HRS', 'DG-HD'],
    'AG': ['PEN', 'GPF', 'FS'],
    'NHAI': ['RO-CNI', 'RO-MDU', 'PD-PIU', 'PD-TNRSP', 'PD-CKICP', 'TANSHA', 'TNRDC', 'JD-Training'],
    'Others': ['AG', 'IR', 'PS', 'DP', 'CAG Report', 'ATR', 'Others']
  };

  function getOfficerDesignations(mainOffice) {
    const officeKey = mainOffice || 'SE';
    const specific = OFFICER_DESIGNATIONS_RAW[officeKey] || [];
    const result = [...specific];
    DEFAULT_OFFICER_DESIGNATIONS.forEach(d => {
      if (!result.includes(d)) result.push(d);
    });
    return result;
  }

  // 13.6 Subject in Brief (Cascades on Section Short Code with Default Auto-Merge)
  const DEFAULT_SUBJECT_IN_BRIEF = ['Audit Para', 'Others'];

  const SUBJECT_IN_BRIEF_RAW = {
    'R&B': ['Estimate', 'COS', 'Toll Notification', 'Shifting of Utilities-AP', 'RCE-COS'],
    'CMGT': ['EOT', 'Bonus/Dispute', 'Court Case', 'Arbitration/CCIE', 'Pleader Fees', 'Ratification/LA'],
    'CONT': ['Tender', 'COT', 'Re-validation', 'RCE-Escalation'],
    'RSQC': ['Road Safety', 'QC', 'Blackspot', 'Hotspot'],
    'CRIF': ['RAS', 'AS Proposal', 'CRIF', 'Utility-CRIF', 'Setu Bandhan', 'Proposal', 'Inspection Report', 'Class III', 'Class II', 'BE/Training', 'RE', 'FMA', 'Reconciliation'],
    'PLG': ['Meeting', 'MOM', 'Status Report', 'Circular'],
    'ACCT': ['Leave Application', 'Audit Para/IR', 'UC', 'Expr/BN', 'Compilation', 'Reconciliation', 'Leave (Establishment)'],
    'DB': ['Petition', 'RTI', 'RSQ', 'LSQ', 'Cut Motion', 'LR', 'Assurance', 'Call Attn', 'CPGRAMS', 'Media', 'Rent', 'SDR'],
    'ESTT': ['Leave Application', 'Application-Surrender', 'App. Permission', 'App. GPF', 'App-Transfer', 'TA Bill', 'Sel./Spl. Gr.', 'PDL', 'FS', 'Transfer Order', 'Cir.', 'CCA', 'ER', 'Reports', 'App-Loans & Adv.']
  };

  function getSubjectInBrief(sectionCode) {
    const code = getCanonicalSectionCode(sectionCode) || 'ACCT';
    const specific = SUBJECT_IN_BRIEF_RAW[code] || [];
    const result = [...specific];
    DEFAULT_SUBJECT_IN_BRIEF.forEach(s => {
      if (!result.includes(s)) result.push(s);
    });
    return result;
  }

  // 13.7 Status Master List
  const STATUSES = ['Pending', 'Memo', 'Letter', 'Proceedings', 'DO Letter', 'Office Order', 'Others', 'Filed'];

  const INITIAL_TAPAL_DATA = [];

  // Export bundle
  const MASTER_DROPDOWN_DATA = {
    TAPAL_TYPES,
    SECTION_LOOKUP,
    SECTIONS,
    SECTION_ALIASES,
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
    STATUSES,
    INITIAL_TAPAL_DATA
  };

  // Expose to window/global object
  if (typeof global !== 'undefined') {
    global.DROPDOWN_DATA = MASTER_DROPDOWN_DATA;
    global.MASTER_DROPDOWN_DATA = MASTER_DROPDOWN_DATA;
    global.SECTION_LOOKUP = SECTION_LOOKUP;
    global.SECTIONS = SECTIONS;
    global.SECTION_ALIASES = SECTION_ALIASES;
    global.getCanonicalSectionCode = getCanonicalSectionCode;
    global.getSectionFullName = getSectionFullName;
    global.EMPLOYEE_DESIGNATIONS = EMPLOYEE_DESIGNATIONS;
    global.getEmployeeDesignations = getEmployeeDesignations;
    global.MAIN_OFFICES = MAIN_OFFICES;
    global.DEFAULT_OFFICER_DESIGNATIONS = DEFAULT_OFFICER_DESIGNATIONS;
    global.OFFICER_DESIGNATIONS_RAW = OFFICER_DESIGNATIONS_RAW;
    global.getOfficerDesignations = getOfficerDesignations;
    global.DEFAULT_SUBJECT_IN_BRIEF = DEFAULT_SUBJECT_IN_BRIEF;
    global.SUBJECT_IN_BRIEF_RAW = SUBJECT_IN_BRIEF_RAW;
    global.getSubjectInBrief = getSubjectInBrief;
    global.STATUSES = STATUSES;
    global.TAPAL_TYPES = TAPAL_TYPES;
    global.INITIAL_TAPAL_DATA = INITIAL_TAPAL_DATA;
  }

  // CommonJS export for Node.js (server.js)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MASTER_DROPDOWN_DATA;
  }

})(typeof window !== 'undefined' ? window : global);
