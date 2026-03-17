import { describe, it, expect, _vi, beforeEach } from 'vitest';
import { HealthChecker } from '../health-checker';
import {
  handleLivenessRequest,
  handleReadinessRequest,
  createDatabaseCheck,
  createAdapterCheck,
  createCustomCheck,
} from '../health-endpoint';

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker();
  });

  describe('configure', () => {
    it('should set version', () => {
      checker.configure({ version: '1.2.3' });
      return checker.runLivenessChecks().then((result) => {
        expect(result.version).toBe('1.2.3');
      });
    });

    it('should use default version when not configured', async () => {
      const result = await checker.runLivenessChecks();
      expect(result.version).toBe('0.0.0');
    });
  });

  describe('getUptime', () => {
    it('should return uptime in seconds', () => {
      const uptime = checker.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe('number');
    });
  });

  describe('runLivenessChecks', () => {
    it('should return healthy status', async () => {
      const result = await checker.runLivenessChecks();
      expect(result.status).toBe('healthy');
      expect(result.checks).toEqual([]);
      expect(result.timestamp).toBeTruthy();
      expect(typeof result.uptime).toBe('number');
    });

    it('should include ISO 8601 timestamp', async () => {
      const result = await checker.runLivenessChecks();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });


  describe('runReadinessChecks', () => {
    it('should return healthy when all checks pass', async () => {
      checker.registerCheck('db', async () => ({ status: 'healthy', message: 'OK' }));
      checker.registerCheck('cache', async () => ({ status: 'healthy' }));

      const result = await checker.runReadinessChecks();
      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].name).toBe('db');
      expect(result.checks[0].status).toBe('healthy');
      expect(result.checks[0].latency).toBeGreaterThanOrEqual(0);
      expect(result.checks[1].name).toBe('cache');
      expect(result.checks[1].status).toBe('healthy');
    });

    it('should return unhealthy when any check fails', async () => {
      checker.registerCheck('db', async () => ({ status: 'healthy' }));
      checker.registerCheck('cache', async () => ({ status: 'unhealthy', message: 'Connection refused' }));

      const result = await checker.runReadinessChecks();
      expect(result.status).toBe('unhealthy');
      expect(result.checks[1].status).toBe('unhealthy');
      expect(result.checks[1].message).toBe('Connection refused');
    });

    it('should return healthy with no registered checks', async () => {
      const result = await checker.runReadinessChecks();
      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveLength(0);
    });

    it('should handle check that throws an error', async () => {
      checker.registerCheck('failing', async () => {
        throw new Error('Unexpected failure');
      });

      const result = await checker.runReadinessChecks();
      expect(result.status).toBe('unhealthy');
      expect(result.checks[0].status).toBe('unhealthy');
      expect(result.checks[0].message).toBe('Unexpected failure');
    });

    it('should handle check timeout', async () => {
      checker.configure({ timeout: 50 });
      checker.registerCheck('slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { status: 'healthy' };
      });

      const result = await checker.runReadinessChecks();
      expect(result.status).toBe('unhealthy');
      expect(result.checks[0].status).toBe('unhealthy');
      expect(result.checks[0].message).toContain('timed out');
    });

    it('should measure latency for each check', async () => {
      checker.registerCheck('fast', async () => ({ status: 'healthy' }));

      const result = await checker.runReadinessChecks();
      expect(result.checks[0].latency).toBeGreaterThanOrEqual(0);
      expect(typeof result.checks[0].latency).toBe('number');
    });

    it('should respect per-check timeout override', async () => {
      checker.configure({ timeout: 5000 });
      checker.registerCheck(
        'slow',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { status: 'healthy' };
        },
        { timeout: 50 }
      );

      const result = await checker.runReadinessChecks();
      expect(result.status).toBe('unhealthy');
      expect(result.checks[0].message).toContain('timed out');
    });
  });
});


describe('Health Endpoints', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker();
    checker.configure({ version: '1.0.0' });
  });

  describe('handleLivenessRequest', () => {
    it('should return 200 with healthy status', async () => {
      const response = await handleLivenessRequest(checker);
      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.timestamp).toBeTruthy();
    });
  });

  describe('handleReadinessRequest', () => {
    it('should return 200 when all checks pass', async () => {
      checker.registerCheck('db', async () => ({ status: 'healthy' }));
      const response = await handleReadinessRequest(checker);
      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('should return 503 when any check fails', async () => {
      checker.registerCheck('db', async () => ({ status: 'unhealthy', message: 'Down' }));
      const response = await handleReadinessRequest(checker);
      expect(response.statusCode).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });
});

describe('Check Helpers', () => {
  describe('createDatabaseCheck', () => {
    it('should return healthy when ping succeeds', async () => {
      const pingFn = async () => {};
      const check = createDatabaseCheck(pingFn);
      const result = await check();
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Database connection OK');
    });

    it('should return unhealthy when ping fails', async () => {
      const pingFn = async () => { throw new Error('Connection refused'); };
      const check = createDatabaseCheck(pingFn);
      const result = await check();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Connection refused');
    });
  });

  describe('createAdapterCheck', () => {
    it('should return healthy when adapter is initialized', async () => {
      const check = createAdapterCheck('Redis', async () => true);
      const result = await check();
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Redis adapter initialized');
    });

    it('should return unhealthy when adapter is not initialized', async () => {
      const check = createAdapterCheck('Redis', async () => false);
      const result = await check();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Redis adapter not initialized');
    });

    it('should return unhealthy when adapter check throws', async () => {
      const check = createAdapterCheck('Redis', async () => { throw new Error('Adapter error'); });
      const result = await check();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Adapter error');
    });
  });

  describe('createCustomCheck', () => {
    it('should return result from custom function', async () => {
      const check = createCustomCheck('custom', async () => ({
        status: 'healthy',
        message: 'All good',
      }));
      const result = await check();
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('All good');
    });

    it('should handle custom function errors', async () => {
      const check = createCustomCheck('custom', async () => { throw new Error('Custom failure'); });
      const result = await check();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Custom failure');
    });
  });
});
