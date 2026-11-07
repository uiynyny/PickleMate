type EventHandler = (payload: any) => void;

class RealtimeBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, cb: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb: EventHandler) {
    this.listeners.get(event)?.delete(cb);
  }

  emit(event: string, payload: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`RealtimeBus listener error on ${event}:`, err);
        }
      });
    }
  }
}

export const realtimeBus = new RealtimeBus();
