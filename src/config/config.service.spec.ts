import { ConfigService } from './config.service';

describe('ConfigService', () => {
  describe('get()', () => {
    test('should return all data from config if no key is given', async () => {
      const configService = new ConfigService();
      const config = await configService.get();
      expect(config).toMatchObject({
        env: 'test',
      });
    });

    test('should return only data from config that matches given key', async () => {
      const configService = new ConfigService();
      const config = await configService.get('env');
      expect(config).toEqual('test');
    });
  });

  describe('set()', () => {
    test('should set only data in config that matches given key', async () => {
      const configService = new ConfigService();
      await configService.set('env', 'foo');
      const config = await configService.get();
      expect(config).toMatchObject({
        env: 'foo',
      });
    });
  });

  describe('has()', () => {
    test('should return whether the key in the config exists', async () => {
      const configService = new ConfigService();
      expect(await configService.has('env')).toBe(true);
      expect(await configService.has('foo')).toBe(false);
    });
  });
});
