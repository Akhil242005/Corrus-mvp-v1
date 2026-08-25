require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    console.log('Connecting to PostgreSQL database for seeding...');
    await client.connect();

    // 1. Clear existing data in tables (without dropping schemas)
    console.log('Clearing existing data from tables...');
    await client.query('TRUNCATE audit_logs, competition_enrollments, submissions, installations, competitions, users, companies CASCADE');

    // 2. Hash default password
    const hashedPassword = await bcrypt.hash('Password123', 10);

    // 3. Seed Companies
    console.log('Seeding companies...');
    const companyRes = await client.query(
      `INSERT INTO companies (name, place, description, website, is_verified) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      ['Corrus Labs', 'San Francisco, CA', 'Excellence in verification testing and sandboxing.', 'https://corrus.io', true]
    );
    const companyId = companyRes.rows[0].id;

    // 4. Seed Users (Admin, Company Admin, Candidate)
    console.log('Seeding users...');
    
    // Platform Admin
    const adminRes = await client.query(
      `INSERT INTO users (firstname, lastname, email, password, role, is_email_verified, must_reset_password) 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING id`,
      ['John', 'Admin', 'admin@corrus.io', hashedPassword, 'admin', true]
    );

    // Company Admin
    const companyAdminRes = await client.query(
      `INSERT INTO users (firstname, lastname, email, password, role, company_id, is_approved, is_email_verified, must_reset_password) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) 
       RETURNING id`,
      ['Jane', 'Employer', 'employer@corrus.io', hashedPassword, 'company_admin', companyId, true, true]
    );
    const companyAdminId = companyAdminRes.rows[0].id;

    // Associate Admin with Company
    await client.query('UPDATE companies SET admin_id = $1 WHERE id = $2', [companyAdminId, companyId]);

    // Candidate User
    const candidateRes = await client.query(
      `INSERT INTO users (firstname, lastname, email, password, role, is_email_verified, experience, skills, must_reset_password) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) 
       RETURNING id`,
      ['Alex', 'Candidate', 'candidate@corrus.io', hashedPassword, 'user', true, '2 years Full Stack dev', ['React', 'Node.js', 'PostgreSQL']]
    );
    const candidateId = candidateRes.rows[0].id;

    // 5. Seed Competitions
    console.log('Seeding competitions...');
    const compRes = await client.query(
      `INSERT INTO competitions (company_id, title, task_description, language, experience_required, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [
        companyId, 
        'Database Optimization Challenge', 
        'Design and optimize query plans, indexes, and schema definitions on a PostgreSQL environment.', 
        'Python',
        'Mid Level', 
        companyAdminId
      ]
    );
    const compId = compRes.rows[0].id;

    // 6. Seed Enrollment
    console.log('Seeding competition enrollment...');
    await client.query(
      'INSERT INTO competition_enrollments (competition_id, user_id) VALUES ($1, $2)',
      [compId, candidateId]
    );

    console.log('--------------------------------------------------');
    console.log('Seeding completed successfully!');
    console.log('Test Accounts created (Password is "Password123"):');
    console.log(' - Candidate:     candidate@corrus.io');
    console.log(' - Company Admin: employer@corrus.io');
    console.log(' - Platform Admin:admin@corrus.io');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('Seeding Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
