import Redis, { RedisOptions } from 'ioredis';
import { RedisConfig } from '../types/config';

export class RedisConnectionManager {
  private client: Redis | null = null;
  private config: RedisConfig;
  private isHealthy: boolean = false;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<Redis> {
    if (this.client && this.isHealthy) {
      return this.client;
    }

    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port || 6379,
      password: this.config.password,
      db: this.config.db || 0,
      keyPrefix: this.config.keyPrefix || 'sdc:',
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      ...this.config.options,
    };

    this.client = new Redis(options);

    this.client.on('connect', () => {
      this.isHealthy = true;
    });

    this.client.on('error', (error: Error) => {
      this.isHealthy = false;
      console.error('[Redis] Connection error:', error.message);
    });

    this.client.on('close', () => {
      this.isHealthy = false;
    });

    // Wait for initial connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);

      this.client!.once('ready', () => {
        clearTimeout(timeout);
        this.isHealthy = true;
        resolve();
      });

      this.client!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isHealthy) {
      return null;
    }
    try {
      const client = await this.connect();
      return await client.get(key);
    } catch (error) {
      console.error('[Redis] Get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isHealthy) {
      return;
    }
    try {
      const client = await this.connect();
      if (ttlSeconds) {
        await client.set(key, value, 'EX', ttlSeconds);
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      console.error('[Redis] Set error:', error);
    }
  }

  async del(key: string | string[]): Promise<number> {
    if (!this.isHealthy) {
      return 0;
    }
    try {
      const client = await this.connect();
      const keys = Array.isArray(key) ? key : [key];
      return await client.del(...keys);
    } catch (error) {
      console.error('[Redis] Del error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isHealthy) {
      return false;
    }
    try {
      const client = await this.connect();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Redis] Exists error:', error);
      return false;
    }
  }

  async scan(pattern: string): Promise<string[]> {
    if (!this.isHealthy) {
      return [];
    }
    try {
      const client = await this.connect();
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, matchedKeys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...matchedKeys);
      } while (cursor !== '0');

      return keys;
    } catch (error) {
      console.error('[Redis] Scan error:', error);
      return [];
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.scan(pattern);
    if (keys.length === 0) {
      return 0;
    }
    return await this.del(keys);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.connect();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isHealthy = false;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.isHealthy;
  }

  getClient(): Redis | null {
    return this.client;
  }
}
