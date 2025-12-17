// Simple in-memory store for Progress Tracking
// Works for local development/processing. In serverless, requires Redis/KV.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProgressCallback = (data: any) => void;

class ProgressStore {
    private listeners: Map<string, ProgressCallback> = new Map();

    subscribe(id: string, callback: ProgressCallback) {
        this.listeners.set(id, callback);
        return () => this.listeners.delete(id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(id: string, data: any) {
        const cb = this.listeners.get(id);
        if (cb) cb(data);
    }
}

export const progressStore = new ProgressStore();
