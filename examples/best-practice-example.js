"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../src/index");
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
class DatabaseService {
    constructor() {
        this.pool = (0, index_1.createPool)({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'mydb',
            port: parseInt(process.env.DB_PORT || '3306'),
            connectionLimit: 10,
            // Performance optimizations
            compress: true, // Enable compression for large result sets
        }, {
            // Cache configuration
            ttl: 30000, // 30 seconds - adjust based on data freshness needs
            maxSize: 100, // Cache up to 100 different queries
            enabled: true, // Enable caching
            debug: process.env.NODE_ENV === 'development', // Debug only in dev
        });
    }
    // Singleton pattern - create pool once, reuse everywhere
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    // Get users - frequently accessed, good for caching
    async getUsers(limit = 10) {
        return this.pool.query('SELECT * FROM user LIMIT ?', [limit]);
    }
    // Get user by ID - perfect for caching (same query repeated often)
    async getUserById(userId) {
        return this.pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    }
    // Search users - less predictable, but still cacheable
    async searchUsers(username) {
        return this.pool.query('SELECT * FROM users WHERE username LIKE ? LIMIT 20', [`%${username}%`]);
    }
    // Update user - mutations should NOT use cache
    async updateUser(userId, data) {
        // Clear related cache entries after mutation
        this.pool.clearCache('SELECT * FROM users WHERE id');
        return this.pool.query('UPDATE users SET updated_at = NOW() WHERE id = ?', [userId]);
    }
    // Get cache statistics - monitor performance
    getCachePerformance() {
        const stats = this.pool.getCacheStats();
        const hitRate = stats.hits && stats.misses
            ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)
            : '0.00';
        return {
            ...stats,
            hitRate: `${hitRate}%`,
            efficiency: hitRate,
        };
    }
    // Reset stats - useful for testing
    resetStats() {
        this.pool.resetStats();
    }
    // Graceful shutdown
    async close() {
        await this.pool.end();
    }
}
// Example usage
async function demonstratePerformance() {
    const db = DatabaseService.getInstance();
    console.log('\n=== Performance Demonstration ===\n');
    // First query - CACHE MISS (will take ~2000ms for remote DB)
    console.log('1. First query (Cache Miss - hits database):');
    console.time('Query 1');
    await db.getUserById('b5a0179c-556c-4884-9243-00293be5656f');
    console.timeEnd('Query 1');
    // Second query - CACHE HIT (will take <1ms)
    console.log('\n2. Same query again (Cache Hit - returns instantly):');
    console.time('Query 2');
    await db.getUserById('b5a0179c-556c-4884-9243-00293be5656f');
    console.timeEnd('Query 2');
    // Third query - Different parameter (CACHE MISS)
    console.log('\n3. Different user (Cache Miss - hits database):');
    console.time('Query 3');
    await db.getUserById('7fe2df00-0157-4c3f-a5ba-00360a60af97');
    console.timeEnd('Query 3');
    // Fourth query - Previous query (CACHE HIT)
    console.log('\n4. Previous user again (Cache Hit - instant):');
    console.time('Query 4');
    await db.getUserById('7fe2df00-0157-4c3f-a5ba-00360a60af97');
    console.timeEnd('Query 4');
    // Get multiple users - demonstrate list queries
    console.log('\n5. Get list of users (Cache Miss):');
    console.time('Query 5');
    await db.getUsers(5);
    console.timeEnd('Query 5');
    console.log('\n6. Same list again (Cache Hit):');
    console.time('Query 6');
    await db.getUsers(5);
    console.timeEnd('Query 6');
    // Performance stats
    console.log('\n=== Cache Performance Stats ===');
    const stats = db.getCachePerformance();
    console.log(stats);
    console.log(`\nHit Rate: ${stats.hitRate}`);
    console.log(`Cache Size: ${stats.size}/${stats.maxSize}`);
    console.log(`Total Queries: ${stats.hits + stats.misses}`);
    console.log(`Database Hits Avoided: ${stats.hits}`);
    // Calculate time saved (approximate)
    const avgDbTime = 2000; // ms
    const avgCacheTime = 0.5; // ms
    const timeSaved = (stats.hits || 0) * (avgDbTime - avgCacheTime);
    console.log(`\nEstimated Time Saved: ~${timeSaved.toFixed(0)}ms`);
    await db.close();
}
// Best practices summary
async function bestPracticesDemo() {
    const db = DatabaseService.getInstance();
    console.log('\n=== Best Practices ===\n');
    // ✅ DO: Reuse the same pool instance
    console.log('✅ DO: Use singleton pattern for pool');
    console.log('   const db = DatabaseService.getInstance();');
    // ✅ DO: Cache frequently accessed data
    console.log('\n✅ DO: Cache read-heavy queries');
    await db.getUserById('b5a0179c-556c-4884-9243-00293be5656f');
    await db.getUserById('b5a0179c-556c-4884-9243-00293be5656f'); // Cached!
    // ✅ DO: Clear cache after mutations
    console.log('\n✅ DO: Clear cache after updates');
    await db.updateUser('b5a0179c-556c-4884-9243-00293be5656f', {});
    // ✅ DO: Monitor cache performance
    console.log('\n✅ DO: Monitor cache hit rate');
    const stats = db.getCachePerformance();
    console.log(`   Hit Rate: ${stats.hitRate}`);
    // ✅ DO: Set appropriate TTL
    console.log('\n✅ DO: Set TTL based on data update frequency');
    console.log('   - User profiles: 30-60s');
    console.log('   - Static data: 5-10min');
    console.log('   - Real-time data: 1-5s or disable cache');
    // ❌ DON\'T: Create new pool for each request
    console.log('\n❌ DON\'T: Create pool per request (very slow!)');
    console.log('   // BAD: new MariaDBCache(...) on every request');
    // ❌ DON\'T: Cache data that changes frequently
    console.log('\n❌ DON\'T: Cache highly volatile data');
    console.log('   - Real-time analytics');
    console.log('   - Live counters');
    console.log('   - Session data');
    await db.close();
}
// Uncomment to run demonstrations
if (require.main === module) {
    demonstratePerformance()
        .then(() => console.log('\n✓ Performance demo complete'))
        .catch(console.error);
    // Or run:
    // bestPracticesDemo()
    //     .then(() => console.log('\n✓ Best practices demo complete'))
    //     .catch(console.error);
}
exports.default = DatabaseService;
//# sourceMappingURL=best-practice-example.js.map