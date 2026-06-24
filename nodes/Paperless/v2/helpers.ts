// Accepts a comma-separated string ("3,5"), a single id, or an array of ids
// (e.g. what an AI agent might pass), and returns an array of numeric ids.
export function parseIds(value: unknown): number[] {
	if (value === undefined || value === null || value === '') return [];
	const parts = Array.isArray(value) ? value : String(value).split(',');
	return parts.map((p) => Number(String(p).trim())).filter((n) => !Number.isNaN(n));
}
