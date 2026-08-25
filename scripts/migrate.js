require('dotenv').config();
const { Client } = require('pg');

const DDL = `
-- Drop existing tables if they exist to start fresh (in reverse dependency order)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS competition_enrollments;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS installations CASCADE;
DROP TABLE IF EXISTS competitions;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Create companies table (admin_id added later due to circular reference)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    place VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    is_verified BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) DEFAULT '',
    email VARCHAR(255),
    phone VARCHAR(20),
    password VARCHAR(255),
    google_id VARCHAR(255),
    github_id VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'local',
    role VARCHAR(50) DEFAULT 'user',
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    is_approved BOOLEAN DEFAULT TRUE,
    experience TEXT DEFAULT '',
    skills TEXT[] DEFAULT '{}',
    education TEXT DEFAULT '',
    projects TEXT DEFAULT '',
    resume_url TEXT DEFAULT '',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(10) DEFAULT NULL,
    otp_expires_at TIMESTAMPTZ DEFAULT NULL,
    must_reset_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Complete companies admin_id reference
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    skills_required TEXT[] DEFAULT '{}',
    experience_required VARCHAR(100) NOT NULL,
    other_requirements TEXT DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create composite competition enrollments join table
CREATE TABLE IF NOT EXISTS competition_enrollments (
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (competition_id, user_id)
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    performed_by_name VARCHAR(255) DEFAULT 'System',
    performed_by_email VARCHAR(255) DEFAULT 'N/A',
    target_type VARCHAR(100) DEFAULT 'System',
    target_id INTEGER DEFAULT NULL,
    target_name VARCHAR(255) DEFAULT 'N/A',
    target_email VARCHAR(255) DEFAULT 'N/A',
    changes JSONB DEFAULT NULL,
    details TEXT DEFAULT '',
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create installations table
CREATE TABLE IF NOT EXISTS installations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    org_login VARCHAR(255) NOT NULL,
    installation_id BIGINT NOT NULL UNIQUE,
    installed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    repo_url VARCHAR(500) NOT NULL,
    evaluation_id VARCHAR(36),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    final_score FLOAT,
    band VARCHAR(20),
    confidence FLOAT,
    reasons JSONB,
    attributes JSONB,
    error_message TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_evaluation_id ON submissions (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_submissions_competition_user ON submissions (competition_id, user_id);

-- Drop old plain unique constraints to support soft-deleted entry reuse
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_google_id_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_github_id_key;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_name_key;

-- Create active-only partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_key ON users (email) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_active_key ON users (phone) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_active_key ON users (google_id) WHERE is_deleted = false AND google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_active_key ON users (github_id) WHERE is_deleted = false AND github_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS companies_name_active_key ON companies (name) WHERE is_deleted = false;

-- Add column if not exists for incremental updates and backfill existing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT TRUE;
UPDATE users SET must_reset_password = FALSE WHERE role != 'company_employee';

-- GitHub Onboarding Schema updates
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(255) DEFAULT NULL;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS github_template_repo VARCHAR(500) DEFAULT NULL;
ALTER TABLE competition_enrollments ADD COLUMN IF NOT EXISTS repo_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE competition_enrollments ADD COLUMN IF NOT EXISTS repo_created_at TIMESTAMPTZ DEFAULT NULL;
`;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Running DDL scripts...');
    await client.query(DDL);
    console.log('PostgreSQL schema migration completed successfully!');
  } catch (err) {
    console.error('Migration Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
