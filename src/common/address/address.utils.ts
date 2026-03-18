import { isAddress } from 'ethers';

/**
 * EQTY Address and Network utilities
 */

const _BASE_CHAIN_ID = 8453; // Base Mainnet
const _BASE_SEPOLIA_CHAIN_ID = 84532; // Base Sepolia

export type NetworkId = 8453 | 84532; // Base Mainnet | Base Sepolia

/**
 * Validates if an address is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Gets the network ID from an Ethereum address
 * Base blockchain (mainnet: 8453, sepolia: 84532)
 */
export function getNetworkId(address: string, networkId?: number): NetworkId {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  if (networkId && isValidNetworkId(networkId)) {
    return networkId as NetworkId;
  }

  return 8453; // Base Mainnet
}

/**
 * Validates if a network ID is supported
 */
function isValidNetworkId(networkId: number): boolean {
  return networkId === 8453 || networkId === 84532;
}

/**
 * Gets the network name from network ID
 */
export function getNetworkName(networkId: NetworkId): string {
  switch (networkId) {
    case 8453:
      return 'base';
    case 84532:
      return 'base-sepolia';
    default:
      throw new Error(`Unsupported network ID: ${networkId}`);
  }
}

/**
 * Builds a standardized address (just validates and returns the address)
 */
export function buildAddress(address: string, _networkId?: NetworkId): string {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  // For Ethereum addresses, we just return the validated address
  return address.toLowerCase();
}

/**
 * Checks if an address is accepted for the given network
 */
export function isAcceptedAddress(address: string, acceptedAddresses?: string[]): boolean {
  if (!isValidAddress(address)) {
    return false;
  }

  if (!acceptedAddresses || acceptedAddresses.length === 0) {
    return true;
  }

  return acceptedAddresses.includes(address.toLowerCase());
}

/**
 * Extracts address from request path
 */
export function extractAddressFromPath(path: string): string | null {
  const match = path.match(/\/(0x[a-fA-F0-9]{40})(\/|$)/);
  return match ? match[1] : null;
}
