import ignore, { Ignore } from 'ignore';
import { fileExists, readFileContent, resolvePath } from './fileUtils';
import { getConfig } from './vscodeUtils';
import { workspace, FileSystemWatcher, RelativePattern } from 'vscode';

class IgnoreManager {
	private filter: Ignore;
	private loadedPatterns: string[] = [];
	private initializedWorkspace: string | null = null;
	private fileWatchers: FileSystemWatcher[] = [];

	constructor() {
		this.filter = ignore();
		this.setupConfigWatcher();
	}

	private setupConfigWatcher() {
		// Watch for changes to our extension's configuration
		workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('gpt-context-generator.ignoreFiles')) {
				console.log('Ignore files configuration changed, reinitializing...');
				this.reinitialize();
			}
		});
	}

	private setupFileWatchers(workspacePath: string) {
		// Dispose any existing watchers
		this.fileWatchers.forEach((watcher) => watcher.dispose());
		this.fileWatchers = [];

		// Create new watchers for each ignore file
		const ignoreFiles = getConfig().ignoreFiles;
		ignoreFiles.forEach((ignoreFile) => {
			const watcher = workspace.createFileSystemWatcher(
				new RelativePattern(workspacePath, ignoreFile),
			);

			watcher.onDidChange(() => {
				console.log(`Ignore file changed: ${ignoreFile}, reinitializing...`);
				this.reinitialize();
			});
			watcher.onDidCreate(() => {
				console.log(`Ignore file created: ${ignoreFile}, reinitializing...`);
				this.reinitialize();
			});
			watcher.onDidDelete(() => {
				console.log(`Ignore file deleted: ${ignoreFile}, reinitializing...`);
				this.reinitialize();
			});

			this.fileWatchers.push(watcher);
		});
	}

	private reinitialize() {
		if (this.initializedWorkspace) {
			this.initialize(this.initializedWorkspace);
		}
	}

	initialize(workspacePath: string): void {
		console.log('Initializing ignore filter for workspace:', workspacePath);
		console.log('Looking for ignore files:', getConfig().ignoreFiles);

		this.filter = ignore();
		this.loadedPatterns = [];

		// Setup watchers for the ignore files
		this.setupFileWatchers(workspacePath);

		// Process each ignore file
		const ignoreFiles = getConfig().ignoreFiles;
		for (const ignoreFile of ignoreFiles) {
			const ignorePath = resolvePath(workspacePath, ignoreFile);
			console.log('Checking for ignore file at:', ignorePath);

			const ignoreContent = fileExists(ignorePath)
				? readFileContent(ignorePath)
				: null;

			if (ignoreContent) {
				console.log('Found ignore file:', ignoreFile);
				const patterns = ignoreContent
					.split('\n')
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith('#'));

				console.log('Loaded patterns from', ignoreFile + ':', patterns);

				for (const pattern of patterns) {
					this.filter.add(pattern);
					this.loadedPatterns.push(pattern);
				}
			} else {
				console.log('Ignore file not found:', ignoreFile);
			}
		}

		this.initializedWorkspace = workspacePath;
	}

	isIgnored(filePath: string): boolean {
		const normalizedPath = filePath.split(/[\\/]/).filter(Boolean).join('/');

		console.log('Original path:', filePath);
		console.log('Normalized path:', normalizedPath);
		console.log('Loaded patterns:', this.loadedPatterns);

		const result = this.filter.ignores(normalizedPath);
		console.log('Ignore result:', result);

		return result;
	}

	dispose() {
		this.fileWatchers.forEach((watcher) => watcher.dispose());
		this.fileWatchers = [];
	}
}

// Create a singleton instance
const manager = new IgnoreManager();

export const initializeIgnoreFilter = (workspacePath: string) =>
	manager.initialize(workspacePath);
export const isIgnored = (filePath: string) => manager.isIgnored(filePath);
export const dispose = () => manager.dispose();
