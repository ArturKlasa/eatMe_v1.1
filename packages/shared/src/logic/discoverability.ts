import type { RestaurantStatus } from '../types/restaurant';

export function isDiscoverable(r: { is_active: boolean; status: RestaurantStatus }): boolean {
  return r.is_active && r.status === 'published';
}
