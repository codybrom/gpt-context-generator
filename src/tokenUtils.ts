import { encode } from 'gpt-3-encoder';

export function estimateTokenCount(text: string): number {
	const encoded = encode(text);
	return encoded.length;
}
