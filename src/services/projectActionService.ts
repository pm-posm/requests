import { supabase } from '@/lib/supabase';

export interface MergeProjectsInDetailParams {
  currentProjectKey: string;
  targetProjectKey: string;
  targetProjectName: string;
}

export interface SplitProjectInDetailParams {
  currentProjectKey: string;
  selectedThreadIds: string[];
  selectedRequestIds?: string[];
  newProjectKey: string;
  newProjectName: string;
}

/**
 * Gộp Dự án Hiện Tại (Current Project) vào 1 Dự Án Khác (Target Project)
 * Đánh dấu badge [merged_from_project = currentProjectKey]
 */
export async function mergeCurrentProjectIntoTarget({
  currentProjectKey,
  targetProjectKey,
  targetProjectName
}: MergeProjectsInDetailParams) {
  const cleanCurrent = currentProjectKey.trim();
  const cleanTargetKey = targetProjectKey.trim();
  const cleanTargetName = targetProjectName.trim();

  if (!cleanCurrent || !cleanTargetKey) {
    throw new Error('Thiếu thông tin dự án cần gộp.');
  }

  if (cleanCurrent === cleanTargetKey) {
    throw new Error('Không thể gộp dự án vào chính nó.');
  }

  // 1. Update project_activities and stamp merged_from_project
  const { error: actError } = await supabase
    .from('project_activities')
    .update({ 
      final_project: cleanTargetKey,
      name_project: cleanTargetName,
      merged_from_project: cleanCurrent
    })
    .eq('final_project', cleanCurrent);

  if (actError) console.warn("Lỗi update project_activities:", actError);

  // 2. Update project_progress_ai
  const { error: aiError } = await supabase
    .from('project_progress_ai')
    .update({ 
      detected_project_code: cleanTargetKey,
      detected_project_name: cleanTargetName 
    })
    .eq('detected_project_code', cleanCurrent);

  if (aiError) console.warn("Lỗi update project_progress_ai:", aiError);

  // 3. Update raw_requests
  const { error: reqError } = await supabase
    .from('raw_requests')
    .update({ 
      request_id: cleanTargetKey,
      title_email_request: cleanTargetName,
      is_mer_modified: true
    })
    .eq('request_id', cleanCurrent);

  if (reqError) console.warn("Lỗi update raw_requests:", reqError);

  // 4. Update posm_projects
  const { error: posmError } = await supabase
    .from('posm_projects')
    .update({ 
      final_key: cleanTargetKey,
      source_project_name: cleanTargetName 
    })
    .eq('final_key', cleanCurrent);

  if (posmError) console.warn("Lỗi update posm_projects:", posmError);

  return true;
}

/**
 * Tách các Thread ID / Request ID thuộc Dự Án Hiện Tại thành Dự Án Mới
 * Bắt buộc người dùng nhập cả newProjectKey và newProjectName
 */
export async function splitCurrentProjectService({
  currentProjectKey,
  selectedThreadIds,
  selectedRequestIds = [],
  newProjectKey,
  newProjectName
}: SplitProjectInDetailParams) {
  const cleanNewKey = newProjectKey.trim();
  const cleanNewName = newProjectName.trim();

  if (!cleanNewKey || !cleanNewName) {
    throw new Error('Vui lòng nhập đầy đủ cả Mã Dự Án và Tên Dự Án mới.');
  }

  if ((!selectedThreadIds || selectedThreadIds.length === 0) && (!selectedRequestIds || selectedRequestIds.length === 0)) {
    throw new Error('Vui lòng chọn ít nhất 1 luồng email (Thread ID) để tách.');
  }

  // 1. Split in project_activities by thread_id
  if (selectedThreadIds.length > 0) {
    const { error: actError } = await supabase
      .from('project_activities')
      .update({
        final_project: cleanNewKey,
        name_project: cleanNewName
      })
      .in('thread_id', selectedThreadIds);

    if (actError) console.warn("Lỗi split project_activities:", actError);

    // Split in project_progress_ai
    const { error: aiError } = await supabase
      .from('project_progress_ai')
      .update({
        detected_project_code: cleanNewKey,
        detected_project_name: cleanNewName
      })
      .in('thread_id', selectedThreadIds);

    if (aiError) console.warn("Lỗi split project_progress_ai:", aiError);
  }

  // 2. Split in raw_requests by id
  if (selectedRequestIds.length > 0) {
    const { error: reqError } = await supabase
      .from('raw_requests')
      .update({
        request_id: cleanNewKey,
        title_email_request: cleanNewName,
        is_mer_modified: true
      })
      .in('id', selectedRequestIds);

    if (reqError) console.warn("Lỗi split raw_requests:", reqError);
  }

  return true;
}

export const mergeProjectsService = mergeCurrentProjectIntoTarget as any;
export const splitProjectService = splitCurrentProjectService as any;
