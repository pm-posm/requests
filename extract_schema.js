import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  host: 'db.nbslfbpzhsgvuscfuvxn.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Cky33uVk@@@@'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected successfully to old project!');
    
    // Get table definitions
    const res = await client.query(`
      SELECT table_name, column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    
    const tables = {};
    res.rows.forEach(row => {
      if (!tables[row.table_name]) tables[row.table_name] = [];
      tables[row.table_name].push(row);
    });
    
    let sql = '-- AUTO-GENERATED BASELINE SCHEMA\n\n';
    
    // Create tables
    for (const [tableName, cols] of Object.entries(tables)) {
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
      const colDefs = cols.map(c => {
        let def = `  ${c.column_name} ${c.data_type}`;
        if (c.character_maximum_length) def += `(${c.character_maximum_length})`;
        return def;
      });
      sql += colDefs.join(',\n');
      sql += `\n);\n\n`;
    }
    
    fs.writeFileSync('supabase/migrations/20260101000000_baseline.sql', sql);
    console.log('Saved baseline schema to supabase/migrations/20260101000000_baseline.sql');
  } catch (err) {
    console.error('Error connecting to old project:', err.message);
  } finally {
    await client.end();
  }
}

run();
