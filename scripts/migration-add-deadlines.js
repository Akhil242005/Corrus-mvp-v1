const pool = require('../src/lib/db.js').default || require('../src/lib/db.js');

async function migrate() {
  try {
    // 1. Add submission_deadline
    const checkDeadline = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'competitions' AND column_name = 'submission_deadline'
    `);
    if (checkDeadline.rows.length === 0) {
      console.log('Adding column submission_deadline to competitions...');
      await pool.query('ALTER TABLE competitions ADD COLUMN submission_deadline TIMESTAMP WITH TIME ZONE');
    }

    // 2. Add auto_close_enabled
    const checkAutoClose = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'competitions' AND column_name = 'auto_close_enabled'
    `);
    if (checkAutoClose.rows.length === 0) {
      console.log('Adding column auto_close_enabled to competitions...');
      await pool.query('ALTER TABLE competitions ADD COLUMN auto_close_enabled BOOLEAN DEFAULT FALSE');
    }

    // 3. Add closed_at
    const checkClosedAt = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'competitions' AND column_name = 'closed_at'
    `);
    if (checkClosedAt.rows.length === 0) {
      console.log('Adding column closed_at to competitions...');
      await pool.query('ALTER TABLE competitions ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE');
    }

    console.log('Deadlines migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Deadlines migration failed:', err);
    process.exit(1);
  }
}

migrate();
