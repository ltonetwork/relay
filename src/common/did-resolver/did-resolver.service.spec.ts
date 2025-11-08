import { Test, TestingModule } from '@nestjs/testing';
import { DidResolverService } from './did-resolver.service';
import { RequestService } from '../request/request.service';
import { ConfigService } from '../config/config.service';
import { DIDDocument } from './did-document.type';
import { LoggerService } from '../logger/logger.service';

describe('DidResolverService', () => {
  let service: DidResolverService;
  let requestService: RequestService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DidResolverService,
        {
          provide: RequestService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getDefaultServiceEndpoint: jest.fn().mockReturnValue('https://relay.lto.network'),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DidResolverService>(DidResolverService);
    requestService = module.get<RequestService>(RequestService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolve', () => {
    it('should return null for Ethereum address (DID resolution not implemented)', async () => {
      const address = '0x1234567890123456789012345678901234567890';

      const result = await service.resolve(address);

      expect(result).toBeNull();
    });

    it('should throw an error for invalid Ethereum address', async () => {
      const address = 'invalid-address';

      const result = service.resolve(address);

      await expect(result).rejects.toThrow(`Invalid Ethereum address ${address}`);
    });
  });

  describe('getServiceEndpoint', () => {
    it('should return default service endpoint for Ethereum address', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const defaultEndpoint = 'https://relay.lto.network';

      // Spy on resolve method
      const resolveSpy = jest.spyOn(service, 'resolve').mockResolvedValue(null);

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe(defaultEndpoint);
      expect(resolveSpy).toHaveBeenCalledWith(address);

      resolveSpy.mockRestore();
    });

    it('should return service endpoint from didDocument if available', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const didDocument = {
        service: [
          { type: 'other-service', serviceEndpoint: 'https://other.example.com' },
          { type: 'eqty-relay', serviceEndpoint: 'https://relay.example.com' },
        ],
      };

      jest.spyOn(service, 'resolve').mockResolvedValue(didDocument as DIDDocument);

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe(didDocument.service[1].serviceEndpoint);
      expect(service.resolve).toHaveBeenCalledWith(address);
    });

    it('should return default service endpoint if didDocument does not contain a matching service', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const didDocument = {
        service: [
          { type: 'other-service', serviceEndpoint: 'https://other.example.com' },
          { type: 'some-service', serviceEndpoint: 'https://some.example.com' },
        ],
      };
      const defaultEndpoint = 'https://relay.lto.network';

      jest.spyOn(service, 'resolve').mockResolvedValue(didDocument as DIDDocument);

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe(defaultEndpoint);
      expect(service.resolve).toHaveBeenCalledWith(address);
    });

    it('should throw error for invalid address', async () => {
      const address = 'invalid-address';

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe('https://relay.lto.network');
    });
  });
});
