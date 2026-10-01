const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;
const IPV6_PREFIX = /^([0-9a-f]{1,4}(?::[0-9a-f]{1,4}){3})::\/64$/;

// Enough of the caller's address to place them in a country, and no more: the last octet of
// IPv4 and everything past the /64 of IPv6 go (docs/architecture/analytics.md, "Location").
export function geoAddress(clientAddress: string): string | null {
  const v4 = IPV4.exec(clientAddress);
  if (v4 !== null) return `${v4[1]}.${v4[2]}.${v4[3]}.0`;
  const v6 = IPV6_PREFIX.exec(clientAddress);
  if (v6 !== null) return `${v6[1]}::`;
  return null;
}
