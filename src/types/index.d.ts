interface FileData {
	path: string;
	extension: string;
	content: string;
}

interface ContextOptions {
	openFilePath?: string;
	markedFiles?: string[];
	includePackageJson?: boolean;
}
