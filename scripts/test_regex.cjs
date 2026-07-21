const subjects = [
  '[BRIEF CONFIRMED] - 142468U01 -U11 OMO Fabsol TET MT -GE Customize -3 Coopmart',
  '[Brief Rejected] : 142468U01-U11 OMO Fabsol TET MT',
  'ĐĂNG KÝ LỊCH NTXX - 151537U01-U02_U05-U06 Multiple Brands',
  'FW: ĐĂNG KÝ LỊCH NTXX TEAM VIS- 151537U01-U04 Multiple Brands',
  '[BRIEF CONFIRMED] - 151537U01-U04 Multiple Brands',
  '[Duyệt Brief] : 151537U01-U02_U05-U06 Multiple Brands',
  'REPORT LẮP ĐẶT- 151537U01-U04 Multiple Brands',
  'Re: [BRIEF CONFIRMED] - 151537U01-U02_U05-U06 Multiple Brands Skin',
];

// Approach: first normalize 'U01 -U11' -> 'U01-U11', then apply regex
function extractCode(subject) {
  // Normalize: 'Uxx -Uxx' (có khoảng trắng trước dấu gạch) -> 'Uxx-Uxx'  
  const normalized = subject.replace(/(U\d{2})\s+-\s*(U\d{2})/g, '$1-$2');
  const REGEX = /\b(14|15|16|17)\d{4}(?:U\d{2}(?:[-_]U\d{2})*)?/g;
  const matches = [...normalized.matchAll(REGEX)].map(m => m[0]);
  return matches[0] || null;
}

subjects.forEach(s => {
  console.log(s.substring(0, 80));
  console.log('  =>', extractCode(s));
  console.log('');
});
