require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function seedBulk() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    console.log('Connecting to PostgreSQL for bulk seeding...');
    await client.connect();

    // 1. Clear existing data
    console.log('Truncating tables...');
    await client.query('TRUNCATE audit_logs, competition_enrollments, submissions, installations, competitions, users, companies CASCADE');

    const hashedDefaultPassword = await bcrypt.hash('Password123', 10);
    const hashedEmployeePassword = await bcrypt.hash('TempPass999!', 10);

    // 2. Seed Companies
    console.log('Seeding 7 companies...');
    const companies = [
      { name: 'Corrus Labs', place: 'San Francisco, CA', desc: 'Excellence in verification testing and sandboxing.', web: 'https://corrus.io' },
      { name: 'Lenovo Vantage Group', place: 'Morrisville, NC', desc: 'Developing the future of PC system utilities and dashboard controls.', web: 'https://vantage.lenovo.com' },
      { name: 'Google Cloud Platform', place: 'Mountain View, CA', desc: 'Enterprise infrastructure and AI cloud sandboxes.', web: 'https://cloud.google.com' },
      { name: 'Tesla Autopilot', place: 'Austin, TX', desc: 'Autonomous driving systems and neural net models.', web: 'https://tesla.com' },
      { name: 'Microsoft Azure Dev', place: 'Redmond, WA', desc: 'Developer services, compilers, and cloud pipelines.', web: 'https://azure.microsoft.com' },
      { name: 'Meta Systems', place: 'Menlo Park, CA', desc: 'Social media, metaverses, and high-performance networks.', web: 'https://meta.com' },
      { name: 'Acme Research Labs', place: 'San Francisco, CA', desc: 'Next-generation algorithms and competence-based sandboxes.', web: 'https://acmelabs.io' }
    ];

    const companyIds = [];
    for (const c of companies) {
      const res = await client.query(
        `INSERT INTO companies (name, place, description, website, is_verified) 
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [c.name, c.place, c.desc, c.web]
      );
      companyIds.push(res.rows[0].id);
    }

    // 3. Seed Users
    console.log('Seeding Users...');

    // Platform Admin
    await client.query(
      `INSERT INTO users (firstname, lastname, email, password, role, is_email_verified, must_reset_password) 
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      ['John', 'Admin', 'admin@corrus.io', hashedDefaultPassword, 'admin', true]
    );

    // Company Admins for each company
    const companyAdmins = [
      { first: 'Jane', last: 'Employer', email: 'employer@corrus.io', companyId: companyIds[0] },
      { first: 'Akhil', last: 'Vantage', email: 'akhil.vantage@lenovo.com', companyId: companyIds[1] },
      { first: 'Jane', last: 'Google', email: 'jane.cloud@google.com', companyId: companyIds[2] },
      { first: 'Elon', last: 'Autopilot', email: 'elon.autopilot@tesla.com', companyId: companyIds[3] },
      { first: 'Satya', last: 'Azure', email: 'satya.azure@microsoft.com', companyId: companyIds[4] },
      { first: 'Mark', last: 'Meta', email: 'mark.meta@meta.com', companyId: companyIds[5] },
      { first: 'Sarah', last: 'Acme', email: 'sarah.research@acmelabs.io', companyId: companyIds[6] }
    ];

    const companyAdminIds = {};
    for (const ca of companyAdmins) {
      const res = await client.query(
        `INSERT INTO users (firstname, lastname, email, password, role, company_id, is_approved, is_email_verified, must_reset_password) 
         VALUES ($1, $2, $3, $4, 'company_admin', $5, true, true, false) RETURNING id`,
        [ca.first, ca.last, ca.email, hashedDefaultPassword, ca.companyId]
      );
      const adminId = res.rows[0].id;
      companyAdminIds[ca.companyId] = adminId;
      // Update company admin reference
      await client.query('UPDATE companies SET admin_id = $1 WHERE id = $2', [adminId, ca.companyId]);
    }

    // Seeding general employees (for Lenovo Vantage Group mostly to test the directory)
    console.log('Seeding employees...');
    const employees = [
      { first: 'Alice', last: 'Smith', email: 'alice.smith@lenovo.com', companyId: companyIds[1], approved: true, reset: false },
      { first: 'Bob', last: 'Johnson', email: 'bob.johnson@lenovo.com', companyId: companyIds[1], approved: true, reset: true },
      { first: 'Charlie', last: 'Brown', email: 'charlie.brown@lenovo.com', companyId: companyIds[1], approved: false, reset: true },
      { first: 'Diana', last: 'Prince', email: 'diana.prince@lenovo.com', companyId: companyIds[1], approved: true, reset: false },
      { first: 'David', last: 'Miller', email: 'david.miller@google.com', companyId: companyIds[2], approved: true, reset: false },
      { first: 'Eve', last: 'Davis', email: 'eve.davis@tesla.com', companyId: companyIds[3], approved: true, reset: true }
    ];

    for (const emp of employees) {
      await client.query(
        `INSERT INTO users (firstname, lastname, email, password, role, company_id, is_approved, is_email_verified, must_reset_password) 
         VALUES ($1, $2, $3, $4, 'company_employee', $5, $6, true, $7)`,
        [emp.first, emp.last, emp.email, hashedEmployeePassword, emp.companyId, emp.approved, emp.reset]
      );
    }

    // Seeding Candidates (General Users)
    console.log('Seeding candidate users...');
    const candidates = [
      { first: 'Alex', last: 'Fullstack', email: 'alex.fullstack@gmail.com', skills: ['React', 'Node.js', 'PostgreSQL'], exp: '3 years full-stack' },
      { first: 'Ryan', last: 'Pythonist', email: 'ryan.pythonist@yahoo.com', skills: ['Python', 'Django', 'FastAPI', 'Pandas'], exp: '4 years backend' },
      { first: 'Emily', last: 'CppDev', email: 'emily.cpp@outlook.com', skills: ['C++', 'Algorithms', 'STL', 'Multi-threading'], exp: '5 years systems engineer' },
      { first: 'Marcus', last: 'Frontend', email: 'marcus.frontend@gmail.com', skills: ['JavaScript', 'TypeScript', 'React', 'TailwindCSS'], exp: '2 years UI dev' },
      { first: 'Nisha', last: 'Backend', email: 'nisha.backend@gmail.com', skills: ['Node.js', 'GraphQL', 'Docker', 'Redis'], exp: '1 year backend' }
    ];

    const candidateIds = [];
    for (const cand of candidates) {
      const res = await client.query(
        `INSERT INTO users (firstname, lastname, email, password, role, is_email_verified, experience, skills, must_reset_password) 
         VALUES ($1, $2, $3, $4, 'user', true, $5, $6, false) RETURNING id`,
        [cand.first, cand.last, cand.email, hashedDefaultPassword, cand.exp, cand.skills]
      );
      candidateIds.push(res.rows[0].id);
    }

    // 4. Seed Hiring Challenges (Competitions)
    console.log('Seeding competitions (hiring challenges)...');
    const challenges = [
      { title: 'PC Diagnostic Tool Challenge', desc: 'Design a system helper utility that inspects PC health metrics, collects telemetry, and outputs reports.', lang: 'Python', exp: 'Mid-Level (2-5 years)', skills: ['Python', 'Telemetry', 'CLI'], companyId: companyIds[1] },
      { title: 'Vantage UI Widget Framework', desc: 'Develop a high-performance widget loading library that supports responsive dashboard resizing.', lang: 'JavaScript/TypeScript', exp: 'Entry-Level (0-2 years)', skills: ['React', 'TypeScript', 'Responsive Design'], companyId: companyIds[1] },
      { title: 'Distributed Sandbox Compiler', desc: 'Create a microservice compiler sandbox that safely evaluates candidate submissions in isolation.', lang: 'Python', exp: 'Senior (5+ years)', skills: ['Docker', 'Sandbox', 'Python', 'Security'], companyId: companyIds[2] },
      { title: 'Path Planner Optimization', desc: 'Write a path-planning algorithm that avoids obstacles dynamically on a 2D occupancy grid.', lang: 'C++', exp: 'Senior (5+ years)', skills: ['C++', 'Algorithms', 'Geometry'], companyId: companyIds[3] },
      { title: 'Azure Compiler Service API', desc: 'Build an API layer wrapper that compiles TypeScript compiler files asynchronously.', lang: 'JavaScript/TypeScript', exp: 'Mid-Level (2-5 years)', skills: ['TypeScript', 'Node.js', 'Express'], companyId: companyIds[4] },
      { title: 'Social Graph Traversal API', desc: 'Implement a traversal optimizer that evaluates 2nd-degree friend connections inside social nodes.', lang: 'Python', exp: 'Senior (5+ years)', skills: ['Python', 'Graph Algorithms', 'BFS/DFS'], companyId: companyIds[5] }
    ];

    const challengeIds = [];
    for (const ch of challenges) {
      const res = await client.query(
        `INSERT INTO competitions (company_id, title, task_description, language, skills_required, experience_required, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [ch.companyId, ch.title, ch.desc, ch.lang, ch.skills, ch.exp, companyAdminIds[ch.companyId]]
      );
      challengeIds.push(res.rows[0].id);
    }

    // 5. Seed Enrollments & Submissions
    console.log('Seeding enrollments and code submissions...');
    
    // Enrollment helpers
    const enrollments = [
      { compId: challengeIds[0], candId: candidateIds[0] }, // Diagnostic -> Alex
      { compId: challengeIds[0], candId: candidateIds[1] }, // Diagnostic -> Ryan
      { compId: challengeIds[1], candId: candidateIds[0] }, // Vantage UI -> Alex
      { compId: challengeIds[1], candId: candidateIds[3] }, // Vantage UI -> Marcus
      { compId: challengeIds[2], candId: candidateIds[1] }, // Compiler -> Ryan
      { compId: challengeIds[3], candId: candidateIds[2] }, // Path Planner -> Emily
      { compId: challengeIds[4], candId: candidateIds[4] }  // Azure Compiler -> Nisha
    ];

    for (const e of enrollments) {
      await client.query(
        'INSERT INTO competition_enrollments (competition_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [e.compId, e.candId]
      );
    }

    // Submissions seed
    const submissions = [
      {
        compId: challengeIds[0],
        candId: candidateIds[1], // Ryan (Pythonist)
        url: 'https://github.com/ryanpythonist/diagnostic-tool-impl',
        status: 'Graded',
        score: 95,
        logs: '✔ Diagnostic collector initialized\n✔ Telemetry data loaded\n✔ Test suite: 15/15 passed\n✔ Coverage: 98% statements',
        feedback: 'Excellent clean Python structure. High performance diagnostics.'
      },
      {
        compId: challengeIds[1],
        candId: candidateIds[3], // Marcus (Frontend)
        url: 'https://github.com/marcusfront/vantage-ui-widget',
        status: 'Graded',
        score: 88,
        logs: '✔ Responsive widget grid verified\n✔ Resize observers verified\n✔ Test suite: 8/8 passed\n✔ Coverage: 92%',
        feedback: 'Solid React composition. Responsive layout is fully functional.'
      },
      {
        compId: challengeIds[0],
        candId: candidateIds[0], // Alex (Fullstack)
        url: 'https://github.com/alexfullstack/diagnostic-tool-repo',
        status: 'FAILED',
        score: null,
        logs: '✖ Compiler error on line 42: SyntaxError: Unexpected token\n✖ Compilation aborted due to build errors\n✖ Unit tests execution skipped',
        err: 'Compiler error: SyntaxError: Unexpected token on line 42.'
      },
      {
        compId: challengeIds[2],
        candId: candidateIds[1], // Ryan
        url: 'https://github.com/ryanpythonist/sandbox-compiler-repo',
        status: 'PENDING',
        score: null,
        logs: '🕒 Sandbox dispatcher awaiting execution queue dispatch...'
      },
      {
        compId: challengeIds[3],
        candId: candidateIds[2], // Emily
        url: 'https://github.com/emilycpp/path-planner-opt',
        status: 'PROCESSING',
        score: null,
        logs: '🕒 Compiling C++ files...\n🕒 Loading dynamic occupancy grid layers...\n🕒 Running path optimizer benchmark...'
      }
    ];

    for (const sub of submissions) {
      await client.query(
        `INSERT INTO submissions (competition_id, user_id, repo_url, status, final_score, attributes, error_message, reasons) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sub.compId,
          sub.candId,
          sub.url,
          sub.status,
          sub.score,
          JSON.stringify({ logs: sub.logs, coverage: sub.score ? 94 : null }),
          sub.err || null,
          JSON.stringify({ feedback: sub.feedback || '' })
        ]
      );
    }

    console.log('Seeding bulk completed successfully!');
    console.log('--------------------------------------------------');
    console.log('Corporate credentials (password is "Password123"):');
    console.log(' - Lenovo Admin: akhil.vantage@lenovo.com');
    console.log(' - Google Admin: jane.cloud@google.com');
    console.log(' - Tesla Admin:  elon.autopilot@tesla.com');
    console.log('Employee credentials (password is "TempPass999!"):');
    console.log(' - Approved Reset Req:  bob.johnson@lenovo.com');
    console.log(' - Approved Normal:     alice.smith@lenovo.com');
    console.log(' - Pending Reset Req:   charlie.brown@lenovo.com');
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('Bulk Seeding failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedBulk();
