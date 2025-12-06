/**
 * Best Practice Example for MariaDB Cache
 *
 * Key Performance Tips:
 * 1. Create pool once and reuse it (singleton pattern)
 * 2. Use appropriate TTL based on your data update frequency
 * 3. Set maxSize based on your query patterns
 * 4. Enable debug in development, disable in production
 * 5. Monitor cache hit rates and adjust settings
 */
declare class DatabaseService {
    private static instance;
    private pool;
    private constructor();
    static getInstance(): DatabaseService;
    getUsers(limit?: number): Promise<any>;
    getUserById(userId: number | string): Promise<any>;
    searchUsers(username: string): Promise<any>;
    updateUser(userId: number | string, data: any): Promise<any>;
    getCachePerformance(): {
        hitRate: string;
        efficiency: string;
        size: number;
        maxSize: number;
        ttl: number;
        enabled: boolean;
        hits?: number;
        misses?: number;
        evictions?: number;
    };
    resetStats(): void;
    close(): Promise<void>;
}
export default DatabaseService;
//# sourceMappingURL=best-practice-example.d.ts.map