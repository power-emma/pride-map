export type Region = { id: number; name: string };

const ACTIVE_REGION_KEY = 'pride_map_active_region';

export function getStoredRegionId(): number | null {
  const value = Number(localStorage.getItem(ACTIVE_REGION_KEY));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function storeActiveRegionId(regionId: number) {
  localStorage.setItem(ACTIVE_REGION_KEY, String(regionId));
}
