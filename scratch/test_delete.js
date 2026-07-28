import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://nbslfbpzhsgvuscfuvxn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ic2xmYnB6aHNndnVzY2Z1dnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTMwMTAsImV4cCI6MjA5NzE2OTAxMH0.5KMFj90fB94P8Yv49ZIuk1N9dngdiYYGloVCqxd3rpw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDelete() {
    // Attempt to delete row with id '4c4461a8-ed39-42a1-a956-427e97c18d93' (the old duplicate for 637)
    const { data, error } = await supabase
        .from('raw_requests')
        .delete()
        .eq('id', '4c4461a8-ed39-42a1-a956-427e97c18d93')
        .select();

    console.log('Delete result error:', error);
    console.log('Delete result data:', data);
}

testDelete();
