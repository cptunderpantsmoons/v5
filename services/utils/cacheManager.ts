export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0
  };

  constructor(private maxSize: number = 100, private defaultTTL: number = 300000) { // 5 minutes default TTL
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    
    this.stats.hits++;
    this.updateHitRate();
    return entry.data;
  }

  // Get data with type parameter
  getByType<T>(key: string, type: any): T | null {
    return this.get<T>(key);
  }

  // Set data in cache
  set<T>(key: string, data: T, ttl?: number): void {
    // If cache is full, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      key
    };
    
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  // Delete specific entry
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.hitRate = 0;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    return Date.now() <= entry.timestamp + entry.ttl;
  }

  // Get all keys
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.stats.size = this.cache.size;
  }

  // Evict oldest entries when cache is full
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // Update hit rate
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// Specialized cache for API responses
export class ApiCache {
  private cache: CacheManager;
  
  constructor(maxSize: number = 50, defaultTTL: number = 300000) { // 5 minutes default
    this.cache = new CacheManager(maxSize, defaultTTL);
  }

  // Generate cache key from request parameters
  private generateKey(endpoint: string, params: any): string {
    const paramString = JSON.stringify(params);
    return `${endpoint}:${btoa(paramString)}`;
  }

  // Get cached API response
  get<T>(endpoint: string, params: any): T | null {
    const key = this.generateKey(endpoint, params);
    return this.cache.getByType<T>(key, null);
  }

  // Cache API response
  set<T>(endpoint: string, params: any, data: T, ttl?: number): void {
    const key = this.generateKey(endpoint, params);
    this.cache.set<T>(key, data, ttl);
  }

  // Invalidate cache for specific endpoint
  invalidate(endpoint: string): void {
    const keys = this.cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(endpoint + ':'));
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Get cache statistics
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  // Clear all API cache
  clear(): void {
    this.cache.clear();
  }
}

// Specialized cache for file processing results
export class FileProcessingCache {
  private cache: CacheManager;
  
  constructor(maxSize: number = 20, defaultTTL: number = 1800000) { // 30 minutes default
    this.cache = new CacheManager(maxSize, defaultTTL);
  }

  // Generate cache key from file content
  private generateKey(file: File): string {
    // Use file name, size, and last modified time as key
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  // Get cached processing result
  get<T>(file: File): T | null {
    const key = this.generateKey(file);
    return this.cache.getByType<T>(key, null);
  }

  // Cache processing result
  set<T>(file: File, data: T, ttl?: number): void {
    const key = this.generateKey(file);
    this.cache.set<T>(key, data, ttl);
  }

  // Check if file is cached
  has(file: File): boolean {
    const key = this.generateKey(file);
    return this.cache.has(key);
  }

  // Get cache statistics
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  // Clear file processing cache
  clear(): void {
    this.cache.clear();
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  // Record performance metric
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  // Get statistics for a metric
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sorted.reduce((sum, val) => sum + val, 0) / count;
    const median = count % 2 === 0 
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
    const p95Index = Math.floor(count * 0.95);
    const p95 = sorted[p95Index];
    
    return { count, min, max, avg, median, p95 };
  }

  // Get all metrics
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const name of this.metrics.keys()) {
      stats[name] = this.getStats(name);
    }
    
    return stats;
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
  }
}

// Utility function to measure function performance
export function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  monitor: PerformanceMonitor
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      monitor.record(name, duration);
      resolve(result);
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      monitor.record(`${name}_error`, duration);
      reject(error);
    }
  });
}

// Singleton instances for global use
export const apiCache = new ApiCache();
export const fileProcessingCache = new FileProcessingCache();
export const performanceMonitor = new PerformanceMonitor();