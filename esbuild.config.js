require('esbuild')
	.build({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		outdir: 'out',
		platform: 'node',
		format: 'cjs',
		sourcemap: true,
		external: ['vscode'],
	})
	.catch(() => process.exit(1));
