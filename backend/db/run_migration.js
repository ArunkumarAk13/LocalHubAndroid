const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'needitdb',
  password: 97587,
  port: 5432,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Read and execute the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_phone_number.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(migrationSQL);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully');
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
    // Close the pool
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error); 