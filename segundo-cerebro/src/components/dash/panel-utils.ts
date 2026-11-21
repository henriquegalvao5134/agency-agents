// Small helpers shared across dash panels. Split out of Panel.tsx: a file
// that exports a component alongside plain functions trips Fast Refresh
// (react-refresh/only-export-components), since Vite can no longer tell
// which export to hot-swap.
export const fx = (c: string) => `var(--fx-${c})`;
export function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
