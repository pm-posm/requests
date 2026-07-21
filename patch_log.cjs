const fs = require('fs');

let content = fs.readFileSync('src/components/ActionModal/PhaseActionModal.tsx', 'utf8');

const target = `        try {
            await saveFn(newData);`;

const replacement = `        try {
            await saveFn(newData);
            
            // Log to project_timeline_events
            try {
                await supabase.from('project_timeline_events').insert({
                    project_id: item?.final_project || item?.project_name || 'UNKNOWN',
                    store_code: isBulk ? 'BULK' : (item?.store_code || 'UNKNOWN'),
                    phase_type: phaseName,
                    event_type: newEvent.type,
                    user_role: role,
                    actor_name: newEvent.user,
                    details: newEvent.metadata
                });
            } catch(logErr) {
                console.error('Failed to log event', logErr);
            }`;

content = content.replace(target, replacement);

fs.writeFileSync('src/components/ActionModal/PhaseActionModal.tsx', content);
