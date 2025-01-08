import * as path from 'path';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'fs';

export function fileExists(filePath: string): boolean {
	return existsSync(filePath);
}

export function getBasename(filepath: string): string {
	return path.basename(filepath);
}

export function getDirname(filepath: string): string {
	return path.dirname(filepath);
}

export function getExtension(filepath: string): string {
	return path.extname(filepath).toLowerCase().substring(1);
}

export function getRelativePath(from: string, to: string): string {
	if (!from || !to) {
		throw new Error('Invalid path: both from and to paths must be provided');
	}
	return path.relative(from, to);
}

export function isDirectory(filePath: string): boolean {
	return lstatSync(filePath).isDirectory();
}

export function listFiles(dir: string): string[] {
	return readdirSync(dir);
}

export function readFileContent(filePath: string): string {
	return readFileSync(filePath, 'utf8');
}

export function readPackageJson(workspacePath: string): string | null {
	const packageJsonPath = path.join(workspacePath, 'package.json');
	if (fileExists(packageJsonPath)) {
		return readFileContent(packageJsonPath);
	}
	return null;
}

export function resolvePath(...paths: string[]): string {
	if (!paths.length || paths.some((p) => !p)) {
		throw new Error('Invalid path: path segments must not be empty');
	}
	return path.join(...paths);
}
