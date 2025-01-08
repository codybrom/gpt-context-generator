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
		const config = getConfig();
		this.detectedFileExtensions = config.detectedFileExtensions;
		this.enforceFileTypes = config.enforceFileTypes;
		initializeIgnoreFilter(workspacePath);
	}

	async handleContextGeneration(options: ContextOptions): Promise<void> {
		const { outputMethod, outputLanguage } = getConfig();
		const gptContext = await this.generateContext(options);
		await this.handleOutput(gptContext, outputMethod, outputLanguage);
		this.showTokenCount(gptContext);
	}

	private async handleOutput(
		content: string,
		outputMethod: string,
		outputLanguage: string,
	): Promise<void> {
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
	}

	private async showTokenCount(content: string): Promise<void> {
		const tokenCount = await estimateTokenCount(content);
		const message = `The generated context is approximately ${tokenCount} tokens${
			tokenCount > 8000 ? ', which is greater than 8000 tokens' : ''
		}.`;

		if (tokenCount > 8000) {
			showMessage.warning(message);
		} else {
			showMessage.info(message);
		}
	}

	private async generateContext({
		openFilePath,
		markedFiles,
		includePackageJson = false,
	}: ContextOptions): Promise<string> {
		const contextParts: string[] = [];

		if (markedFiles?.length) {
			await this.processMarkedFiles(markedFiles, contextParts);
		} else if (openFilePath) {
			await this.processOpenFile(openFilePath, contextParts);
		} else {
			await this.processDirectory(this.workspacePath, contextParts);
		}

		if (includePackageJson) {
			await this.addPackageJson(contextParts);
		}

		return contextParts.join('\n');
	}

	private createFileData(filePath: string, relPath: string): FileData {
		return {
			path: relPath,
			extension: getExtension(filePath),
			content: readFileContent(filePath),
		};
	}

	private async processOpenFile(
		filePath: string,
		contextParts: string[],
	): Promise<void> {
		const relPath = getRelativePath(this.workspacePath, filePath);
		await this.processFile(filePath, relPath, contextParts);

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
		const files = listFiles(dir);

		for (const file of files) {
			const filePath = resolvePath(dir, file);
			const relPath = getRelativePath(this.workspacePath, filePath);

			if (isIgnored(relPath)) {
				continue;
			}

			if (isDirectory(filePath)) {
				await this.processDirectory(filePath, contextParts);
			} else {
				await this.processFile(filePath, relPath, contextParts);
			}
		}
	}

	private async processMarkedFiles(
		files: string[],
		contextParts: string[],
	): Promise<void> {
		for (const filePath of files) {
			const relPath = getRelativePath(this.workspacePath, filePath);
			if (!isIgnored(relPath) && !isDirectory(filePath)) {
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
		if (
			!this.enforceFileTypes ||
			this.detectedFileExtensions.includes(fileExtension)
		) {
			const fileData = this.createFileData(filePath, relPath);
			contextParts.push(`${formatFileComment(fileData)}\n\n`);
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
