import { HealthController } from './health.controller';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { name, version } = require('../../package.json');

describe('HealthController', () => {
  it('returns service name, version, and uptime', () => {
    const controller = new HealthController();
    const result = controller.health();

    expect(result.name).toBe(name);
    expect(result.version).toBe(version);
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
