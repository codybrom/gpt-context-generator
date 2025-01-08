import {
	readFileContent,
	listFiles,
	isDirectory,
	fileExists,
	readPackageJson,
	getRelativePath,
	getExtension,
	resolvePath,
	getDirname,
	getBasename,
} from '../utils/fileUtils';
import { formatFileComment } from '../utils/markdownUtils';
import { estimateTokenCount } from '../utils/tokenUtils';
import { extractImports } from '../utils/importParser';
import { initializeIgnoreFilter, isIgnored } from '../utils/ignoreUtils';
import { getConfig, showMessage } from '../utils/vscodeUtils';
import { env, ViewColumn, window, workspace } from 'vscode';

export class ContextGenerator {
	private detectedFileExtensions: string[];
	private enforceFileTypes: boolean;

	constructor(private workspacePath: string) {
		if (!workspacePath) {
			throw new Error('Workspace path must be provided');
		}
		const config = getConfig();
		this.detectedFileExtensions = config.detectedFileExtensions;
		this.enforceFileTypes = config.enforceFileTypes;
		initializeIgnoreFilter(workspacePath);
	}

	async handleContextGeneration(
		options: ContextOptions & {
			outputMethod?: string;
			outputLanguage?: string;
		},
	): Promise<void> {
		try {
			const outputMethod = options.outputMethod || 'clipboard';
			const outputLanguage = options.outputLanguage || 'plaintext';

			const gptContext = await this.generateContext(options);

			if (gptContext.length === 0) {
				showMessage.warning('No files were found to include in the context.');
				return;
			}

			await this.handleOutput(gptContext, outputMethod, outputLanguage);
			await this.showTokenCount(gptContext);
		} catch (error) {
			console.error('Error in handleContextGeneration:', error);
			throw error;
		}
	}

	private async handleOutput(
		content: string,
		outputMethod: string,
		outputLanguage: string,
	): Promise<void> {
		console.log('handleOutput called:', {
			contentLength: content.length,
			outputMethod,
			outputLanguage,
		});

		try {
			if (outputMethod === 'newWindow') {
				const document = await workspace.openTextDocument({
					content,
					language: outputLanguage,
				});
				await window.showTextDocument(document, ViewColumn.One);
			} else if (outputMethod === 'clipboard') {
				await env.clipboard.writeText(content);
				window.showInformationMessage('LLM-ready context copied to clipboard.');
			}
		} catch (error) {
			console.error('Error in handleOutput:', error);
			throw error;
		}
	}

	private async showTokenCount(content: string): Promise<void> {
		const tokenCount = await estimateTokenCount(content);
		const threshold = getConfig().tokenWarningThreshold;

		const message = `The generated context is approximately ${tokenCount} tokens${
			tokenCount > threshold
				? `, which is greater than ${threshold} tokens`
				: ''
		}.`;

		if (tokenCount > threshold) {
			showMessage.warning(message);
		} else {
			showMessage.info(message);
		}
	}

	public async generateContext({
		openFilePath,
		markedFiles,
		includePackageJson = false,
	}: ContextOptions): Promise<string> {
		console.log('\n=== Starting context generation ===');
		const contextParts: string[] = [];

		try {
			if (markedFiles?.length) {
				console.log('Processing marked files');
				await this.processMarkedFiles(markedFiles, contextParts);
			} else if (openFilePath) {
				console.log('Processing open file');
				await this.processOpenFile(openFilePath, contextParts);
			} else {
				console.log('Processing entire workspace');
				await this.processDirectory(this.workspacePath, contextParts);
			}

			if (includePackageJson) {
				console.log('Adding package.json');
				await this.addPackageJson(contextParts);
			}

			console.log(
				`\nContext generation complete. Files processed: ${contextParts.length}`,
			);
			return contextParts.join('\n');
		} catch (error) {
			console.error('Error during context generation:', error);
			throw error;
		}
	}

	private createFileData(filePath: string, relPath: string): FileData {
		return {
			path: relPath,
			extension: getExtension(filePath),
			content: readFileContent(filePath),
		};
	}

	private async handleSingleFile(
		filePath: string,
		relPath: string,
		contextParts: string[],
	): Promise<void> {
		if (isIgnored(relPath)) {
			showMessage.warning(
				`Note: "${getBasename(filePath)}" matches patterns in your ignore files but will be included anyway since it was specifically selected.`,
			);
		}

		if (!isDirectory(filePath)) {
			await this.processFile(filePath, relPath, contextParts);
		}
	}

	private async processOpenFile(
		filePath: string,
		contextParts: string[],
	): Promise<void> {
		const relPath = getRelativePath(this.workspacePath, filePath);
		await this.handleSingleFile(filePath, relPath, contextParts);

		const content = readFileContent(filePath);
		await this.processImports(filePath, content, contextParts);
	}

