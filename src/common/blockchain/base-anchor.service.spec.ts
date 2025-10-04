import { Test, TestingModule } from '@nestjs/testing';
import { BaseAnchorService } from './base-anchor.service';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';

// eqty-core
jest.mock('eqty-core', () => ({
  AnchorClient: jest.fn().mockImplementation(() => ({
    getMaxAnchors: jest.fn().mockResolvedValue(100),
  })),
  Binary: {
    fromHex: jest.fn().mockImplementation((hex: string) => ({
      hex: hex,
      base58: 'mock-base58',
    })),
  },
  BASE_CHAIN_ID: 8453,
  BASE_SEPOLIA_CHAIN_ID: 84532,
}));

import { AnchorClient } from 'eqty-core';
(AnchorClient as any).ABI = [
  {
    inputs: [{ name: 'key', type: 'bytes32' }],
    name: 'Anchored',
    type: 'event',
    anonymous: false,
  },
];
(AnchorClient as any).contractAddress = jest.fn().mockImplementation((networkId: number) => {
  if (networkId === 8453) return '0x1234567890123456789012345678901234567890';
  if (networkId === 84532) return '0x0987654321098765432109876543210987654321';
  throw new Error(`Unsupported network ID: ${networkId}`);
});

// Mock ethers
jest.mock('ethers', () => ({
  Contract: jest.fn().mockImplementation(() => ({
    filters: {
      Anchored: jest.fn().mockReturnValue({}),
    },
    queryFilter: jest.fn().mockResolvedValue([]),
  })),
  JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
}));

describe('BaseAnchorService', () => {
  let service: BaseAnchorService;
  let configService: ConfigService;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaseAnchorService,
        {
          provide: ConfigService,
          useValue: {
            getBaseRpcUrl: jest.fn().mockImplementation((network: string) => {
              if (network === 'mainnet') return 'https://mainnet.base.org';
              if (network === 'sepolia') return 'https://sepolia.base.org';
              return 'https://mainnet.base.org';
            }),
            getAnchorVerificationCacheTtl: jest.fn().mockReturnValue(300000), // 5 minutes
            getAnchorVerificationMaxRetries: jest.fn().mockReturnValue(3),
            getAnchorVerificationTimeout: jest.fn().mockReturnValue(10000),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BaseAnchorService>(BaseAnchorService);
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should support Base networks', () => {
    expect(service.isNetworkSupported(8453)).toBe(true); // BASE_CHAIN_ID
    expect(service.isNetworkSupported(84532)).toBe(true); // BASE_SEPOLIA_CHAIN_ID
    expect(service.isNetworkSupported(999)).toBe(false);
  });

  it('should get supported networks', () => {
    const networks = service.getSupportedNetworks();
    expect(networks).toContain(8453);
    expect(networks).toContain(84532);
  });

  it('should get anchor contract addresses', () => {
    const mainnetAddress = service.getAnchorContractAddress(8453);
    const sepoliaAddress = service.getAnchorContractAddress(84532);

    expect(mainnetAddress).toBeDefined();
    expect(sepoliaAddress).toBeDefined();
    expect(mainnetAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(sepoliaAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should handle cache operations', () => {
    const stats = service.getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.entries).toEqual([]);

    service.clearCache();
    expect(loggerService.debug).toHaveBeenCalledWith('Anchor verification cache cleared');
  });

  it('should handle verification for unsupported network', async () => {
    const result = await service.verifyAnchor(999, '0x1234567890abcdef');

    expect(result.isAnchored).toBe(false);
    expect(result.error).toContain('No provider available for network 999');
  });

  it('should handle batch verification for unsupported network', async () => {
    const hashes = ['0x1234567890abcdef', '0xfedcba0987654321'];
    const results = await service.verifyAnchorsBatch(999, hashes);

    expect(results.size).toBe(2);
    for (const [_hash, result] of results) {
      expect(result.isAnchored).toBe(false);
      expect(result.error).toContain('No provider available for network 999');
    }
  });

  it('should work with string hashes', async () => {
    const result = await service.verifyAnchor(8453, '0x1234567890abcdef');

    expect(result).toBeDefined();
    expect(typeof result.isAnchored).toBe('boolean');
  });

  it('should work with Binary objects', async () => {
    const { Binary } = await import('eqty-core');
    const hash = Binary.fromHex('0x1234567890abcdef');
    const result = await service.verifyAnchor(8453, hash);

    expect(result).toBeDefined();
    expect(typeof result.isAnchored).toBe('boolean');
  });

  it('should handle batch verification with mixed hash types', async () => {
    const { Binary } = await import('eqty-core');
    const hashes = ['0x1234567890abcdef', Binary.fromHex('0xfedcba0987654321')];
    const results = await service.verifyAnchorsBatch(8453, hashes);

    expect(results.size).toBe(2);
    expect(results.has('0x1234567890abcdef')).toBe(true);
    expect(results.has('0xfedcba0987654321')).toBe(true);
  });

  it('should use configuration values during initialization', () => {
    // These are called during initialization
    expect(configService.getBaseRpcUrl).toHaveBeenCalledWith('mainnet');
    expect(configService.getBaseRpcUrl).toHaveBeenCalledWith('sepolia');
  });

  it('should have configuration methods available', () => {
    expect(configService.getAnchorVerificationCacheTtl()).toBe(300000);
    expect(configService.getAnchorVerificationMaxRetries()).toBe(3);
    expect(configService.getAnchorVerificationTimeout()).toBe(10000);
  });

  it('should log initialization messages', () => {
    expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Initialized Base Mainnet anchor client'));
    expect(loggerService.debug).toHaveBeenCalledWith(expect.stringContaining('Initialized Base Sepolia anchor client'));
  });
});
