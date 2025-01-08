import ignore, { Ignore } from 'ignore';
import {
	fileExists,
	readFileContent,
	getDirname,
	getRelativePath,
	resolvePath,
} from './fileUtils';
import { getConfig } from './vscodeUtils';
import {
	workspace,
	FileSystemWatcher,
	RelativePattern,
	Disposable,
} from 'vscode';

class IgnoreManager {
	private filters = new Map<string, Ignore>();
	private loadedPatterns = new Map<string, string[]>();
	private initializedWorkspace: string | null = null;
	private fileWatchers: FileSystemWatcher[] = [];
	private configWatcher: Disposable;

	constructor() {
		this.setupFileWatchers = this.setupFileWatchers.bind(this);
		this.configWatcher = this.setupConfigWatcher();
	}

	isInitialized(workspacePath: string): boolean {
		return this.initializedWorkspace === workspacePath;
	}

	private setupConfigWatcher(): Disposable {
		// Watch for changes to our extension's configuration
		return workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('gpt-context-generator.ignoreFiles')) {
				console.log('Ignore files configuration changed, reinitializing...');
				if (this.initializedWorkspace) {
					this.initialize(this.initializedWorkspace);
				}
			}
		});
	}

	private async setupRootIgnorePatterns(): Promise<void> {
		const ignoreFiles = getConfig().ignoreFiles;

		// Create a root filter with the configured ignore patterns
		const rootFilter = ignore();

		// Add patterns for the ignore files themselves - these are from the extension's config
		// [".gitignore", ".dockerignore", ".llmcontextignore", ".ignore", "*.ignore"]
		ignoreFiles.forEach((pattern) => {
			rootFilter.add(`**/${pattern}`);
		});

		// Store the root patterns
		this.filters.set('', rootFilter);
		this.loadedPatterns.set('', ignoreFiles);

		console.log('Set up root ignore patterns:', ignoreFiles);
	}

	private async setupFileWatchers(workspacePath: string): Promise<void> {
		// Dispose any existing watchers
		this.fileWatchers.forEach((watcher) => watcher.dispose());
		this.fileWatchers = [];

		// Create new watchers for each ignore file
		const ignoreFiles = getConfig().ignoreFiles;

		// Watch for any configured ignore files in the workspace
		for (const ignorePattern of ignoreFiles) {
			const watcher = workspace.createFileSystemWatcher(
				new RelativePattern(workspacePath, `**/${ignorePattern}`),
			);

			watcher.onDidChange((uri) => {
				console.log(`Ignore file changed: ${uri.fsPath}, reinitializing...`);
				this.initialize(this.initializedWorkspace!);
			});
			watcher.onDidCreate((uri) => {
				console.log(`Ignore file created: ${uri.fsPath}, reinitializing...`);
				this.initialize(this.initializedWorkspace!);
			});
			watcher.onDidDelete((uri) => {
				console.log(`Ignore file deleted: ${uri.fsPath}, reinitializing...`);
				this.initialize(this.initializedWorkspace!);
			});

			this.fileWatchers.push(watcher);
		}
	}

	private async findIgnoreFiles(): Promise<string[]> {
		if (!this.initializedWorkspace) {
			console.error('Workspace path not initialized');
			return [];
		}

		const workspacePath = this.initializedWorkspace; // capture for use in closure
		const results: string[] = [];
		const ignorePatterns = getConfig().ignoreFiles;

		// Get the root filter that we've already set up
		const rootFilter = this.filters.get('');
		if (!rootFilter) {
			console.error('Root ignore patterns not initialized');
			return results;
		}

		// Use VSCode workspace file search API for better performance
		for (const pattern of ignorePatterns) {
			try {
				const files = await workspace.findFiles(
					`**/${pattern}`,
					'{.git/**}',
					1000,
				);

				// Filter the results using our root patterns
				for (const file of files) {
					const relativePath = getRelativePath(workspacePath, file.fsPath);
					const shouldInclude = !rootFilter.ignores(relativePath);

					if (shouldInclude) {
						results.push(file.fsPath);
					} else {
						console.log(`Skipping ignored ignore file: ${relativePath}`);
					}
				}

				console.log(`Found ${pattern} files:`, results.length);
			} catch (error) {
				console.error(`Error finding ${pattern} files:`, error);
			}
		}

		// Sort by path length to ensure parent ignores are processed first
		return results.sort((a, b) => a.length - b.length);
	}

	async initialize(workspacePath: string): Promise<void> {
		console.log('Initializing ignore filters for workspace:', workspacePath);
		const ignoreFiles = getConfig().ignoreFiles;
		console.log('Looking for ignore files:', ignoreFiles);

		// Set the workspace path first
		this.initializedWorkspace = workspacePath;

		this.filters.clear();
		this.loadedPatterns.clear();

		// First set up root-level ignore patterns from config
		await this.setupRootIgnorePatterns();

		// Then process root-level ignore files before looking for others
		for (const pattern of ignoreFiles) {
			const rootIgnorePath = resolvePath(workspacePath, pattern);
			if (fileExists(rootIgnorePath)) {
				console.log(`Processing root ignore file: ${pattern}`);
				await this.processIgnoreFile(rootIgnorePath, '');
			}
		}

		// Setup watchers for the ignore files
		await this.setupFileWatchers(workspacePath);

		// Now find and process all other ignore files
		const foundIgnoreFiles = await this.findIgnoreFiles();
		console.log('Found additional ignore files:', foundIgnoreFiles);

		// Process each non-root ignore file
		for (const ignorePath of foundIgnoreFiles) {
			// Skip root ignore files as we've already processed them
			if (getDirname(getRelativePath(workspacePath, ignorePath)) !== '') {
				const relativeDir = getDirname(
					getRelativePath(workspacePath, ignorePath),
				);
				await this.processIgnoreFile(ignorePath, relativeDir);
			}
		}
	}

	private async processIgnoreFile(
		ignorePath: string,
		relativeDir: string,
	): Promise<void> {
		const filename = ignorePath.split(/[\\/]/).pop()!;
		console.log(`Processing ${filename} for directory: ${relativeDir}`);

		if (fileExists(ignorePath)) {
			const ignoreContent = readFileContent(ignorePath);
			const patterns = ignoreContent
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'))
				.map((pattern) => {
					// Remove leading slash if present
					if (pattern.startsWith('/')) {
						pattern = pattern.slice(1);
					}
					return pattern;
				});

			const filter = ignore();
			patterns.forEach((pattern) => filter.add(pattern));

			// Store patterns with their directory context
			this.filters.set(relativeDir, filter);
			this.loadedPatterns.set(relativeDir, patterns);

			console.log(
				`Loaded ${patterns.length} patterns from ${filename} for ${relativeDir || 'root'}:`,
				patterns,
			);
		} else {
			console.log(`Ignore file not found: ${filename}`);
		}
	}

	isIgnored(filePath: string): boolean {
		if (!filePath || filePath === '.') {
			return false;
		}

		// Normalize path
		const normalizedPath = filePath.split(/[\\/]/).filter(Boolean).join('/');
		const pathParts = normalizedPath.split('/');

		// Check root patterns first
		const rootFilter = this.filters.get('');
		if (rootFilter && rootFilter.ignores(normalizedPath)) {
			console.log(
				`File "${normalizedPath}" ignored by root patterns`,
				`(path: ${normalizedPath})`,
			);
			return true;
		}

		// Then check each directory level's patterns
		let currentPath = '';
		for (let i = 0; i < pathParts.length; i++) {
			currentPath = i === 0 ? pathParts[0] : `${currentPath}/${pathParts[i]}`;

			const filter = this.filters.get(currentPath);
			if (filter) {
				// Get the remaining path relative to this ignore file's location
				const remainingParts = pathParts.slice(i + 1);
				const relativeToFilter = remainingParts.join('/');

				if (filter.ignores(relativeToFilter)) {
					console.log(
						`File "${normalizedPath}" ignored by patterns in "${currentPath}"`,
						`(relative path: ${relativeToFilter})`,
					);
					return true;
				}
			}
		}

		return false;
	}

	dispose(): void {
		this.fileWatchers.forEach((watcher) => watcher.dispose());
		this.fileWatchers = [];
		if (this.configWatcher) {
			this.configWatcher.dispose();
		}
	}
}

// Create a singleton instance
const manager = new IgnoreManager();

export const initializeIgnoreFilter = (workspacePath: string) =>
	manager.initialize(workspacePath);
export const isIgnored = (filePath: string) => manager.isIgnored(filePath);
export const isInitialized = (workspacePath: string) =>
	manager.isInitialized(workspacePath);
export const dispose = () => manager.dispose();
