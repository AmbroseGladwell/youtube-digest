const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

// An IPv6 client usually holds a whole /64, so the /64 is what is counted
// (docs/architecture/api.md, "Rate limits").
export function addressKey(address: string): string {
  const bare = address.trim().toLowerCase().replace(/%.*$/, "");
  const mapped = IPV4_MAPPED.exec(bare);
  if (mapped !== null) {
    return mapped[1]!;
  }
  if (!bare.includes(":")) {
    return bare;
  }
  const [head = "", tail] = bare.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === undefined || tail === "" ? [] : tail.split(":");
  const zeros = Array.from({ length: Math.max(0, 8 - headGroups.length - tailGroups.length) }, () => "0");
  const groups = tail === undefined ? headGroups : [...headGroups, ...zeros, ...tailGroups];
  const prefix = groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, ""));
  return `${prefix.join(":")}::/64`;
}
