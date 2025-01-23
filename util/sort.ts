function getBit(num: number, pos: number): number {
    return (num >> pos) & 1;
}

function getMaxBits(arr: number[]): number {
    let max = 0;
    for (let num of arr) {
        max = Math.max(max, num);
    }
    return Math.floor(Math.log2(max)) + 1;
}

export function binaryRadixSort<T>(
    arr: T[], 
    getKey: (item: T) => number = (x: any) => x
): T[] {
    if (arr.length <= 1) return arr;

    const len = arr.length;
    const maxBits = getMaxBits(arr.map(getKey));
    const temp = new Array(len);

    // For each bit position
    for (let bit = 0; bit < maxBits; bit++) {
        let zeros = 0;
        
        // Count numbers with 0 at current bit
        for (let i = 0; i < len; i++) {
            if (getBit(getKey(arr[i]), bit) === 0) {
                zeros++;
            }
        }

        // Build output array
        let idxZero = 0;
        let idxOne = zeros;

        for (let i = 0; i < len; i++) {
            const item = arr[i];
            if (getBit(getKey(item), bit) === 0) {
                temp[idxZero++] = item;
            } else {
                temp[idxOne++] = item;
            }
        }

        // Copy back to original array
        for (let i = 0; i < len; i++) {
            arr[i] = temp[i];
        }
    }

    return arr;
}