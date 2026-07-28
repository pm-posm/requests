import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanAllDuplicates() {
    console.log('Fetching all active raw_requests from Supabase...');
    const { data: allRows, error } = await supabase
        .from('raw_requests')
        .select('id, sheet_row_index, request_key, is_mer_modified, created_at')
        .eq('is_deleted_in_sheet', false)
        .order('sheet_row_index', { ascending: true });

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    console.log(`Total rows fetched from DB: ${allRows.length}`);

    const seenRowIndexes = new Map();
    const idsToDelete = [];

    for (const row of allRows) {
        const rowIndex = row.sheet_row_index;
        if (!rowIndex) continue;

        if (seenRowIndexes.has(rowIndex)) {
            // Found duplicate row for sheet_row_index
            const existing = seenRowIndexes.get(rowIndex);
            // If current row has new format 'row_N' or is_mer_modified, prefer to keep it and delete the other
            if (row.request_key === `row_${rowIndex}` || row.is_mer_modified) {
                idsToDelete.push(existing.id);
                seenRowIndexes.set(rowIndex, row);
            } else {
                idsToDelete.push(row.id);
            }
        } else {
            seenRowIndexes.set(rowIndex, row);
        }
    }

    console.log(`Found ${idsToDelete.length} duplicate rows to delete. Clean rows to keep: ${seenRowIndexes.size}`);

    if (idsToDelete.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < idsToDelete.length; i += chunkSize) {
            const chunk = idsToDelete.slice(i, i + chunkSize);
            const { error: delErr } = await supabase
                .from('raw_requests')
                .delete()
                .in('id', chunk);

            if (delErr) {
                console.error(`Error deleting chunk ${i}:`, delErr);
            } else {
                console.log(`Deleted chunk ${i}..${i + chunk.length}`);
            }
        }
    }

    // Check remaining count
    const { count } = await supabase
        .from('raw_requests')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted_in_sheet', false);

    console.log(`🎉 Total active rows remaining in DB after cleanup: ${count}`);
}

cleanAllDuplicates();
