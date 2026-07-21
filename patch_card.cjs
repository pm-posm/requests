const fs = require('fs');
let cardPath = 'src/components/Dashboard/ActivityDetailCard.tsx';
let content = fs.readFileSync(cardPath, 'utf8');

// Replace the date
content = content.replace(
`<div className="text-xs text-slate-500">
                    {new Date(activity.created_at).toLocaleString('vi-VN')}
                </div>`,
`<div className="text-xs">
                    {activity.thread_id ? (
                        <a href={\`https://mail.google.com/mail/u/0/#inbox/\${activity.thread_id}\`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium">
                            Mở Thread Mail
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    ) : (
                        <span className="text-slate-500">{new Date(activity.created_at).toLocaleString('vi-VN')}</span>
                    )}
                </div>`
);

// Add the date to the Sender part since we removed it from the top right
content = content.replace(
`<span className="font-medium text-slate-700 dark:text-slate-300">{activity.nguoi_gui || 'N/A'}</span>`,
`<span className="font-medium text-slate-700 dark:text-slate-300">{activity.nguoi_gui || 'N/A'} ({new Date(activity.created_at).toLocaleString('vi-VN')})</span>`
);

// Add Drive link
content = content.replace(
`<h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">File đính kèm</h5>`,
`<div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">File đính kèm</h5>
                        {activity.drive_url && (
                            <a href={activity.drive_url} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                                Mở Folder Drive
                            </a>
                        )}
                    </div>`
);

fs.writeFileSync(cardPath, content);
console.log('Fixed ActivityDetailCard');
