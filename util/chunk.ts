export const chunk = <T extends any>(array: T[], size: number): T[][] =>
	array.reduce((acc: T[][], _, i) => {
		if (i % size === 0) acc.push(array.slice(i, i + size));
		return acc;
	}, []);
