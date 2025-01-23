type Range<
	N extends number,
	Result extends number[] = []
> = Result["length"] extends N
	? Result[number]
	: Range<N, [...Result, Result["length"]]>;

export type Byte = Range<256>;