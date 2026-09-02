# 🏛️ Tamil Nadu Highways Department — Inward Tapal Management System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Supported-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: Government Use](https://img.shields.io/badge/License-Tamil%20Nadu%20Govt%20Internal-blue.svg)](LICENSE)

A modern, high-efficiency, enterprise-grade digital inward letter and tapal tracking system engineered specifically for the **Highways & Minor Ports Department, Government of Tamil Nadu**.

This system streamlines the receipt, registry, assignment, workflow progression, and archival of official communications (Government Orders, Letters, D.O. Letters, Memos, Proceedings, and Emails) across departmental wings, divisions, and field offices.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [User Roles & Demo Credentials](#-user-roles--demo-credentials)
- [Database Schema](#-database-schema)
- [Installation & Setup](#-installation--setup)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Environment Configuration](#3-environment-configuration)
  - [4. Database Setup & Seeding](#4-database-setup--seeding)
  - [5. Run the Server](#5-run-the-server)
- [REST API Reference](#-rest-api-reference)
- [Deployment Options](#-deployment-options)
- [License & Disclaimer](#-license--disclaimer)

---

## ✨ Key Features

### 📨 Digital Tapal Inward Registry
* **Structured Entry**: Captures Current Number (Inward No), Month/Year, Tapal Type (`Tapal`, `Letter`, `Email`, `DO letter`, `G.O.`), Office Seal Date, Received Section Date, Subject, Short Subject, Letter Reference, and Sender Details.
* **Smart Searchable Dropdowns**: Auto-complete and dynamic options for Main Offices (`SE`, `DE`, `MORTH`, `GOVT`, `CE`), Officer Designations, and Sections.
* **Live Status Pipeline**: Real-time tracking through `Pending` ➔ `Letter` ➔ `Memo` ➔ `Filed` ➔ `Proceeding`.

### 🛡️ Role-Based Access Control (RBAC)
* Granular access control for **Super Admin / Chief Engineer**, **Superintending Engineers (SE)**, **Divisional Engineers (DE)**, **Section Officers / Planning Engineers**, **Superintendents**, and **Inward Clerks**.
* Integrated **One-Click Quick Login** profile switch for rapid verification and role testing.

### 🔒 Date Lock & Security Controls
* Administrative lock mechanism preventing unauthorized retroactive edits to entry dates.
* Authorized officers can unlock and release date constraints with mandatory audit logging.

### 🔍 Search & Filtering Hub
* Multi-dimensional search across subjects, references, inward numbers, sections, and dates.
* Quick date presets (Today, Yesterday, Last 7 Days, Month-to-date, Custom Range).
* Section-wise breakdown and status counter statistics dashboard.

### 📜 Audit Logs & Workflow History
* Automatic capture of all user operations, edits, status updates, and date modifications.
* Complete timeline history for every tapal record.

### 📊 Export & Offline Resilience
* Instant export to formatted **Excel / CSV** and printable formats conforming to TN Government register layouts.
* Standalone fallback mode ensuring continuous operation even during database network interruptions.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│             Tamil Nadu Highways Portal (UI)            │
│      Vanilla HTML5 + CSS3 (Govt Theme) + JS (ES6)      │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON
┌───────────────────────────▼────────────────────────────┐
│               Express.js REST API Server               │
│        (Auth, Tapal CRUD, Date Lock, Audit Log)        │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
┌─────────────▼──────────────┐ ┌───────────▼─────────────┐
│  PostgreSQL (Local / SDC)  │ │ Supabase Cloud Database │
│  (pg_trgm, UUID, Triggers) │ │ (Managed Cloud Engine)  │
└────────────────────────────┘ └─────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | Vanilla HTML5, Custom Responsive CSS3 (Glassmorphism & TN Govt Emerald/Gold Palette), Vanilla ES6 JavaScript |
| **Backend** | Node.js, Express.js (`4.19+`), CORS, Dotenv |
| **Database** | PostgreSQL 13+ / Supabase Cloud PostgreSQL, `pg` (Connection Pooling) |
| **Search Engine** | PostgreSQL `pg_trgm` (Trigram Text Matching) |
| **Deployment** | Node.js Server, PM2, Docker, or Vercel Serverless (`vercel.json`) |

---

## 👥 User Roles & Demo Credentials

The application includes built-in demo profiles for immediate testing:

| Username | Password | Full Name / Officer | Role / Designation | Wing / Office |
|---|---|---|---|---|
| `admin` | `admin123` | Executive Chief Engineer | Super Admin / Chief Engineer | Executive (CE) |
| `se_slm` | `se123` | Superintending Engineer | SE Officer / SE Salem | Planning / Budget (SE) |
| `de_cbe` | `de123` | Divisional Engineer | DE Officer / DE Coimbatore | Roads (DE) |
| `planning` | `plan123` | Planning Officer | Section Officer / Assistant Engineer | Planning / Budget |
| `ganeshkumar` | `ganesh123` | Ganeshkumar | Officer / Assistant Executive Engineer | Planning / Budget |
| `kousalya` | `kousalya123` | Kousalya | Officer / Assistant Engineer | Planning / Budget |
| `kamini` | `kamini123` | Kamini | Superintendent | Planning / Budget |
| `hema` | `hema123` | Hema | Inward Clerk | Planning / Budget |

---

## 🗄️ Database Schema

The database schema is defined in [`schema.sql`](schema.sql) and consists of:

1. **`offices`**: Departmental divisions (`SE`, `DE`, `MORTH`, `GOVT`, `CE`).
2. **`users`**: Officers, staff profiles, password hashes, and RBAC roles.
3. **`tapal_register`**: Core register containing all 30+ official tapal metadata columns.
4. **`tapal_workflow_history`**: Audit trail of every status transition, remarks, and user actions.
5. **`tapal_audit_logs`**: Security audit log for record updates and security setting modifications.
6. **`custom_dropdown_options`**: Dynamic section and office lookup values.
7. **`system_settings`**: Global configuration flags (e.g., `date_lock_enabled`).

---

## 🚀 Installation & Setup

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)
* **PostgreSQL** (v13+ installed locally) **OR** a free **Supabase** cloud account.

---

### 1. Clone Repository
```bash
git clone https://github.com/tnhighwaysdep/tapal_management.git
cd tapal_management
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to create your active `.env` file:
```bash
cp .env.example .env
```

Edit `.env` to configure your connection:

#### Option A: Supabase Connection String (Recommended)
```env
PORT=3000
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

#### Option B: Local PostgreSQL Database
```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=tapal_db
PGUSER=postgres
PGPASSWORD=your_password
PGSSL=false
```

---

### 4. Database Setup & Seeding

#### If using Supabase Cloud:
Run the automated schema and data migration tool:
```bash
npm run setup:supabase
```

#### If using Local PostgreSQL:
Execute the schema script in your local PostgreSQL instance:
```bash
# Create local database (if not exists)
psql -U postgres -c "CREATE DATABASE tapal_db;"

# Apply schema & initial seed
psql -U postgres -d tapal_db -f schema.sql

# Or run the Node.js seed script
npm run seed
```

---

### 5. Run the Server

Start the application:
```bash
npm start
```

Access the portal in your web browser:
```
http://localhost:3000
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/health` | Service health & PostgreSQL connection check | Public |
| `GET` | `/api/config/dropdowns` | Master dropdown options & section taxonomy | Public |
| `POST` | `/api/auth/login` | Officer / User authentication & session init | Public |
| `GET` | `/api/auth/users` | List active officers and staff members | Authenticated |
| `GET` | `/api/tapals` | Paginated search, filter & fetch tapal records | Authenticated |
| `GET` | `/api/tapals/:id` | Fetch specific tapal record by ID | Authenticated |
| `POST` | `/api/tapals` | Create and register a new inward tapal | Inward / Officers |
| `PUT` | `/api/tapals/:id` | Update existing tapal record & record history | Officers / Admin |
| `DELETE` | `/api/tapals/:id` | Soft / Hard delete tapal record | Super Admin |
| `GET` | `/api/tapals/stats/overview` | Fetch analytics counts by status & section | Authenticated |
| `GET` | `/api/settings/date-lock` | Check current inward date lock status | Authenticated |
| `POST` | `/api/settings/date-lock` | Toggle date lock / release control | Admin / SE |
| `GET` | `/api/audit-logs` | Retrieve chronological security audit trail | Admin |

---

## ☁️ Deployment Options

### Vercel Serverless
This repository includes [`vercel.json`](vercel.json) and [`api/index.js`](api/index.js) for one-click deployment on Vercel:
1. Push your code to GitHub.
2. Import repository into [Vercel](https://vercel.com).
3. Set environment variable `DATABASE_URL` with your Supabase PostgreSQL connection string.
4. Deploy.

### Production Linux Server (TNeGA / SDC / NIC / Cloud VM)
Use **PM2** process manager for high-availability production runtime:
```bash
# Install PM2 globally
npm install -g pm2

# Start service with PM2
pm2 start server.js --name "tn-tapal-system"

# Enable auto-restart on system reboot
pm2 startup
pm2 save
```

---

## 🏛️ Project Structure

```
.
├── .env.example          # Environment variables template
├── api/
│   └── index.js          # Vercel serverless entrypoint
├── app.js                # Frontend application logic & UI handlers
├── data.js               # Master constants, section lookups, and sample records
├── db.js                 # PostgreSQL connection pool & query engine
├── hero_gov_building.jpg # Portal theme imagery
├── index.html            # Main Portal HTML Single-Page Application
├── package.json          # Project manifest and scripts
├── schema.sql            # PostgreSQL DDL schema & constraints
├── searchable-select.js  # Accessible dynamic search-select custom component
├── seed_postgresql.js    # Local PostgreSQL database seeder
├── server.js             # Express.js REST API server
├── setup_supabase.js     # Supabase automated cloud setup script
├── styles.css            # Responsive TN Government portal design system
├── theme.js              # Theme manager & dark/light mode controller
└── vercel.json           # Vercel deployment configuration
```

---

## ⚖️ License & Disclaimer

Designed and developed for official administrative operations of the **Highways Department, Government of Tamil Nadu**. All rights reserved.
