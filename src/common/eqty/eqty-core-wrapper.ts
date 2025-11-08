/**
 * Wrapper for eqty-core to handle ES module imports in CommonJS environment
 */

let eqtyCore: any = null;

export async function getEqtyCore() {
  if (!eqtyCore) {
    eqtyCore = await import('eqty-core');
  }
  return eqtyCore;
}

export async function getMessage() {
  const core = await getEqtyCore();
  return core.Message;
}

export async function getBinary() {
  const core = await getEqtyCore();
  return core.Binary;
}

export async function getAnchorClient() {
  const core = await getEqtyCore();
  return core.AnchorClient;
}

export async function getConstants() {
  const core = await getEqtyCore();
  return {
    BASE_CHAIN_ID: core.BASE_CHAIN_ID,
    BASE_SEPOLIA_CHAIN_ID: core.BASE_SEPOLIA_CHAIN_ID,
  };
}
