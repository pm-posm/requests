import { supabase } from '@/lib/supabase';

export interface PendingPushItem {
    sheetRowIndex: number;
    phuongAn?: string;
    ngayQuickFix?: string;
    status?: string;
    tienDo?: string;
    supplier?: string;
    requestId?: string;
    merNote?: string;
}

export type AutoPushStatus = 'idle' | 'pending' | 'pushing' | 'success' | 'error';

interface AutoPushState {
    status: AutoPushStatus;
    pendingCount: number;
    lastPushedAt: string | null;
    lastError: string | null;
}

const pendingQueue = new Map<number, PendingPushItem>();
let pushDebounceTimer: NodeJS.Timeout | null = null;

let currentState: AutoPushState = {
    status: 'idle',
    pendingCount: 0,
    lastPushedAt: null,
    lastError: null
};

const listeners = new Set<(state: AutoPushState) => void>();

function notifyListeners() {
    listeners.forEach(fn => fn({ ...currentState }));
}

export function subscribeAutoPush(fn: (state: AutoPushState) => void) {
    listeners.add(fn);
    fn({ ...currentState });
    return () => {
        listeners.delete(fn);
    };
}

export function queueAutoPush(item: PendingPushItem) {
    if (!item.sheetRowIndex || item.sheetRowIndex < 2) return;

    // Merge with existing item in queue if present
    const existing = pendingQueue.get(item.sheetRowIndex) || { sheetRowIndex: item.sheetRowIndex };
    const merged: PendingPushItem = {
        ...existing,
        ...item
    };

    pendingQueue.set(item.sheetRowIndex, merged);

    currentState = {
        ...currentState,
        status: 'pending',
        pendingCount: pendingQueue.size,
        lastError: null
    };
    notifyListeners();

    // Reset 1.5s debounce timer
    if (pushDebounceTimer) {
        clearTimeout(pushDebounceTimer);
    }

    pushDebounceTimer = setTimeout(() => {
        flushAutoPushQueue();
    }, 1500);
}

export async function flushAutoPushQueue() {
    if (pendingQueue.size === 0) return;

    const updatesToPush = Array.from(pendingQueue.values());
    pendingQueue.clear();

    currentState = {
        ...currentState,
        status: 'pushing',
        pendingCount: 0
    };
    notifyListeners();

    try {
        const { data, error } = await supabase.functions.invoke('push-to-google-sheet', {
            body: { updates: updatesToPush }
        });

        if (error) {
            console.warn('Auto-push warning:', error);
            currentState = {
                ...currentState,
                status: 'error',
                lastError: error.message || 'Lỗi khi đẩy dữ liệu lên Google Sheet'
            };
        } else {
            const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            currentState = {
                status: 'success',
                pendingCount: 0,
                lastPushedAt: now,
                lastError: null
            };
        }
    } catch (err: any) {
        console.warn('Auto-push failed:', err);
        currentState = {
            ...currentState,
            status: 'error',
            lastError: err.message || 'Lỗi kết nối khi đẩy Google Sheet'
        };
    } finally {
        notifyListeners();
    }
}
