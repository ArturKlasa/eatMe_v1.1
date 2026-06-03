// tz-lookup ships no type declarations. It's a CJS module whose single export
// is the lookup function: tzlookup(lat, lon) -> IANA zone id (throws on
// out-of-range input).
declare module 'tz-lookup' {
  export default function tzlookup(lat: number, lon: number): string;
}
