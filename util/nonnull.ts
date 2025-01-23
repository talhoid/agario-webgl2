export const nonnull: <T extends any>(value: T | null | undefined) => T = (value) => {
	if (value === null || value === undefined) throw "";
	return value;
};
