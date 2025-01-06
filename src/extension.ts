import * as vscode from 'vscode';
import * as path from 'path';
import {
	readFileContent,
	listFiles,
	isDirectory,
	fileExists,
	readPackageJson,
	initializeIgnoreFilter,
	isIgnored,
} from './fileUtils';
import { formatFileComment, getMarkdownLang } from './markdownUtils';
import { estimateTokenCount } from './tokenUtils';
import { markedFiles, MarkedFilesProvider } from './treeProvider';
import { extractImports } from './importParser';

export function activate(context: vscode.ExtensionContext) {
	const markedFilesProvider = new MarkedFilesProvider();
	vscode.window.registerTreeDataProvider('markedFilesView', markedFilesProvider);

	const disposable = vscode.commands.registerCommand(
		'gpt-context-generator.createGPTFriendlyContext',
		async () => {
			if (!vscode.workspace.workspaceFolders) {
				vscode.window.showErrorMessage('Please open a workspace to use this extension.');
				return;
			}
			const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const config = vscode.workspace.getConfiguration('gpt-context-generator');
			const includePackageJson = (config.get('includePackageJson') as boolean) ?? false;
			await handleCommand(workspacePath, { includePackageJson });
		},
	);

	const disposableOpenFile = vscode.commands.registerCommand(
		'gpt-context-generator.createGPTFriendlyContextForOpenFile',
		async () => {
			if (!vscode.workspace.workspaceFolders || !vscode.window.activeTextEditor) {
				vscode.window.showErrorMessage(
					'Please open a workspace and a file to use this extension.',
				);
				return;
			}
			const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const openFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
			const config = vscode.workspace.getConfiguration('gpt-context-generator');
			const includePackageJson = (config.get('includePackageJson') as boolean) ?? false;
			await handleCommand(workspacePath, { openFilePath, includePackageJson });
		},
	);

	const disposableMarkFile = vscode.commands.registerCommand(
		'gpt-context-generator.markFileForInclusion',
		async () => {
			if (!vscode.window.activeTextEditor) {
				vscode.window.showErrorMessage(
					'Please open a file to mark/unmark it for inclusion.',
				);
				return;
			}
			const filePath = vscode.window.activeTextEditor.document.uri.fsPath;
			if (markedFiles.has(filePath)) {
				markedFiles.delete(filePath);
				vscode.window.showInformationMessage(`File unmarked: ${filePath}`);
			} else {
				markedFiles.add(filePath);
				vscode.window.showInformationMessage(`File marked for inclusion: ${filePath}`);
			}

			markedFilesProvider.refresh();
		},
	);

	const disposableGenerateMarkedFilesContext = vscode.commands.registerCommand(
		'gpt-context-generator.createGPTFriendlyContextForMarkedFiles',
		async () => {
			if (!vscode.workspace.workspaceFolders) {
				vscode.window.showErrorMessage('Please open a workspace to use this extension.');
				return;
			}
			const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const config = vscode.workspace.getConfiguration('gpt-context-generator');
			const includePackageJson = (config.get('includePackageJson') as boolean) ?? false;
			await handleCommand(workspacePath, {
				markedFiles: Array.from(markedFiles),
				includePackageJson,
			});
		},
	);

	const disposableClearMarkedFiles = vscode.commands.registerCommand(
		'gpt-context-generator.clearMarkedFiles',
		async () => {
			markedFiles.clear();
			markedFilesProvider.refresh();
			vscode.window.showInformationMessage('Cleared all marked files.');
		},
	);

	const disposableUnmarkFileFromTreeView = vscode.commands.registerCommand(
		'gpt-context-generator.unmarkFileFromTreeView',
		async (treeItem: vscode.TreeItem) => {
			if (treeItem && treeItem.resourceUri) {
				const filePath = treeItem.resourceUri.fsPath;
				if (markedFiles.has(filePath)) {
					markedFiles.delete(filePath);
					vscode.window.showInformationMessage(`File unmarked: ${filePath}`);
					markedFilesProvider.refresh();
				}
			} else {
				vscode.window.showErrorMessage('Unable to unmark file from the tree view.');
			}
		},
	);

	context.subscriptions.push(disposableOpenFile);
	context.subscriptions.push(disposable);
	context.subscriptions.push(disposableMarkFile);
	context.subscriptions.push(disposableGenerateMarkedFilesContext);
	context.subscriptions.push(disposableClearMarkedFiles);
	context.subscriptions.push(disposableUnmarkFileFromTreeView);
}

async function handleCommand(
	workspacePath: string,
	options: {
		openFilePath?: string;
		markedFiles?: string[];
		includePackageJson?: boolean;
	},
) {
	const config = vscode.workspace.getConfiguration('gpt-context-generator');
	const outputMethod = config.get('outputMethod') as string;
	const outputLanguage = config.get('outputLanguage') as string;

	const gptContext = options.markedFiles
		? await createGPTFriendlyContext(
				workspacePath,
				options.includePackageJson ?? false,
				options.markedFiles,
			)
		: options.openFilePath
			? await createGPTFriendlyContextForOpenFile(
					workspacePath,
					options.openFilePath,
					options.includePackageJson ?? false,
				)
			: await createGPTFriendlyContext(workspacePath, options.includePackageJson ?? false);

	if (outputMethod === 'newWindow') {
		const gptContextDocument = await vscode.workspace.openTextDocument({
			content: gptContext,
			language: outputLanguage,
		});

		await vscode.window.showTextDocument(gptContextDocument, vscode.ViewColumn.One);
	} else if (outputMethod === 'clipboard') {
		await vscode.env.clipboard.writeText(gptContext);
		vscode.window.showInformationMessage('GPT-friendly context copied to clipboard.');
	}

	const tokenCount = estimateTokenCount(gptContext);
	if (tokenCount > 8000) {
		vscode.window.showWarningMessage(
			`The generated context is approximately ${tokenCount} tokens, which is greater than 8000 tokens.`,
		);
	} else {
		vscode.window.showInformationMessage(
			`The generated context is approximately ${tokenCount} tokens.`,
		);
	}
}

