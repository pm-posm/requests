import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    const { data, error } = await supabase
        .from('raw_requests')
        .select('id, request_key, sheet_row_index, store_name, posm, is_deleted_in_sheet')
        .in('sheet_row_index', [637, 638, 639, 640, 641, 642])
        .order('sheet_row_index', { ascending: true });

    if (error) {
        console.error('Error fetching raw_requests:', error);
        return;
    }

    console.log(`Found ${data.length} rows for sheet_row_index 637..642:`);
    console.table(data);

    // Also check total count
    const { count, error: countErr } = await supabase
        .from('raw_requests')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted_in_sheet', false);

    console.log(`Total active rows in DB (is_deleted_in_sheet = false): ${count}`);
}

inspect();
