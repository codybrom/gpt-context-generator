// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignoreFactory = require('ignore');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('gpt-context-generator.createGPTFriendlyContext', async () => {
	   if (!vscode.workspace.workspaceFolders) {
		  vscode.window.showErrorMessage('Please open a workspace to use this extension.');
		  return;
	   }
 
	   const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	   const gptContext = await createGPTFriendlyContext(workspacePath);
 
	   const gptContextDocument = await vscode.workspace.openTextDocument({
		  content: gptContext,
		  language: 'plaintext'
	   });
 
	   await vscode.window.showTextDocument(gptContextDocument, vscode.ViewColumn.One);

	   const tokenCount = estimateTokenCount(gptContext);
	   vscode.window.showInformationMessage(`The generated context is approximately ${tokenCount} tokens.`);
	});


	// Register a new command for creating context for the open file
let disposableOpenFile = vscode.commands.registerCommand('gpt-context-generator.createGPTFriendlyContextForOpenFile', async () => {
	if (!vscode.workspace.workspaceFolders || !vscode.window.activeTextEditor) {
		vscode.window.showErrorMessage('Please open a workspace and a file to use this extension.');
		return;
	}

	const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const openFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
	const gptContext = await createGPTFriendlyContextForOpenFile(workspacePath, openFilePath);

	const gptContextDocument = await vscode.workspace.openTextDocument({
		content: gptContext,
		language: 'plaintext'
	});

	await vscode.window.showTextDocument(gptContextDocument, vscode.ViewColumn.One);

	const tokenCount = estimateTokenCount(gptContext);
	vscode.window.showInformationMessage(`The generated context is approximately ${tokenCount} tokens.`);
});

context.subscriptions.push(disposableOpenFile);

 
	context.subscriptions.push(disposable);
 }

 async function createGPTFriendlyContext(workspacePath: string): Promise<string> {
	const gitIgnorePath = path.join(workspacePath, '.gitignore');
	const ignoreFilter = ignoreFactory();

	if (fs.existsSync(gitIgnorePath)) {
		const gitIgnoreContent = fs.readFileSync(gitIgnorePath).toString();
		ignoreFilter.add(gitIgnoreContent);
	}

	const gptContext: string[] = [];

	const processDirectory = async (dir: string) => {
		const files = fs.readdirSync(dir);

		for (const file of files) {
			const filePath = path.join(dir, file);
			const relFilePath = path.relative(workspacePath, filePath);

			if (ignoreFilter.ignores(relFilePath)) {
				continue;
			}

			const fileStat = fs.lstatSync(filePath);

			if (fileStat.isDirectory()) {
				await processDirectory(filePath);
			} else if (fileStat.isFile()) {
				const fileExtension = path.extname(filePath).toLowerCase();
				const allowedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

				if (allowedExtensions.includes(fileExtension)) {
					const fileContent = fs.readFileSync(filePath).toString();
					gptContext.push(`File: ${relFilePath}\n\n${fileContent}\n\n`);
				}
			}
		}
	};

	await processDirectory(workspacePath);
	return gptContext.join('\n');
}

async function createGPTFriendlyContextForOpenFile(workspacePath: string, openFilePath: string): Promise<string> {
	const gitIgnorePath = path.join(workspacePath, '.gitignore');
	const ignoreFilter = ignoreFactory();

	if (fs.existsSync(gitIgnorePath)) {
		const gitIgnoreContent = fs.readFileSync(gitIgnorePath).toString();
		ignoreFilter.add(gitIgnoreContent);
	}

	const gptContext: string[] = [];

	// Add the content of the currently open file
	const openFileContent = fs.readFileSync(openFilePath).toString();
	const openFileRelPath = path.relative(workspacePath, openFilePath);
	gptContext.push(`File: ${openFileRelPath}\n\n${openFileContent}\n\n`);

	// Helper function to extract import paths from a file's content
	const extractImports = (content: string): string[] => {
		const regex = /import\s+.*\s+from\s+['"](.*)['"];/g;
		const imports: string[] = [];
		let match: RegExpExecArray | null;

		while ((match = regex.exec(content)) !== null) {
			imports.push(match[1]);
		}

		return imports;
	};

	const imports = extractImports(openFileContent);
	for (const importPath of imports) {
		if (!importPath.endsWith('.css') && !importPath.endsWith('.scss')) {
			const absoluteImportPath = path.resolve(path.dirname(openFilePath), `${importPath}.ts`);
			const relImportPath = path.relative(workspacePath, absoluteImportPath);
			if (!ignoreFilter.ignores(relImportPath) && fs.existsSync(absoluteImportPath)) {
				const importedFileContent = fs.readFileSync(absoluteImportPath).toString();
				gptContext.push(`File: ${relImportPath}\n\n${importedFileContent}\n\n`);
			}
		}
	}

	return gptContext.join('\n');
}

function estimateTokenCount(text: string): number {
	const whitespace = /\s+/g;
	const words = text.trim().split(whitespace);
	return words.length;
}

// This method is called when your extension is deactivated
export function deactivate() {}