	private async processImports(
		filePath: string,
		content: string,
		contextParts: string[],
	): Promise<void> {
		const imports = extractImports(content);
		for (const importPath of imports) {
			const resolvedPath = resolvePath(getDirname(filePath), importPath);
			const relPath = getRelativePath(this.workspacePath, resolvedPath);

			// For imports, we do respect ignore patterns
			if (isIgnored(relPath)) {
				continue;
			}

			const fileExtension = getExtension(resolvedPath);
			if (!fileExtension) {
				await this.tryProcessImportWithExtensions(resolvedPath, contextParts);
			} else if (
				this.detectedFileExtensions.includes(fileExtension) &&
				fileExists(resolvedPath)
			) {
				await this.processFile(resolvedPath, relPath, contextParts);
			}
		}
	}

	private async tryProcessImportWithExtensions(
		basePath: string,
		contextParts: string[],
	): Promise<void> {
		for (const ext of this.detectedFileExtensions) {
			const fullPath = `${basePath}.${ext}`;
			const relPath = getRelativePath(this.workspacePath, fullPath);

			if (fileExists(fullPath)) {
				await this.processFile(fullPath, relPath, contextParts);
				break;
			}
		}
	}

	private async processDirectory(
		dir: string,
		contextParts: string[],
	): Promise<void> {
		if (!dir) {
			console.log('Empty directory path provided');
			return;
		}

		// Get relative path for ignore checking
		const relPath = getRelativePath(this.workspacePath, dir);

		// Check if the directory itself should be ignored before processing
		if (isIgnored(relPath)) {
			console.log('Skipping ignored directory:', relPath);
			return;
		}

		console.log('\n--- Processing directory:', dir);

		try {
			const files = listFiles(dir);
			console.log(`Found ${files.length} files in directory`);

			for (const file of files) {
				if (!file) {
					continue; // Skip empty file names
				}

				try {
					const filePath = resolvePath(dir, file);
					const fileRelPath = getRelativePath(this.workspacePath, filePath);
					console.log('\nExamining:', fileRelPath);

					// Skip .git directory entirely
					if (file === '.git' || fileRelPath.startsWith('.git/')) {
						console.log('Skipping .git directory/file');
						continue;
					}

					// Check if file should be ignored
					if (isIgnored(fileRelPath)) {
						console.log('File is ignored by patterns:', fileRelPath);
						continue;
					}

					if (isDirectory(filePath)) {
						console.log('Processing subdirectory:', fileRelPath);
						await this.processDirectory(filePath, contextParts);
						continue;
					}

					// Check file extension
					const extension = getExtension(filePath);
					if (
						this.enforceFileTypes &&
						!this.detectedFileExtensions.includes(extension)
					) {
						console.log(`Skipping unsupported file type: ${extension}`);
						continue;
					}

					// Process the file
					console.log('Processing file:', fileRelPath);
					await this.processFile(filePath, fileRelPath, contextParts);
					console.log('Added to context:', fileRelPath);
				} catch (error) {
					console.error(`Error processing ${file}:`, error);
				}
			}
		} catch (error) {
			console.error(`Error processing directory ${dir}:`, error);
		}
	}

	private async processMarkedFiles(
		files: string[],
		contextParts: string[],
	): Promise<void> {
		// Special case for single marked file
		if (files.length === 1) {
			const filePath = files[0];
			const relPath = getRelativePath(this.workspacePath, filePath);
			await this.handleSingleFile(filePath, relPath, contextParts);
			return;
		}

		// For multiple files, trust the marking process's decisions
		for (const filePath of files) {
			const relPath = getRelativePath(this.workspacePath, filePath);
			if (!isDirectory(filePath)) {
				await this.processFile(filePath, relPath, contextParts);
			}
		}
	}

	private async processFile(
		filePath: string,
		relPath: string,
		contextParts: string[],
	): Promise<void> {
		const fileExtension = getExtension(filePath);
		try {
			if (
				!this.enforceFileTypes ||
				this.detectedFileExtensions.includes(fileExtension)
			) {
				const fileData = this.createFileData(filePath, relPath);
				contextParts.push(`${formatFileComment(fileData)}\n\n`);
				console.log('Successfully added to context:', relPath);
			} else {
				console.log('Skipping file due to extension:', relPath);
			}
		} catch (error) {
			console.error(`Error processing file ${relPath}:`, error);
		}
	}

	private async addPackageJson(contextParts: string[]): Promise<void> {
		const content = readPackageJson(this.workspacePath);
		if (content) {
			const fileData: FileData = {
				path: 'package.json',
				extension: 'json',
				content,
			};
			contextParts.push(`${formatFileComment(fileData)}\n\n`);
		}
	}
}

export const createContextGenerator = (
	workspacePath: string,
): ContextGenerator => new ContextGenerator(workspacePath);
