import * as path from 'path';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';
import ignore from 'ignore';

let ignoreFilter: ReturnType<typeof ignore> | null = null;

export function initializeIgnoreFilter(workspacePath: string): void {
	ignoreFilter = ignore();
	const gitIgnoreContent = readGitIgnore(workspacePath);

	if (gitIgnoreContent) {
		ignoreFilter.add(gitIgnoreContent);
	}
}

export function isIgnored(filePath: string): boolean {
	if (!ignoreFilter) {
		return false;
	}
	return ignoreFilter.ignores(filePath);
}

export function readFileContent(filePath: string): string {
	return readFileSync(filePath, 'utf8');
}

export function listFiles(dir: string): string[] {
	return readdirSync(dir);
}

export function isDirectory(filePath: string): boolean {
	return lstatSync(filePath).isDirectory();
}

export function fileExists(filePath: string): boolean {
	return existsSync(filePath);
}

function readGitIgnore(workspacePath: string): string | null {
	const gitIgnorePath = path.join(workspacePath, '.gitignore');
	if (fileExists(gitIgnorePath)) {
		return readFileSync(gitIgnorePath).toString();
	}
	return null;
}

export function readPackageJson(workspacePath: string): string | null {
	const packageJsonPath = path.join(workspacePath, 'package.json');
	if (fileExists(packageJsonPath)) {
		return readFileContent(packageJsonPath);
	}
	return null;
}
