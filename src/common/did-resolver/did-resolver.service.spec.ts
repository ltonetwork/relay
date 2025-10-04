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
            getDidResolver: jest.fn(),
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
    it('should resolve valid address', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const url = 'https://example.com';
      const response = {
        status: 200,
        data: { '@context': 'https://www.w3.org/ns/did/v1', id: 'did:lto:3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM' },
      };

      jest.spyOn(configService, 'getDidResolver').mockReturnValue(url);
      jest.spyOn(requestService, 'get').mockResolvedValue(response as any);

      const result = await service.resolve(address);

      expect(result).toEqual(response.data);
      expect(configService.getDidResolver).toHaveBeenCalledWith('T');
      expect(requestService.get).toHaveBeenCalledWith(`${url}/${address}`);
    });

    it('should resolve valid address with array context', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const url = 'https://example.com';
      const response = {
        status: 200,
        data: {
          '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1',
            'https://w3id.org/security/suites/secp256k1-2019/v1',
          ],
          id: 'did:lto:3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM',
        },
      };

      jest.spyOn(configService, 'getDidResolver').mockReturnValue(url);
      jest.spyOn(requestService, 'get').mockResolvedValue(response as any);

      const result = await service.resolve(address);

      expect(result).toEqual(response.data);
      expect(configService.getDidResolver).toHaveBeenCalledWith('T');
      expect(requestService.get).toHaveBeenCalledWith(`${url}/${address}`);
    });

    it('should handle not found response', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const url = 'https://example.com';
      const response = { status: 404, data: { error: 'notFound' } };

      jest.spyOn(configService, 'getDidResolver').mockReturnValue(url);
      jest.spyOn(requestService, 'get').mockResolvedValue(response as any);

      const result = await service.resolve(address);

      expect(result).toBeNull();
      expect(configService.getDidResolver).toHaveBeenCalledWith('T');
      expect(requestService.get).toHaveBeenCalledWith(`${url}/${address}`);
    });

    it('should throw an error for invalid address', async () => {
      const address = 'in3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';

      const result = service.resolve(address);

      await expect(result).rejects.toThrow(`Invalid address ${address}`);
    });

    it('should throw an error for failed request', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const url = 'https://example.com';
      const response = { status: 500 };

      jest.spyOn(configService, 'getDidResolver').mockReturnValue(url);
      jest.spyOn(requestService, 'get').mockResolvedValue(response as any);

      const result = service.resolve(address);

      await expect(result).rejects.toThrow(`Failed to fetch DID document for ${address}`);
      expect(configService.getDidResolver).toHaveBeenCalledWith('T');
      expect(requestService.get).toHaveBeenCalledWith(`${url}/${address}`);
    });

    it('should throw an error for invalid DID document', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const url = 'https://example.com';
      const response = { status: 200, data: { '@context': 'invalidContext' } };

      jest.spyOn(configService, 'getDidResolver').mockReturnValue(url);
      jest.spyOn(requestService, 'get').mockResolvedValue(response as any);

      const result = service.resolve(address);

      await expect(result).rejects.toThrow(`Invalid DID document for ${address}`);
      expect(configService.getDidResolver).toHaveBeenCalledWith('T');
      expect(requestService.get).toHaveBeenCalledWith(`${url}/${address}`);
    });
  });

  describe('getServiceEndpoint', () => {
    it('should return default service endpoint if didDocument is null', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const defaultEndpoint = 'https://relay.lto.network';

      jest.spyOn(service, 'resolve').mockResolvedValue(null);

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe(defaultEndpoint);
      expect(service.resolve).toHaveBeenCalledWith(address);
    });

    it('should return service endpoint from didDocument', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const didDocument = {
        service: [
          { type: 'other-service', serviceEndpoint: 'https://other.example.com' },
          { type: 'lto-relay', serviceEndpoint: 'https://relay.example.com' },
        ],
      };

      jest.spyOn(service, 'resolve').mockResolvedValue(didDocument as DIDDocument);

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe(didDocument.service[1].serviceEndpoint);
      expect(service.resolve).toHaveBeenCalledWith(address);
    });

    it('should return default service endpoint if didDocument does not contain a matching service', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
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

    it('should return default service endpoint if didDocument is null and default endpoint is configured', async () => {
      const address = '3MsAuZ59xHHa5vmoPG45fBGC7PxLCYQZnbM';
      const defaultEndpoint = 'https://relay.lto.network';

      jest.spyOn(service, 'resolve').mockResolvedValue(null);

      const result = await service.getServiceEndpoint(address);

      expect(result).toBe(defaultEndpoint);
      expect(service.resolve).toHaveBeenCalledWith(address);
    });
  });
});
