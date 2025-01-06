import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const sourceWasmPath = join(
	__dirname,
	'../../node_modules/@dqbd/tiktoken/tiktoken_bg.wasm',
);
const targetWasmPath = join(__dirname, '../../out/tiktoken_bg.wasm');

// Ensure the output directory exists
mkdirSync(dirname(targetWasmPath), { recursive: true });

try {
	copyFileSync(sourceWasmPath, targetWasmPath);
	console.log('Successfully copied tiktoken_bg.wasm to output directory');
} catch (error) {
	console.error('Failed to copy tiktoken_bg.wasm:', error);
	process.exit(1);
}
