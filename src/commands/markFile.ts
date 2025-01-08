import { TreeItem, Uri } from 'vscode';
import { markedFiles } from '../providers/markedFilesProvider';
import type { MarkedFilesProvider } from '../providers/markedFilesProvider';
import {
	getActiveFilePath,
	getConfig,
	showMessage,
	validateWorkspace,
} from '../utils/vscodeUtils';
import {
	getBasename,
	getDirname,
	getExtension,
	getRelativePath,
	isDirectory,
	listFiles,
	resolvePath,
} from '../utils/fileUtils';
import { initializeIgnoreFilter, isIgnored } from '../utils/ignoreUtils';

export const markFile = {
	async updateMarkedFiles(
		action: () => void,
		message: string,
		markedFilesProvider: MarkedFilesProvider,
	): Promise<void> {
		action();
		showMessage.info(message);
		await markedFilesProvider.refresh();
	},

	unmarkFile(filePath: string, markedFilesProvider: MarkedFilesProvider) {
		this.updateMarkedFiles(
			() => markedFiles.delete(filePath),
			`Unmarked: ${getBasename(filePath)}`,
			markedFilesProvider,
		);
	},

	isFileTypeSupported(filePath: string): boolean {
		const extension = getExtension(filePath);
		const config = getConfig();
		// Only check against supported extensions if enforceFileTypes is enabled
		return (
			!config.enforceFileTypes ||
			config.detectedFileExtensions.includes(extension)
		);
	},

	async toggleMark(markedFilesProvider: MarkedFilesProvider) {
		const filePath = getActiveFilePath();
		if (!filePath) {
			return;
		}

		const workspacePath = validateWorkspace();
		if (!workspacePath) {
			showMessage.error(
				'No workspace folder found\nPlease open a workspace or folder to use this feature',
			);
			return;
		}

		if (markedFiles.has(filePath)) {
			this.unmarkFile(filePath, markedFilesProvider);
		} else {
			await this.handleSingleFile(filePath, workspacePath, markedFilesProvider);
		}
	},

	async handleSingleFile(
		filePath: string,
		workspacePath: string,
		markedFilesProvider: MarkedFilesProvider,
	): Promise<boolean> {
		const relPath = getRelativePath(workspacePath, filePath);

		if (isIgnored(relPath)) {
			showMessage.warning(
				`Note: "${getBasename(filePath)}" matches patterns in your ignore files but will be marked anyway since it was specifically selected.`,
			);
		}

		if (!this.isFileTypeSupported(filePath)) {
			showMessage.warning(
				`Cannot mark "${getBasename(filePath)}": Unsupported file type (.${getExtension(filePath)})\nSupported types: ${getConfig().detectedFileExtensions.join(', ')}\nYou can add more file types in Settings > LLM Context Generator > Detected File Extensions`,
			);
			return false;
		}

		if (!markedFiles.has(filePath)) {
			this.updateMarkedFiles(
				() => markedFiles.add(filePath),
				`Marked: ${getBasename(filePath)}`,
				markedFilesProvider,
			);
		} else {
			showMessage.info('Selected file is already marked.');
		}
		return true;
	},

	async unmarkFromTreeView(
		treeItem: TreeItem,
		markedFilesProvider: MarkedFilesProvider,
	) {
		if (!treeItem?.resourceUri?.fsPath) {
			showMessage.error(
				'Unable to unmark file\nThe selected item is not a valid file or is no longer available',
			);
			return;
		}

		const filePath = treeItem.resourceUri.fsPath;
		if (markedFiles.has(filePath)) {
			this.unmarkFile(filePath, markedFilesProvider);
		}
	},

	async markItems(uris: Uri[], markedFilesProvider: MarkedFilesProvider) {
		const workspacePath = validateWorkspace();
		if (!workspacePath) {
			return;
		}

		// Make sure ignore patterns are loaded for this workspace
		initializeIgnoreFilter(workspacePath);

		// Single file case - allow ignored files with warning
		if (uris.length === 1 && !isDirectory(uris[0].fsPath)) {
			await this.handleSingleFile(
				uris[0].fsPath,
				workspacePath,
				markedFilesProvider,
			);
			return;
		}

		initializeIgnoreFilter(workspacePath);

		console.log(`Processing ${uris.length} files as batch`);

		// For multiple files, we need to check each one first
		const ignoredFiles = new Set<string>();
		const unsupportedFiles = new Set<string>();
		const filesToAdd = new Set<string>();
		const alreadyMarked = new Set<string>();

		// Check all files first to collect what should be ignored/unsupported
		for (const uri of uris) {
			const filePath = uri.fsPath;
			const relPath = getRelativePath(workspacePath, filePath);

			console.log(`Checking file: ${filePath}`);
			console.log(`Relative path: ${relPath}`);
			console.log(`Is ignored: ${isIgnored(relPath)}`);

			// Check ignore status first for ALL files, even if they're directories
			if (isIgnored(relPath)) {
				console.log(`Adding to ignored files: ${filePath}`);
				ignoredFiles.add(filePath);
				continue;
			}

			if (!isDirectory(filePath)) {
				if (!this.isFileTypeSupported(filePath)) {
					unsupportedFiles.add(filePath);
					continue;
				}
				if (markedFiles.has(filePath)) {
					alreadyMarked.add(filePath);
					continue;
				}
				console.log(`Adding to files to add: ${filePath}`);
				filesToAdd.add(filePath);
			} else {
				await this.processPath(
					filePath,
					filesToAdd,
					ignoredFiles,
					unsupportedFiles,
					alreadyMarked,
					workspacePath,
				);
			}
		}

		// Show warnings for ignored files
		if (ignoredFiles.size > 0) {
			const ignoreFiles = getConfig().ignoreFiles;
			showMessage.warning(
				`Skipped ${ignoredFiles.size} file(s) matching patterns in ignore files (${ignoreFiles.join(', ')}):\n${Array.from(
					ignoredFiles,
				)
					.map((file) => `• ${getBasename(file)} (${getDirname(file)})`)
					.join('\n')}`,
			);
		}

		if (unsupportedFiles.size > 0) {
			showMessage.warning(
				`Skipped ${unsupportedFiles.size} unsupported file(s):\n${Array.from(
					unsupportedFiles,
				)
					.map((file) => `• ${getBasename(file)} (.${getExtension(file)})`)
					.join(
						'\n',
					)}\nYou can add file types in Settings > LLM Context Generator > Detected File Extensions`,
			);
		}

		// Only proceed if we have valid files to add
		if (filesToAdd.size === 0) {
			if (
				alreadyMarked.size > 0 &&
				ignoredFiles.size === 0 &&
				unsupportedFiles.size === 0
			) {
				showMessage.info('Selected items are already marked.');
			}
			return;
		}

		// Now we can safely add only the valid files
		this.updateMarkedFiles(
			() => filesToAdd.forEach((fsPath) => markedFiles.add(fsPath)),
			`Marked ${filesToAdd.size} file(s)`,
			markedFilesProvider,
		);
	},

	async processPath(
		path: string,
		filesToAdd: Set<string>,
		ignoredFiles: Set<string>,
		unsupportedFiles: Set<string>,
		alreadyMarked: Set<string>,
		workspacePath: string,
	): Promise<void> {
		const relPath = getRelativePath(workspacePath, path);

		// Check ignore status first, before anything else
		if (isIgnored(relPath)) {
			ignoredFiles.add(path);
			return;
		}

		if (!isDirectory(path)) {
			if (!this.isFileTypeSupported(path)) {
				unsupportedFiles.add(path);
				return;
			}
			if (markedFiles.has(path)) {
				alreadyMarked.add(path);
				return;
			}
			filesToAdd.add(path);
			return;
		}

		try {
			const files = listFiles(path);
			for (const file of files) {
				const filePath = resolvePath(path, file);
				await this.processPath(
					filePath,
					filesToAdd,
					ignoredFiles,
					unsupportedFiles,
					alreadyMarked,
					workspacePath,
				);
			}
		} catch (error) {
			console.error(`Error processing directory ${path}:`, error);
			showMessage.error(
				`Failed to process directory "${getBasename(path)}"\n${error instanceof Error ? error.message : 'Unknown error'}\nPlease check folder permissions and try again`,
			);
		}
	},
};
