-- =============================================================================
-- TAMIL NADU GOVERNMENT INWARD TAPAL TRACKING SYSTEM
-- Production PostgreSQL Database Schema DDL
-- Compatible with PostgreSQL 13+ / TNeGA State Data Centre / NIC Cloud
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Drop existing tables if recreating
DROP TABLE IF EXISTS tapal_audit_logs CASCADE;
DROP TABLE IF EXISTS tapal_workflow_history CASCADE;
DROP TABLE IF EXISTS tapal_register CASCADE;
DROP TABLE IF EXISTS custom_dropdown_options CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS offices CASCADE;

-- -----------------------------------------------------------------------------
-- 1. Offices / Departments Lookup Table
-- -----------------------------------------------------------------------------
CREATE TABLE offices (
    id SERIAL PRIMARY KEY,
    office_code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'SE', 'DE', 'MORTH', 'GOVT', 'CE'
    office_name VARCHAR(150) NOT NULL,
    division_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Offices
INSERT INTO offices (office_code, office_name, division_name) VALUES
('SE', 'Superintending Engineer Office', 'Highways Department'),
('DE', 'Divisional Engineer Office', 'National Highways'),
('MORTH', 'Ministry of Road Transport & Highways', 'Government of India'),
('GOVT', 'Government Secretariat', 'State Highways Dept'),
('CE', 'Chief Engineer Office', 'National Highways CEO');

-- -----------------------------------------------------------------------------
-- 2. Users & Officers Table (Role-Based Access)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) DEFAULT 'admin123',
    full_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('INWARD_CLERK', 'SUPERINTENDENT', 'OFFICER', 'ADMIN', 'Super Admin', 'SE Officer', 'DE Officer', 'Section Officer')),
    wing VARCHAR(100) DEFAULT 'PLANNING / BUDGET',
    office_id INT REFERENCES offices(id),
    email VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Officers & Official Users
INSERT INTO users (username, password, full_name, designation, role, wing, office_id, email) VALUES
('admin', 'admin123', 'Executive Chief Engineer', 'Chief Engineer', 'Super Admin', 'EXECUTIVE', 5, 'admin@tn.gov.in'),
('se_slm', 'se123', 'Superintending Engineer', 'SE Salem', 'SE Officer', 'PLANNING / BUDGET', 1, 'se_slm@tn.gov.in'),
('de_cbe', 'de123', 'Divisional Engineer', 'DE Coimbatore', 'DE Officer', 'ROADS', 2, 'de_cbe@tn.gov.in'),
('planning', 'plan123', 'Planning Officer', 'Assistant Engineer', 'Section Officer', 'PLANNING / BUDGET', 5, 'planning@tn.gov.in'),
('ganeshkumar', 'ganesh123', 'Ganeshkumar', 'Assistant Executive Engineer', 'OFFICER', 'PLANNING / BUDGET', 5, 'ganesh@tn.gov.in'),
('kousalya', 'kousalya123', 'Kousalya', 'Assistant Engineer', 'OFFICER', 'PLANNING / BUDGET', 5, 'kousalya@tn.gov.in'),
('kamini', 'kamini123', 'Kamini', 'Superintendent', 'SUPERINTENDENT', 'PLANNING / BUDGET', 5, 'kamini@tn.gov.in'),
('kasirajan', 'kasi123', 'Kasirajan', 'Divisional Engineer', 'OFFICER', 'ROADS', 2, 'kasirajan@tn.gov.in'),
('hema', 'hema123', 'Hema', 'Inward Clerk', 'INWARD_CLERK', 'PLANNING / BUDGET', 5, 'hema@tn.gov.in');

