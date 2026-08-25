// Canonical ID mapper utility
// Maps database IDs to short, monospaced canonical strings

export function getCanonicalId(type, id) {
  if (id === undefined || id === null) return '';
  
  const strId = String(id);
  // Simple deterministic hash function to produce a positive 32-bit integer
  let hash = 0;
  for (let i = 0; i < strId.length; i++) {
    const char = strId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash);
  
  // Mix in a salt based on the type to prevent collision across tables (e.g. user 1 vs company 1)
  const typeSalt = type.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const combined = (positiveHash + typeSalt * 1337) % 1000000;
  
  // Convert to base36, uppercase, and pad to 5 characters
  const tag = combined.toString(36).toUpperCase().padStart(5, '0');
  
  const prefixMap = {
    candidate: 'CND',
    employee: 'EMP',
    admin: 'ADM',
    enrollment: 'ENR',
    submission: 'SUB',
    challenge: 'CHL'
  };
  
  const prefix = prefixMap[type] || 'ID';
  return `${prefix}-${tag}`;
}
