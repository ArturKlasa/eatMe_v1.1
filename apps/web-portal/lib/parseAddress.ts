export interface NominatimAddressDetails {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface ParsedLocationDetails {
  displayName: string;
  streetAddress: string;
  neighbourhood: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  countryName: string;
}

/**
 * Parses a Nominatim reverse-geocoding response into structured address fields.
 * @param displayName
 * @param address
 
 * @returns*/
export function parseNominatimAddress(
  displayName: string,
  address: NominatimAddressDetails
): ParsedLocationDetails {
  const streetParts: string[] = [];
  if (address.house_number) streetParts.push(address.house_number);
  if (address.road) streetParts.push(address.road);
  const streetAddress = streetParts.join(' ');

  const neighbourhood = address.neighbourhood ?? address.suburb ?? '';

  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state ??
    '';

  const state = address.state ?? '';

  const postalCode = address.postcode ?? '';

  const countryCode = (address.country_code ?? '').toUpperCase();

  const countryName = address.country ?? '';

  return {
    displayName,
    streetAddress,
    neighbourhood,
    city,
    state,
    postalCode,
    countryCode,
    countryName,
  };
}
