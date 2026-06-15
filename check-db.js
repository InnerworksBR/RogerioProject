const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: sales, error } = await supabase.from('sales_rows').select('user_id');
  if (error) { console.error(error); return; }
  
  const counts = {};
  for (const row of sales) {
    counts[row.user_id] = (counts[row.user_id] || 0) + 1;
  }
  console.log('--- SALES ROWS COUNT BY USER_ID ---');
  console.log(counts);
}

check().catch(console.error);
