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
} from './utils/fileUtils';
import { formatFileComment, getMarkdownLang } from './markdownUtils';
import { estimateTokenCount } from './tokenUtils';
import { extractImports } from './importParser';

export class ContextGenerator {
    private config: vscode.WorkspaceConfiguration;
    private detectedFileExtensions: string[];
    private format: string;

    constructor(private workspacePath: string) {
        this.config = vscode.workspace.getConfiguration('gpt-context-generator');
        this.detectedFileExtensions = this.config.get('detectedFileExtensions') as string[];
        this.format = this.config.get('fileCommentFormat') as string;
        initializeIgnoreFilter(workspacePath);
    }

    async handleContextGeneration(options: {
        openFilePath?: string;
        markedFiles?: string[];
        includePackageJson?: boolean;
    }): Promise<void> {
        const outputMethod = this.config.get('outputMethod') as string;
        const outputLanguage = this.config.get('outputLanguage') as string;

        const gptContext = options.markedFiles
            ? await this.createGPTFriendlyContext(options.includePackageJson ?? false, options.markedFiles)
            : options.openFilePath
                ? await this.createGPTFriendlyContextForOpenFile(options.openFilePath, options.includePackageJson ?? false)
                : await this.createGPTFriendlyContext(options.includePackageJson ?? false);

        await this.handleOutput(gptContext, outputMethod, outputLanguage);
        this.showTokenCount(gptContext);
    }

    private async handleOutput(content: string, outputMethod: string, outputLanguage: string): Promise<void> {
        if (outputMethod === 'newWindow') {
            const document = await vscode.workspace.openTextDocument({
                content,
                language: outputLanguage,
            });
            await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
        } else if (outputMethod === 'clipboard') {
            await vscode.env.clipboard.writeText(content);
            vscode.window.showInformationMessage('GPT-friendly context copied to clipboard.');
        }
    }

    private showTokenCount(content: string): void {
        const tokenCount = estimateTokenCount(content);
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

    private async createGPTFriendlyContext(
        includePackageJson: boolean,
        markedFiles?: string[],
    ): Promise<string> {
        const gptContext: string[] = [];

        if (markedFiles) {
            await this.processMarkedFiles(markedFiles, gptContext);
        } else {
            await this.processDirectory(this.workspacePath, gptContext);
        }

        if (includePackageJson) {
            await this.addPackageJson(gptContext);
        }

        return gptContext.join('\n');
    }

    private async createGPTFriendlyContextForOpenFile(
        openFilePath: string,
        includePackageJson: boolean,
    ): Promise<string> {
        const gptContext: string[] = [];

        // Process the open file
        const openFileContent = readFileContent(openFilePath);
        const openFileRelPath = path.relative(this.workspacePath, openFilePath);
        const openFileExtension = path.extname(openFilePath).toLowerCase().substring(1);

        if (this.detectedFileExtensions.includes(openFileExtension)) {
            const fileComment = formatFileComment(
                this.format,
                openFileRelPath,
                getMarkdownLang(openFileExtension),
                openFileContent,
            );
            gptContext.push(`${fileComment}\n\n`);
        }

        // Process imports
        await this.processImports(openFilePath, openFileContent, gptContext);

        if (includePackageJson) {
            await this.addPackageJson(gptContext);
        }

        return gptContext.join('\n');
    }

    private async processImports(
        openFilePath: string, 
        openFileContent: string, 
        gptContext: string[]
    ): Promise<void> {
        const imports = extractImports(openFileContent);
        for (const importPath of imports) {
            const resolvedImportPath = path.resolve(path.dirname(openFilePath), importPath);
            const relImportPath = path.relative(this.workspacePath, resolvedImportPath);

            if (isIgnored(relImportPath)) {
                continue;
            }

            const importFileExtension = path.extname(resolvedImportPath).toLowerCase().substring(1);

            if (!importFileExtension) {
                await this.processImportWithoutExtension(resolvedImportPath, gptContext);
            } else if (
                this.detectedFileExtensions.includes(importFileExtension) &&
                fileExists(resolvedImportPath)
            ) {
                await this.processFile(resolvedImportPath, relImportPath, gptContext);
            }
        }
    }

    private async processImportWithoutExtension(
        resolvedImportPath: string,
        gptContext: string[]
    ): Promise<void> {
        for (const ext of this.detectedFileExtensions) {
            const importFilePathWithExt = `${resolvedImportPath}.${ext}`;
            const relImportPathWithExt = path.relative(this.workspacePath, importFilePathWithExt);

            if (fileExists(importFilePathWithExt)) {
                await this.processFile(importFilePathWithExt, relImportPathWithExt, gptContext);
                break;
            }
        }
    }

    private async processDirectory(dir: string, gptContext: string[]): Promise<void> {
        const files = listFiles(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const relFilePath = path.relative(this.workspacePath, filePath);

            if (isIgnored(relFilePath)) {
                continue;
            }

            if (isDirectory(filePath)) {
                await this.processDirectory(filePath, gptContext);
            } else {
                await this.processFile(filePath, relFilePath, gptContext);
            }
        }
    }

    private async processMarkedFiles(files: string[], gptContext: string[]): Promise<void> {
        for (const filePath of files) {
            const relFilePath = path.relative(this.workspacePath, filePath);
            if (!isIgnored(relFilePath) && !isDirectory(filePath)) {
                await this.processFile(filePath, relFilePath, gptContext);
            }
        }
    }

    private async processFile(filePath: string, relFilePath: string, gptContext: string[]): Promise<void> {
        const fileExtension = path.extname(filePath).toLowerCase().substring(1);
        if (this.detectedFileExtensions.includes(fileExtension)) {
            const fileContent = readFileContent(filePath);
            const fileComment = formatFileComment(
                this.format,
                relFilePath,
                getMarkdownLang(fileExtension),
                fileContent,
            );
            gptContext.push(`${fileComment}\n\n`);
        }
    }

    private async addPackageJson(gptContext: string[]): Promise<void> {
        const packageJsonContent = readPackageJson(this.workspacePath);
        if (packageJsonContent) {
            const fileComment = formatFileComment(
                this.format,
                'package.json',
                getMarkdownLang('json'),
                packageJsonContent,
            );
            gptContext.push(`${fileComment}\n\n`);
        }
    }
}

// Export a factory function for easier instantiation
export function createContextGenerator(workspacePath: string): ContextGenerator {
    return new ContextGenerator(workspacePath);
}