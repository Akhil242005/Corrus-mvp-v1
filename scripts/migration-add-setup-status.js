const pool = require('../src/lib/db.js').default || require('../src/lib/db.js');

async function migrate() {
  try {
    // Check if column exists
    const checkCol = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'competitions' AND column_name = 'github_setup_status'
    `);
    
    if (checkCol.rows.length === 0) {
      console.log('Adding column github_setup_status to competitions...');
      await pool.query("ALTER TABLE competitions ADD COLUMN github_setup_status VARCHAR(50) DEFAULT 'pending'");
      console.log('Column added successfully.');
    } else {
      console.log('Column github_setup_status already exists.');
    }

    // Update existing rows
    console.log('Initializing github_setup_status values...');
    await pool.query("UPDATE competitions SET github_setup_status = 'completed' WHERE github_template_repo IS NOT NULL");
    await pool.query("UPDATE competitions SET github_setup_status = 'failed' WHERE github_template_repo IS NULL");

    // Specifically reset competition 17 and 23 for regeneration testing
    console.log('Resetting competitions 17 and 23 for regeneration testing...');
    await pool.query("UPDATE competitions SET github_template_repo = NULL, github_setup_status = 'failed' WHERE id IN (17, 23)");

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
