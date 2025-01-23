export const memoize = <T extends (...args: any[]) => any>(fn: T) => {
	let cache: { [key: string]: ReturnType<T> } = {};
	return (...args: Parameters<T>): ReturnType<T> => {
		let n = args[0]; // just taking one argument here
		if (n in cache) {
			return cache[n];
		} else {
			let result = fn(...args);
			cache[n] = result;
			return result;
		}
	};
};
