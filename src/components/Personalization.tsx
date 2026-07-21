import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Camera, CheckCircle2, ChevronRight, Clock, Flag, Loader2, Mail, Search, Send, Store, XCircle, AlertTriangle, ListTodo, UserPlus, CheckSquare } from 'lucide-react';

type WorkflowStatus = 'ntxx' | 'khao_sat' | 'hoan_thanh_khao_sat' | 'lap_dat' | 'hoan_thanh_lap_dat';
type QuickFilter = 'all' | 'today' | 'risk' | 'unassigned';

interface StoreDetail { code?: string; name?: string; quantity?: number | string; category?: string; date?: string; time?: string; inspector?: string; status?: string; note?: string; images?: string[]; actual_time?: string; issue?: string; }
interface EventDetails { email_type?: string; supplier?: string; stores?: StoreDetail[]; note?: string; images?: string[]; issue?: string; }
interface ProgressRecord { id: string; email_subject: string; email_received_at: string; detected_project_code: string; detected_project_name?: string; sender?: string; ntxx_details?: EventDetails; detected_status: WorkflowStatus; email_type?: string; email_message_id?: string; }

const PEOPLE = ['Nguyễn Hải Nam', 'Phạm Quang Chính', 'Võ Văn Vũ', 'Đặng Nhật Uy', 'Lê Hữu Thắng', 'Tạ Tiến Đạt', 'Thân Văn Dũng'];
const STEP_LABEL: Record<'ntxx'|'survey'|'install'|'done', string> = { ntxx: 'NTXX', survey: 'Khảo sát', install: 'Lắp đặt', done: 'Hoàn tất' };
const STATUS_LABEL: Record<WorkflowStatus, string> = { ntxx: 'Lịch NTXX', khao_sat: 'Lịch khảo sát', hoan_thanh_khao_sat: 'Báo cáo khảo sát', lap_dat: 'Lịch lắp đặt', hoan_thanh_lap_dat: 'Báo cáo lắp đặt' };
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt = (v?: Date | string) => { if (!v) return '-'; const d = typeof v === 'string' ? new Date(v) : v; return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN'); };
function parseDate(v?: string, fallback?: string) { 
  if (!v) {
    const d = fallback ? new Date(fallback) : new Date(); 
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const cleanV = v.replace(/\s+/g, '');
  let m = cleanV.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
  if (!m) m = cleanV.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/); 
  if (m) return new Date(Number(m[3] || (fallback ? new Date(fallback).getFullYear() : new Date().getFullYear())), Number(m[2])-1, Number(m[1])); 
  const d = fallback ? new Date(fallback) : new Date(); 
  return isNaN(d.getTime()) ? new Date() : d; 
}
function daysBetween(a?: Date, b?: Date) { if (!a || !b) return null; return Math.floor((b.getTime() - a.getTime()) / 86400000); }
function compressImage(file: File): Promise<string> { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const scale = Math.min(1, 1200 / Math.max(img.width, img.height)); c.width = Math.round(img.width*scale); c.height = Math.round(img.height*scale); c.getContext('2d')?.drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg', .72)); }; img.onerror = reject; img.src = r.result as string; }; r.onerror = reject; r.readAsDataURL(file); }); }

export default function Personalization({ globalSearchTerm = '' }: { globalSearchTerm?: string }) {
  const queryClient = useQueryClient();
  const search = globalSearchTerm;
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [selectedCode, setSelectedCode] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<StoreDetail>>>({});
  const [saving, setSaving] = useState('');

  const { data: records = [], isLoading, error } = useQuery<ProgressRecord[]>({
    queryKey: ['workflow_records'],
    queryFn: async () => { const { data, error } = await supabase.from('project_progress_ai').select('id, email_subject, email_received_at, detected_project_code, detected_project_name, sender, ntxx_details, detected_status, email_type, email_message_id').in('detected_status', ['ntxx','khao_sat','hoan_thanh_khao_sat','lap_dat','hoan_thanh_lap_dat']).order('email_received_at', { ascending: false }); if (error) throw error; return (data || []) as ProgressRecord[]; },
    refetchInterval: 15000
  });

  const mutation = useMutation({
    mutationFn: async ({ record, details }: { record: ProgressRecord; details: EventDetails }) => { const { error } = await supabase.from('project_progress_ai').update({ ntxx_details: details }).eq('id', record.id); if (error) throw error; },
    onSuccess: (_, v) => { setSaving(''); setEdits(p => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(`${v.record.id}_`)))); queryClient.invalidateQueries({ queryKey: ['workflow_records'] }); },
    onError: (e: any) => { setSaving(''); alert('Lỗi lưu dữ liệu: ' + e.message); }
  });

  const today = dateKey(new Date());
  const projects = useMemo(() => {
    const map = new Map<string, any>();
    records.forEach(r => {
      const code = r.detected_project_code || 'UNKNOWN';
      if (!map.has(code)) map.set(code, { code, name: r.detected_project_name, records: [], stores: new Map(), issues: 0 });
      const p = map.get(code); p.records.push(r); if (!p.name && r.detected_project_name) p.name = r.detected_project_name;
      
      // Store extraction from ntxx_details
      (r.ntxx_details?.stores || []).forEach((s, index) => { 
        const key = (s.code || s.name || `${r.id}-${index}`).toLowerCase(); 
        const row = p.stores.get(key) || { code: s.code, name: s.name, category: s.category, quantity: s.quantity, steps: {} }; 
        row.steps[r.detected_status] = { record: r, store: s, index }; 
        if (s.issue || s.status === 'Không đạt') p.issues++; 
        p.stores.set(key, row); 
      });
    });

    return Array.from(map.values()).map(p => {
      const byStatus = (st: WorkflowStatus) => p.records.filter((r: ProgressRecord) => r.detected_status === st);
      
      // Calculate Dates for Stepper
      const getFirstDate = (status: WorkflowStatus) => {
        const r = byStatus(status).find((rec: ProgressRecord) => rec.ntxx_details?.stores?.[0]?.date);
        return r ? parseDate(r.ntxx_details!.stores![0].date, r.email_received_at) : undefined;
      };
      const getFirstRawDate = (status: WorkflowStatus) => {
        const r = byStatus(status).find((rec: ProgressRecord) => rec.ntxx_details?.stores?.[0]?.date);
        return r ? r.ntxx_details!.stores![0].date : undefined;
      };
      
      const surveyDate = getFirstDate('khao_sat');
      const rawSurveyDate = getFirstRawDate('khao_sat');
      const surveyReportDate = byStatus('hoan_thanh_khao_sat')[0] ? new Date(byStatus('hoan_thanh_khao_sat')[0].email_received_at) : undefined;
      
      const installDate = getFirstDate('lap_dat');
      const rawInstallDate = getFirstRawDate('lap_dat');
      const installReportDate = byStatus('hoan_thanh_lap_dat')[0] ? new Date(byStatus('hoan_thanh_lap_dat')[0].email_received_at) : undefined;
      
      const ntxxDate = getFirstDate('ntxx');
      const rawNtxxDate = getFirstRawDate('ntxx');

      const current = installReportDate ? 'done' : byStatus('lap_dat').length ? 'install' : byStatus('khao_sat').length || surveyReportDate ? 'survey' : 'ntxx';
      
      // Generate Action Items (Smart Tasks)
      const storesArray = Array.from(p.stores.values()) as any[];
      const actions: any[] = [];
      const needsInspectorStores = storesArray.filter(s => {
        const step = s.steps['lap_dat'] || s.steps['khao_sat'] || s.steps['ntxx'];
        return step && step.store.date && !step.store.inspector;
      });
      if (needsInspectorStores.length > 0) {
        actions.push({ type: 'assign', title: 'Cần phân công giám sát', desc: `Có ${needsInspectorStores.length} store đã lên lịch nhưng chưa ai phụ trách.`, icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' });
      }

      const overdueStores = storesArray.filter(s => {
        const checkOverdue = (stepStatus: WorkflowStatus, reportStatus: WorkflowStatus) => {
          const step = s.steps[stepStatus];
          if (step && step.store.date && !s.steps[reportStatus]) {
             const d = parseDate(step.store.date);
             if (d < new Date(new Date().setHours(0,0,0,0))) return true;
          }
          return false;
        };
        return checkOverdue('khao_sat', 'hoan_thanh_khao_sat') || checkOverdue('lap_dat', 'hoan_thanh_lap_dat');
      });
      if (overdueStores.length > 0) {
        actions.push({ type: 'overdue', title: 'Quá hạn báo cáo', desc: `Có ${overdueStores.length} store đã qua ngày khảo sát/lắp đặt nhưng chưa có báo cáo nghiệm thu.`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' });
      }

      const needReviewStores = storesArray.filter(s => {
        return (s.steps['hoan_thanh_khao_sat'] && !s.steps['hoan_thanh_khao_sat'].store.status) || 
               (s.steps['hoan_thanh_lap_dat'] && !s.steps['hoan_thanh_lap_dat'].store.status);
      });
      if (needReviewStores.length > 0) {
        actions.push({ type: 'review', title: 'Cần duyệt báo cáo', desc: `Vừa nhận báo cáo của ${needReviewStores.length} store. Cần check ảnh và duyệt kết quả.`, icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' });
      }

      const risks = [overdueStores.length && 'Quá hạn báo cáo', needReviewStores.length && 'Chờ duyệt báo cáo', needsInspectorStores.length && 'Chưa phân công'].filter(Boolean);

      return { ...p, stores: storesArray, byStatus, current, risks, actions, ntxxDate, rawNtxxDate, surveyDate, rawSurveyDate, surveyReportDate, installDate, rawInstallDate, installReportDate };
    });
  }, [records]);

  const visibleProjects = useMemo(() => projects.filter(p => `${p.code} ${p.name || ''}`.toLowerCase().includes(search.toLowerCase())).filter(p => filter === 'today' ? p.actions.some((a:any)=>a.type!=='ok') : filter === 'risk' ? p.risks.length > 0 : filter === 'unassigned' ? p.actions.some((a:any)=>a.type==='assign') : true), [projects, search, filter]);
  const project = visibleProjects.find(p => p.code === selectedCode) || visibleProjects[0] || projects[0];

  const kpis = { 
    active: projects.length, 
    attention: projects.filter(p=>p.actions.length > 0).length, 
    risk: projects.filter(p=>p.risks.includes('Quá hạn báo cáo')).length, 
    done: projects.filter(p=>p.current==='done').length 
  };

  const localKey = (r: ProgressRecord, i: number) => `${r.id}_${i}`;
  const value = (r: ProgressRecord, s: StoreDetail, i: number, f: keyof StoreDetail) => edits[localKey(r,i)]?.[f] ?? s[f] ?? (f === 'images' ? [] : '');
  const patch = (r: ProgressRecord, i: number, data: Partial<StoreDetail>) => setEdits(p => ({...p, [localKey(r,i)]: {...p[localKey(r,i)], ...data}}));
  const save = (record: ProgressRecord) => { const details = JSON.parse(JSON.stringify(record.ntxx_details || { stores: [] })) as EventDetails; details.stores = details.stores || []; details.stores.forEach((s,i)=>Object.assign(s, edits[localKey(record,i)] || {})); setSaving(record.id); mutation.mutate({ record, details }); };
  
  const Step = ({ id, title, scheduleDate, rawScheduleDate, reportDate, hasScheduleRecord }: any) => { 
    const isOverdue = scheduleDate && !reportDate && scheduleDate < new Date(new Date().setHours(0,0,0,0));
    const isWaiting = scheduleDate && !reportDate && !isOverdue;
    const isDone = reportDate;
    
    let stateColor = 'border-slate-200 bg-white text-slate-400';
    let icon = null;
    let statusText = 'Trống';

    if (isDone) {
      stateColor = 'border-emerald-300 bg-emerald-50 text-emerald-700';
      icon = <CheckCircle2 className="w-5 h-5 text-emerald-500"/>;
      statusText = 'Đã có báo cáo';
    } else if (isOverdue) {
      stateColor = 'border-red-300 bg-red-50 text-red-700';
      icon = <AlertTriangle className="w-5 h-5 text-red-500"/>;
      statusText = 'Quá hạn báo cáo';
    } else if (isWaiting || hasScheduleRecord) {
      stateColor = 'border-blue-300 bg-blue-50 text-blue-700';
      icon = <Clock className="w-5 h-5 text-blue-500"/>;
      statusText = 'Đang tiến hành';
    }

    return (
      <div className={`rounded-2xl border p-4 transition-all ${stateColor}`}>
        <div className="flex items-center justify-between">
          <p className="font-bold">{title}</p>
          {icon}
        </div>
        <Badge className={`mt-2 bg-white/50 border-0 text-xs font-semibold ${isOverdue ? 'text-red-700' : ''}`}>{statusText}</Badge>
        <div className="mt-3 space-y-1">
          {hasScheduleRecord && <p className="text-xs opacity-80">Lịch: <b>{rawScheduleDate || (scheduleDate ? fmt(scheduleDate) : 'Có lịch, chưa có ngày')}</b></p>}
          {!hasScheduleRecord && <p className="text-xs opacity-60">Lịch: Chưa có</p>}
          
          {(hasScheduleRecord || reportDate) && (
            <p className="text-xs opacity-80">Báo cáo: <b>{reportDate ? fmt(reportDate) : 'Chưa nhận'}</b></p>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="h-full grid place-items-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (error) return <div className="p-8 text-red-600">Lỗi tải dữ liệu: {(error as any).message}</div>;

  return <div className="h-full bg-slate-50 text-slate-900 overflow-hidden flex flex-col">
    <header className="bg-white border-b border-slate-200 p-5 shrink-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2"><ListTodo className="text-blue-600"/> Cần hành động (Action Items)</h1>
          <p className="text-sm text-slate-500 mt-1">Bảng điều khiển thông minh tự động chỉ ra các vấn đề cần PM/Admin can thiệp.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {[
          ['Dự án Active', kpis.active],
          ['Cần chú ý', kpis.attention, 'text-blue-600'],
          ['Quá hạn báo cáo', kpis.risk, 'text-red-600'],
          ['Dự án Hoàn tất', kpis.done]
        ].map(([l,v,c])=>
        <div key={l as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase">{l}</p>
          <p className={`text-2xl font-black mt-1 ${c||'text-slate-900'}`}>{v}</p>
        </div>)}
      </div>
    </header>

    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] flex-1 min-h-[500px]">
      <aside className="border-r border-slate-200 bg-white overflow-y-auto p-4 space-y-2">
        {visibleProjects.map(p=>
          <button key={p.code} onClick={()=>setSelectedCode(p.code)} className={`w-full text-left p-4 rounded-2xl border transition ${project?.code===p.code?'bg-blue-50 border-blue-300 ring-2 ring-blue-100':'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-black text-sm text-slate-900">{p.code}</p>
                <p className="text-xs text-slate-500 line-clamp-1 mt-1">{p.name || 'Không rõ tên dự án'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400"/>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {p.risks.length ? p.risks.map((r:string)=><Badge key={r} className="bg-red-50 text-red-700 border-red-200 font-semibold">{r}</Badge>) : p.actions.length ? <Badge className="bg-blue-50 text-blue-700 border-blue-200">Cần xử lý</Badge> : <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Ổn định</Badge>}
            </div>
          </button>
        )}
      </aside>

      <main className="overflow-y-auto p-6 space-y-6">
        {project && <>
          {/* Section: Trạng thái Dự Án (Project Stepper) */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black">{project.code}</h2>
                <p className="text-slate-500 mt-1">{project.name || 'Không có tên'}</p>
              </div>
              <Badge className="bg-slate-100 text-slate-700 font-bold border-slate-200">{project.stores.length} Stores được trích xuất</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Step id="ntxx" title="NTXX" scheduleDate={project.ntxxDate} rawScheduleDate={project.rawNtxxDate} hasScheduleRecord={project.byStatus('ntxx').length > 0} />
              <Step id="survey" title="Khảo sát" scheduleDate={project.surveyDate} rawScheduleDate={project.rawSurveyDate} reportDate={project.surveyReportDate} hasScheduleRecord={project.byStatus('khao_sat').length > 0} />
              <Step id="install" title="Lắp đặt" scheduleDate={project.installDate} rawScheduleDate={project.rawInstallDate} reportDate={project.installReportDate} hasScheduleRecord={project.byStatus('lap_dat').length > 0} />
            </div>
          </section>

          {/* Section: Action Items */}
          <section>
            <h3 className="font-black text-lg mb-3 flex items-center gap-2"><Flag className="text-blue-500 w-5 h-5"/> Đề xuất Hành động</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {project.actions.length > 0 ? project.actions.map((act:any, idx:number) => (
                <div key={idx} className={`p-5 rounded-3xl border ${act.border} ${act.bg}`}>
                  <div className={`w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 ${act.color}`}>
                    <act.icon className="w-5 h-5" />
                  </div>
                  <h4 className={`font-black ${act.color}`}>{act.title}</h4>
                  <p className="text-sm mt-2 text-slate-700 font-medium">{act.desc}</p>
                </div>
              )) : (
                <div className="lg:col-span-3 p-8 rounded-3xl border border-dashed border-slate-200 text-center">
                  <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
                  <p className="text-slate-500 font-medium">Dự án đang trong trạng thái chờ hoặc hoàn tất tốt đẹp. Không cần thao tác gì thêm.</p>
                </div>
              )}
            </div>
          </section>

          {/* Section: Store Matrix */}
          <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-black flex items-center gap-2"><Store className="w-5 h-5 text-blue-500"/> Danh sách Stores & Phân công</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-black">
                  <tr>
                    <th className="text-left p-3 w-[200px]">Store Info</th>
                    <th className="text-left p-3">NTXX</th>
                    <th className="text-left p-3">Khảo sát</th>
                    <th className="text-left p-3">Lắp đặt</th>
                    <th className="text-left p-3 w-[250px]">Cập nhật (Nháp)</th>
                  </tr>
                </thead>
                <tbody>
                  {project.stores.length === 0 ? (
                     <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa trích xuất được store nào từ chuỗi email của dự án này.</td></tr>
                  ) : (
                    project.stores.map((row:any)=>(
                      <tr key={`${row.code}-${row.name}`} className="border-t border-slate-100 align-top hover:bg-slate-50">
                        <td className="p-4">
                          <p className="font-black text-slate-900">{row.name||'Không tên'}</p>
                          <p className="font-mono text-xs text-slate-500 mt-1">{row.code||'Không mã'}</p>
                          {row.category && <p className="text-xs text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded mt-2">{row.category}</p>}
                        </td>
                        {(['ntxx','khao_sat','lap_dat'] as WorkflowStatus[]).map(st=>{
                          const step = row.steps[st]; 
                          if(!step) return <td key={st} className="p-4 text-slate-300">—</td>; 
                          
                          const s = step.store as StoreDetail;
                          const reportStep = row.steps[`hoan_thanh_${st}` as WorkflowStatus];
                          const stat = reportStep?.store.status || s.status;
                          
                          return (
                            <td key={st} className="p-3">
                              <Badge className={`text-[10px] px-1.5 py-0.5 ${stat==='Đạt'?'bg-emerald-50 text-emerald-700 border-emerald-200':stat==='Không đạt'?'bg-rose-50 text-rose-700 border-rose-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {stat || 'Chờ báo cáo'}
                              </Badge>
                              <div className="mt-2 space-y-1">
                                <p className="text-[11px] text-slate-600 line-clamp-2" title={s.date}>Lịch: {s.date || 'Trống'}</p>
                                <p className="text-[11px] text-slate-600"><UserPlus className="inline w-3 h-3 mr-1"/> PT: {s.inspector || 'Trống'}</p>
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-4 bg-slate-50/50">
                           {/* Quick Action Panel for the active phase (the latest one they have) */}
                           {(()=>{
                              const latestStatus = ['lap_dat', 'khao_sat', 'ntxx'].find(s => row.steps[s]) as WorkflowStatus;
                              if (!latestStatus) return <p className="text-xs text-slate-400">Không có form</p>;
                              const activeStep = row.steps[latestStatus];
                              const s = activeStep.store;
                              const r = activeStep.record;
                              const i = activeStep.index;

                              return (
                                <div className="space-y-2">
                                  <select value={value(r,s,i,'inspector') as string} onChange={e=>patch(r,i,{inspector:e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none">
                                    <option value="">Phân công nhân viên</option>
                                    {PEOPLE.map(p=><option key={p} value={p}>{p}</option>)}
                                  </select>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select value={value(r,s,i,'status') as string} onChange={e=>patch(r,i,{status:e.target.value})} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none">
                                      <option value="">Kết quả</option>
                                      <option value="Đạt">Đạt</option>
                                      <option value="Không đạt">Không đạt</option>
                                    </select>
                                    <button onClick={()=>save(r)} disabled={saving===r.id} className="bg-blue-600 text-white rounded-xl px-3 py-2 text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1">
                                      {saving===r.id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Lưu'}
                                    </button>
                                  </div>
                                </div>
                              );
                           })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>}
      </main>
    </div>
    
    {lightbox&&<div className="fixed inset-0 z-50 bg-black/90 grid place-items-center p-6" onClick={()=>setLightbox(null)}><button className="absolute top-5 right-5 text-white"><XCircle className="w-8 h-8"/></button><img src={lightbox} className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl"/></div>}
  </div>;
}
