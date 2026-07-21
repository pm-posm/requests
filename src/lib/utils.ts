import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function groupEmailsByThread(emails: any[]) {
  if (!emails || emails.length === 0) return [];
  
  const threads: Record<string, any[]> = {};
  const threadOrder: string[] = [];

  emails.forEach(email => {
    const prefixRegex = /^(?:(?:\b(?:re|fw|fwd|trả lời|tr|forward)\b|\[external\]|\bexternal\b)\s*[:\-]*\s*)+/gi;
    let normalized = (email.email_subject || '').replace(prefixRegex, '').trim();
    
    const key = normalized.toLowerCase() || 'no-subject';
    if (!threads[key]) {
      threads[key] = [];
      threadOrder.push(key);
    }
    threads[key].push(email);
  });

  const threadArray = threadOrder.map(key => {
    const threadEmails = threads[key];
    threadEmails.sort((a, b) => new Date(b.email_received_at).getTime() - new Date(a.email_received_at).getTime());
    return {
      id: key,
      subject: threadEmails[0].email_subject,
      normalizedSubject: threadEmails[0].email_subject.replace(/^(?:(?:\b(?:re|fw|fwd|trả lời|tr|forward)\b|\[external\]|\bexternal\b)\s*[:\-]*\s*)+/gi, '').trim(),
      emails: threadEmails,
      latestEmail: threadEmails[0]
    };
  });

  threadArray.sort((a, b) => new Date(b.latestEmail.email_received_at).getTime() - new Date(a.latestEmail.email_received_at).getTime());

  return threadArray;
}

export function removeVietnameseTones(str: string) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system encode vietnamese combining accent as individual utf-8 characters
  // Một vài bộ encode coi các dấu mũ, dấu chữ như một kí tự riêng biệt nên thêm hai dòng này
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  // Remove extra spaces
  str = str.replace(/ + /g, " ");
  str = str.trim();
  return str;
}

export function normalizeStoreName(str: string) {
  if (!str) return '';
  let normalized = removeVietnameseTones(str).toLowerCase();
  
  // Replace "Q7", "Q.7", "Q 7" -> "quan 7"
  normalized = normalized.replace(/\bq\.?\s*([0-9]+)\b/gi, "quan $1");
  
  // Replace "quan7" -> "quan 7"
  normalized = normalized.replace(/\bquan\s*([0-9]+)\b/gi, "quan $1");
  
  // Clean up any double spaces that might have been introduced
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

export function groupEmailsByProject(emails: any[]) {
  if (!emails || emails.length === 0) return [];
  const projects: Record<string, any> = {};
  emails.forEach(email => {
    const code = email.detected_project_code || "UNKNOWN";
    const name = email.detected_project_name || email.email_subject || "Kh�ng x�c d?nh";
    if (!projects[code]) {
      projects[code] = { id: code, project_code: code, project_name: name, emails: [], latestEmail: null, stores: {} };
    }
    projects[code].emails.push(email);
    if (email.detected_stores_info && Array.isArray(email.detected_stores_info)) {
      email.detected_stores_info.forEach((s: any) => {
        if (s.store_name) {
          if (!projects[code].stores[s.store_name]) {
            projects[code].stores[s.store_name] = { store_name: s.store_name, store_code: s.store_code, status: email.detected_status, latest_date: email.email_received_at };
          } else {
             const existing = projects[code].stores[s.store_name];
             if (new Date(email.email_received_at).getTime() > new Date(existing.latest_date).getTime()) {
                 existing.status = email.detected_status;
                 existing.latest_date = email.email_received_at;
             }
          }
        }
      });
    }
  });
  const projectArray = Object.values(projects).map(p => {
    p.emails.sort((a: any, b: any) => new Date(b.email_received_at).getTime() - new Date(a.email_received_at).getTime());
    p.latestEmail = p.emails[0];
    p.storeList = Object.values(p.stores);
    return p;
  });
  projectArray.sort((a, b) => new Date(b.latestEmail.email_received_at).getTime() - new Date(a.latestEmail.email_received_at).getTime());
  return projectArray;
}