-- -----------------------------------------------------------------------------
-- 3. Core Inward Tapal Register Table (All Columns Including Section)
-- -----------------------------------------------------------------------------
CREATE TABLE tapal_register (
    id BIGSERIAL PRIMARY KEY,
    s_no INT NOT NULL,
    month_year VARCHAR(15) NOT NULL, -- e.g., 'FEB-2023'
    tapal_type VARCHAR(30) DEFAULT 'Tapal', -- Tapal, Letter, Email, DO letter, G.O.
    curr_no BIGINT NOT NULL, -- Inward current number (whole number e.g. 718)
    office_seal_date DATE,
    received_sec_date DATE NOT NULL,
    subject TEXT NOT NULL,
    letter_ref VARCHAR(150),
    letter_date DATE,
    short_sub VARCHAR(100),
    main_office VARCHAR(50) NOT NULL, -- SE, DE, MORTH, GOVT, CE
    officer_desig VARCHAR(100) NOT NULL,
    status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Letter', 'Memo', 'Filed', 'Proceeding')),
    action_initiated TEXT,
    file_no_ref VARCHAR(150),
    file_init_date DATE,
    file_appr_date DATE,
    follow_up TEXT,
    follow_up_date DATE,
    follow_up_closed_date DATE,
    follow_up_status VARCHAR(30) DEFAULT 'Open',
    remarks TEXT,
    tech_sec_ref VARCHAR(100),
    section VARCHAR(100) DEFAULT 'Planning/Budget',
    emp_desig VARCHAR(100),
    sent_letter_no VARCHAR(100),
    accounts_ref_no VARCHAR(100),
    dispatch_date DATE,
    sent_to TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Full-Text Search Column for High-Efficiency Search Over 100k+ Records
ALTER TABLE tapal_register ADD COLUMN search_vector tsvector 
    GENERATED ALWAYS AS (
        to_tsvector('english', 
            coalesce(subject, '') || ' ' || 
            coalesce(letter_ref, '') || ' ' || 
            coalesce(file_no_ref, '') || ' ' || 
            coalesce(action_initiated, '') || ' ' ||
            coalesce(officer_desig, '') || ' ' ||
            coalesce(short_sub, '') || ' ' ||
            coalesce(section, '') || ' ' ||
            coalesce(sent_letter_no, '') || ' ' ||
            coalesce(accounts_ref_no, '')
        )
    ) STORED;

-- High Performance Indexes
CREATE INDEX idx_tapal_search ON tapal_register USING GIN(search_vector);
CREATE INDEX idx_tapal_curr_no ON tapal_register(curr_no);
CREATE INDEX idx_tapal_status ON tapal_register(status);
CREATE INDEX idx_tapal_rec_date ON tapal_register(received_sec_date);
CREATE INDEX idx_tapal_office ON tapal_register(main_office);
CREATE INDEX idx_tapal_officer ON tapal_register(officer_desig);
CREATE INDEX idx_tapal_section ON tapal_register(section);

-- -----------------------------------------------------------------------------
-- 4. Global System Settings (Date Lock / System Controls)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Settings
INSERT INTO system_settings (key, value) VALUES 
('date_lock_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Dynamic Custom Dropdown Options & Mappings
-- -----------------------------------------------------------------------------
CREATE TABLE custom_dropdown_options (
    id SERIAL PRIMARY KEY,
    category_key VARCHAR(50) NOT NULL, -- e.g., 'shortSub', 'empDesig', 'section'
    option_value VARCHAR(100) NOT NULL,
    section_name VARCHAR(100), -- Section mapping if applicable (e.g. 'Roads', 'Accounts')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category_key, option_value, section_name)
);

-- Seed Default Section Designation Mappings
INSERT INTO custom_dropdown_options (category_key, option_value, section_name) VALUES
('empDesig', 'CAO', 'Accounts'),
('empDesig', 'AO I', 'Accounts'),
('empDesig', 'AO II', 'Accounts'),
('empDesig', 'supdt', 'Accounts'),
('empDesig', 'Asst', 'Accounts'),
('empDesig', 'jr.Asst', 'Accounts'),
('empDesig', 'HDO', 'Drawing Branch'),
('empDesig', 'SDO I', 'Drawing Branch'),
('empDesig', 'SDO II', 'Drawing Branch'),
('empDesig', 'JDO I', 'Drawing Branch'),
('empDesig', 'JDO II', 'Drawing Branch'),
('empDesig', 'JDO III', 'Drawing Branch'),
('empDesig', 'JDO IV', 'Drawing Branch'),
('empDesig', 'AE I', 'Roads'),
('empDesig', 'AE II', 'Roads');

-- -----------------------------------------------------------------------------
-- 5. Workflow History Tracking (Stage Transitions)
-- -----------------------------------------------------------------------------
CREATE TABLE tapal_workflow_history (
    id BIGSERIAL PRIMARY KEY,
    tapal_id BIGINT REFERENCES tapal_register(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    action_taken TEXT,
    handled_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. Tapal Reminders & Follow-Up Logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tapal_reminders (
    id BIGSERIAL PRIMARY KEY,
    tapal_id BIGINT REFERENCES tapal_register(id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reminder_text TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tapal_reminders_tapal_id ON tapal_reminders(tapal_id);
CREATE INDEX IF NOT EXISTS idx_tapal_reminders_date ON tapal_reminders(reminder_date);

-- -----------------------------------------------------------------------------
-- 7. Audit Logging (Security & Privacy Compliance)
-- -----------------------------------------------------------------------------
CREATE TABLE tapal_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tapal_id BIGINT REFERENCES tapal_register(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE, VIEW, EXPORT
    ip_address VARCHAR(45),
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Row-Level Security (RLS) Policy Example
ALTER TABLE tapal_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY tapal_office_isolation ON tapal_register
    FOR ALL
    TO PUBLIC
    USING (
        current_setting('app.current_role', true) = 'ADMIN' OR 
        main_office = current_setting('app.current_office', true)
    );

