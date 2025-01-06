import { get_encoding } from '@dqbd/tiktoken';
import { join } from 'path';
import { ExtensionContext } from 'vscode';

let extensionContext: ExtensionContext;

export function initializeTokenUtils(context: ExtensionContext) {
	extensionContext = context;
}

export async function estimateTokenCount(text: string): Promise<number> {
	let encoding;
	try {
		// Try to set the WASM path if we have the context
		if (extensionContext) {
			const wasmPath = join(extensionContext.extensionPath, 'out');
			process.env.TIKTOKEN_CACHE_DIR = wasmPath;
		}

		encoding = get_encoding('cl100k_base');
		const tokenCount = encoding.encode(text).length;
		return tokenCount;
	} catch (error) {
		console.error('Error estimating token count:', error);
		// Return a fallback estimate (approximate tokens by word count)
		return Math.ceil(text.split(/\s+/).length * 1.3);
	} finally {
		if (encoding) {
			encoding.free();
		}
	}
}
