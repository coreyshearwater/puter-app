
/**
 * Simple debounce utility for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Basic in-memory cache with TTL
 */
export class MemoryCache<T> {
    private cache = new Map<string, { data: T; expiry: number }>();
    private ttl: number;

    constructor(ttl_ms: number = 300000) { // Default 5 minutes
        this.ttl = ttl_ms;
    }

    set(key: string, data: T) {
        this.cache.set(key, { data, expiry: Date.now() + this.ttl });
    }

    get(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }

    clear() {
        this.cache.clear();
    }
}
