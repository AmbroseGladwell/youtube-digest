// Only the shape a person can get wrong while typing: the server is what decides.
export const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
