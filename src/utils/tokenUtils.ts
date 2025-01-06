import { get_encoding } from '@dqbd/tiktoken';

export async function estimateTokenCount(text: string): Promise<number> {
	const encoding = get_encoding('cl100k_base');
	try {
		const tokenCount = await Promise.resolve(encoding.encode(text).length);
		return tokenCount;
	} finally {
		encoding.free();
	}
}