async function createGPTFriendlyContext(
	workspacePath: string,
	includePackageJson: boolean,
	markedFiles?: string[],
): Promise<string> {
	initializeIgnoreFilter(workspacePath);
	const gptContext: string[] = [];
	const config = vscode.workspace.getConfiguration('gpt-context-generator');
	const detectedFileExtensions = config.get('detectedFileExtensions') as string[];
	const format = config.get('fileCommentFormat') as string;

	const processDirectory = async (dir: string) => {
		const files = listFiles(dir);

		for (const file of files) {
			const filePath = path.join(dir, file);
			const relFilePath = path.relative(workspacePath, filePath);

			if (isIgnored(relFilePath)) {
				continue;
			}

			if (isDirectory(filePath)) {
				await processDirectory(filePath);
			} else {
				const fileExtension = path.extname(filePath).toLowerCase().substring(1);

				if (detectedFileExtensions.includes(fileExtension)) {
					const fileContent = readFileContent(filePath);
					const fileComment = formatFileComment(
						format,
						relFilePath,
						fileExtension,
						fileContent,
					);
					gptContext.push(`${fileComment}\n\n`);
				}
			}
		}
	};

	const processMarkedFiles = async (files: string[]) => {
		for (const filePath of files) {
			const relFilePath = path.relative(workspacePath, filePath);
			if (isIgnored(relFilePath)) {
				continue;
			}

			if (!isDirectory(filePath)) {
				const fileExtension = path.extname(filePath).toLowerCase().substring(1);
				if (detectedFileExtensions.includes(fileExtension)) {
					const fileContent = readFileContent(filePath);
					const fileComment = formatFileComment(
						format,
						relFilePath,
						fileExtension,
						fileContent,
					);
					gptContext.push(`${fileComment}\n\n`);
				}
			}
		}
	};

	if (markedFiles) {
		await processMarkedFiles(markedFiles);
	} else {
		await processDirectory(workspacePath);
	}

	return gptContext.join('\n');
}



async function createGPTFriendlyContextForOpenFile(
    workspacePath: string,
    openFilePath: string,
    includePackageJson: boolean,
): Promise<string> {
    initializeIgnoreFilter(workspacePath);  // Initialize the ignore filter
    const gptContext: string[] = [];
    const config = vscode.workspace.getConfiguration('gpt-context-generator');
    const detectedFileExtensions = config.get('detectedFileExtensions') as string[];
    const format = config.get('fileCommentFormat') as string;

	const openFileContent = readFileContent(openFilePath);
	const openFileRelPath = path.relative(workspacePath, openFilePath);
	const openFileExtension = path.extname(openFilePath).toLowerCase().substring(1);

	if (detectedFileExtensions.includes(openFileExtension)) {
		const fileComment = formatFileComment(
			format,
			openFileRelPath,
			getMarkdownLang(openFileExtension),
			openFileContent,
		);
		gptContext.push(`${fileComment}\n\n`);
	}

    const imports = extractImports(openFileContent);
    for (const importPath of imports) {
        const resolvedImportPath = path.resolve(path.dirname(openFilePath), importPath);
        const relImportPath = path.relative(workspacePath, resolvedImportPath);

        if (isIgnored(relImportPath)) {
            continue;
        }

		const importFileExtension = path.extname(resolvedImportPath).toLowerCase().substring(1);

		if (!importFileExtension) {
			// Try adding default file extensions if importPath has no extension
			for (const ext of detectedFileExtensions) {
				const importFilePathWithExt = `${resolvedImportPath}.${ext}`;
				const relImportPathWithExt = path.relative(workspacePath, importFilePathWithExt);

				if (fileExists(importFilePathWithExt)) {
					const importedFileContent = readFileContent(importFilePathWithExt);
					const fileComment = formatFileComment(
						format,
						relImportPathWithExt,
						getMarkdownLang(ext),
						importedFileContent,
					);
					gptContext.push(`${fileComment}\n\n`);
					break;
				}
			}
		} else if (
			detectedFileExtensions.includes(importFileExtension) &&
			fileExists(resolvedImportPath)
		) {
			const importedFileContent = readFileContent(resolvedImportPath);
			const fileComment = formatFileComment(
				format,
				relImportPath,
				getMarkdownLang(importFileExtension),
				importedFileContent,
			);
			gptContext.push(`${fileComment}\n\n`);
		}
	}

	if (includePackageJson) {
		const packageJsonContent = readPackageJson(workspacePath);
		if (packageJsonContent) {
			const fileComment = formatFileComment(
				format,
				'package.json',
				getMarkdownLang('json'),
				packageJsonContent,
			);
			gptContext.push(`${fileComment}\n\n`);
		}
	}

	return gptContext.join('\n');
}

export function deactivate() {}
