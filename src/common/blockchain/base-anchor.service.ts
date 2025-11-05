import { Injectable } from '@nestjs/common';
import { Contract, JsonRpcProvider } from 'ethers';
// Dynamic import for eqty-core ES module
let AnchorClient: any;
let Binary: any;
let BASE_CHAIN_ID: number;
let BASE_SEPOLIA_CHAIN_ID: number;
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';
import Redis from 'ioredis';

export interface AnchorVerificationResult {
  isAnchored: boolean;
  blockNumber?: number;
  transactionHash?: string;
  error?: string;
}

@Injectable()
export class BaseAnchorService {
  private anchorClients: Map<number, any> = new Map();
  private providers: Map<number, JsonRpcProvider> = new Map();
  private verificationCache: Map<string, { result: AnchorVerificationResult; timestamp: number }> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly redis?: Redis,
  ) {
    this.initializeEqtyCore();
  }

  /**
   * Initialize eqty-core imports
   */
  private async initializeEqtyCore(): Promise<void> {
    // Use dynamic import for ES module
    const importFn = new Function('specifier', 'return import(specifier)');
    const eqtyCore = await importFn('eqty-core');
    AnchorClient = eqtyCore.AnchorClient;
    Binary = eqtyCore.Binary;
    BASE_CHAIN_ID = eqtyCore.BASE_CHAIN_ID;
    BASE_SEPOLIA_CHAIN_ID = eqtyCore.BASE_SEPOLIA_CHAIN_ID;

    this.initializeAnchorClients();
  }

  /**
   * Initialize anchor clients for different networks
   */
  private async initializeAnchorClients(): Promise<void> {
    try {
      // Base Mainnet
      const baseRpcUrl = this.config.getBaseRpcUrl('mainnet');
      const baseProvider = new JsonRpcProvider(baseRpcUrl);
      const baseContractAddress = AnchorClient.contractAddress(BASE_CHAIN_ID);
      const baseContract = new Contract(baseContractAddress, AnchorClient.ABI, baseProvider);

      this.providers.set(BASE_CHAIN_ID, baseProvider);
      this.anchorClients.set(BASE_CHAIN_ID, new AnchorClient(baseContract));

      this.logger.debug(`Initialized Base Mainnet anchor client at ${baseContractAddress}`);

      // Base Sepolia Testnet
      const sepoliaRpcUrl = this.config.getBaseRpcUrl('sepolia');
      const sepoliaProvider = new JsonRpcProvider(sepoliaRpcUrl);
      const sepoliaContractAddress = AnchorClient.contractAddress(BASE_SEPOLIA_CHAIN_ID);
      const sepoliaContract = new Contract(sepoliaContractAddress, AnchorClient.ABI, sepoliaProvider);

      this.providers.set(BASE_SEPOLIA_CHAIN_ID, sepoliaProvider);
      this.anchorClients.set(BASE_SEPOLIA_CHAIN_ID, new AnchorClient(sepoliaContract));

      this.logger.debug(`Initialized Base Sepolia anchor client at ${sepoliaContractAddress}`);
    } catch (error) {
      this.logger.error('Failed to initialize anchor clients:', error);
      throw error;
    }
  }

  /**
   * Verifies if a hash is anchored on Base blockchain by querying events
   */
  async verifyAnchor(networkId: number, hash: any | string): Promise<AnchorVerificationResult> {
    // Validate input parameters
    if (!hash) {
      return { isAnchored: false, error: 'Hash parameter is required' };
    }

    if (typeof hash === 'string') {
      if (!hash.startsWith('0x') || hash.length !== 66) {
        return { isAnchored: false, error: 'Invalid hash format - must be 0x-prefixed 64-character hex string' };
      }
      if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return { isAnchored: false, error: 'Zero hash is not valid for anchor verification' };
      }
    }

    if (!this.isNetworkSupported(networkId)) {
      return { isAnchored: false, error: `Unsupported network ID: ${networkId}` };
    }

    const hashBinary = typeof hash === 'string' ? Binary.fromHex(hash) : hash;
    const hashHex = hashBinary.hex;
    const cacheKey = `${networkId}:${hashHex}`;

    // Check cache first
    const cached = await this.getCachedResult(cacheKey);
    if (cached) {
      this.logger.debug(`Anchor verification cache hit for ${hashHex}`);
      return cached;
    }

    try {
      const provider = this.providers.get(networkId);
      if (!provider) {
        const error = `No provider available for network ${networkId}`;
        this.logger.error(error);
        return { isAnchored: false, error };
      }

      const contractAddress = AnchorClient.contractAddress(networkId);
      const contract = new Contract(contractAddress, AnchorClient.ABI, provider);

      this.logger.debug(`Querying anchor events for hash ${hashHex} on network ${networkId}`);

      const filter = contract.filters.Anchored(hashHex);
      const events = await this.queryWithRetry(() => contract.queryFilter(filter));

      if (events.length === 0) {
        const result = {
          isAnchored: false,
          error: `Hash ${hashHex} not found in anchor events`,
        };

        // Cache negative results
        await this.setCachedResult(cacheKey, result);

        this.logger.debug(`Hash ${hashHex} not found in anchor events`);
        return result;
      }

      const latestEvent = events[events.length - 1];
      const result = {
        isAnchored: true,
        blockNumber: latestEvent.blockNumber,
        transactionHash: latestEvent.transactionHash,
      };

      await this.setCachedResult(cacheKey, result);

      this.logger.debug(`Hash ${hashHex} found in anchor events at block ${latestEvent.blockNumber}`);
      return result;
    } catch (error: any) {
      const result = {
        isAnchored: false,
        error: `Anchor verification failed: ${error.message}`,
      };

      this.logger.error(`Anchor verification failed for ${hashHex}:`, error);
      return result;
    }
  }

  /**
   * Query blockchain with retry logic
   */
  private async queryWithRetry<T>(queryFn: () => Promise<T>): Promise<T> {
    const maxRetries = this.config.getAnchorVerificationMaxRetries();
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Blockchain query attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Gets the anchor contract address for a given network
   */
  getAnchorContractAddress(networkId: number): string {
    return AnchorClient.contractAddress(networkId);
  }

  /**
   * Gets the maximum number of anchors allowed per transaction
   */
  async getMaxAnchors(networkId: number): Promise<number> {
    try {
      const anchorClient = this.anchorClients.get(networkId);
      if (!anchorClient) {
        throw new Error(`No anchor client available for network ${networkId}`);
      }
      return await anchorClient.getMaxAnchors();
    } catch (error) {
      this.logger.error(`Failed to get max anchors for network ${networkId}`, error);
      return 100; // Default fallback
    }
  }

  /**
   * Checks if a network is supported
   */
  isNetworkSupported(networkId: number): boolean {
    return this.anchorClients.has(networkId);
  }

  /**
   * Gets supported networks
   */
  getSupportedNetworks(): number[] {
    return Array.from(this.anchorClients.keys());
  }

  /**
   * Verify multiple hashes in a single batch query
   */
  async verifyAnchorsBatch(
    networkId: number,
    hashes: (any | string)[],
  ): Promise<Map<string, AnchorVerificationResult>> {
    const results = new Map<string, AnchorVerificationResult>();

    // Validate input parameters
    if (!hashes || hashes.length === 0) {
      return results; // Return empty map for empty input
    }

    if (hashes.length > 100) {
      // Prevent excessive batch sizes that could cause performance issues
      for (const hash of hashes) {
        const hashHex = typeof hash === 'string' ? hash : hash.hex;
        results.set(hashHex, {
          isAnchored: false,
          error: 'Batch size too large - maximum 100 hashes per batch',
        });
      }
      return results;
    }

    if (!this.isNetworkSupported(networkId)) {
      const error = `Unsupported network ID: ${networkId}`;
      for (const hash of hashes) {
        const hashHex = typeof hash === 'string' ? hash : hash.hex;
        results.set(hashHex, { isAnchored: false, error });
      }
      return results;
    }

    try {
      const provider = this.providers.get(networkId);
      if (!provider) {
        const error = `No provider available for network ${networkId}`;
        for (const hash of hashes) {
          const hashHex = typeof hash === 'string' ? hash : hash.hex;
          results.set(hashHex, { isAnchored: false, error });
        }
        return results;
      }

      const contractAddress = AnchorClient.contractAddress(networkId);
      const contract = new Contract(contractAddress, AnchorClient.ABI, provider);

      this.logger.debug(`Batch verifying ${hashes.length} hashes on network ${networkId}`);

      // Query all Anchored events at once
      const filter = contract.filters.Anchored();
      const allEvents = await this.queryWithRetry(() => contract.queryFilter(filter));

      // Group events by hash
      const eventsByHash = new Map<string, any[]>();
      for (const event of allEvents) {
        if ('args' in event && event.args) {
          const hash = event.args.key;
          if (!eventsByHash.has(hash)) {
            eventsByHash.set(hash, []);
          }
          const hashEvents = eventsByHash.get(hash);
          if (hashEvents) {
            hashEvents.push(event);
          }
        }
      }

      // Check each requested hash
      for (const hash of hashes) {
        try {
          const hashHex = typeof hash === 'string' ? hash : hash.hex;

          // Validate individual hash format
          if (typeof hash === 'string' && (!hash.startsWith('0x') || hash.length !== 66)) {
            results.set(hashHex, {
              isAnchored: false,
              error: 'Invalid hash format - must be 0x-prefixed 64-character hex string',
            });
            continue;
          }

          const events = eventsByHash.get(hashHex);

          if (!events || events.length === 0) {
            results.set(hashHex, {
              isAnchored: false,
              error: `Hash ${hashHex} not found in anchor events`,
            });
          } else {
            const latestEvent = events[events.length - 1];
            results.set(hashHex, {
              isAnchored: true,
              blockNumber: latestEvent.blockNumber,
              transactionHash: latestEvent.transactionHash,
            });
          }
        } catch (hashError: any) {
          const hashHex = typeof hash === 'string' ? hash : hash.hex;
          results.set(hashHex, {
            isAnchored: false,
            error: `Error processing hash ${hashHex}: ${hashError.message}`,
          });
        }
      }

      this.logger.debug(`Batch verification completed for ${hashes.length} hashes`);
      return results;
    } catch (error: any) {
      this.logger.error(`Batch verification failed:`, error);
      // Return error for all hashes
      for (const hash of hashes) {
        const hashHex = typeof hash === 'string' ? hash : hash.hex;
        results.set(hashHex, {
          isAnchored: false,
          error: `Batch verification failed: ${error.message}`,
        });
      }
      return results;
    }
  }

  /**
   * Clear the verification cache
   */
  clearCache(): void {
    this.verificationCache.clear();
    this.logger.debug('Anchor verification cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.verificationCache.size,
      entries: Array.from(this.verificationCache.keys()),
    };
  }

  /**
   * Get cached result from Redis or in-memory cache
   */
  private async getCachedResult(cacheKey: string): Promise<AnchorVerificationResult | null> {
    if (this.config.getAnchorVerificationUseRedisCache() && this.redis) {
      try {
        const cached = await this.redis.get(`anchor_verification:${cacheKey}`);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        this.logger.warn(`Failed to get cached result from Redis: ${error.message}`);
      }
    }

    // Fallback to in-memory cache
    const cached = this.verificationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.getAnchorVerificationCacheTtl()) {
      return cached.result;
    }

    return null;
  }

  /**
   * Set cached result in Redis or in-memory cache
   */
  private async setCachedResult(cacheKey: string, result: AnchorVerificationResult): Promise<void> {
    if (this.config.getAnchorVerificationUseRedisCache() && this.redis) {
      try {
        const ttlSeconds = Math.floor(this.config.getAnchorVerificationCacheTtl() / 1000);
        await this.redis.setex(`anchor_verification:${cacheKey}`, ttlSeconds, JSON.stringify(result));
        return;
      } catch (error) {
        this.logger.warn(`Failed to cache result in Redis: ${error.message}`);
      }
    }

    // Fallback to in-memory cache
    this.verificationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }
}
