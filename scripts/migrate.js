require('dotenv').config();
const { Client } = require('pg');

const DDL = `
-- Drop existing tables if they exist to start fresh (in reverse dependency order)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS competition_enrollments;
DROP TABLE IF EXISTS competitions;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Create companies table (admin_id added later due to circular reference)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    place VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    is_verified BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) DEFAULT '',
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
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
    deleted_at TIMESTAMP DEFAULT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(10) DEFAULT NULL,
    otp_expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complete companies admin_id reference
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create competitions table
CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    skills_required TEXT[] DEFAULT '{}',
    experience_required VARCHAR(100) NOT NULL,
    other_requirements TEXT DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create composite competition enrollments join table
CREATE TABLE IF NOT EXISTS competition_enrollments (
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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
