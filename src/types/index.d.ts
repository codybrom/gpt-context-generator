interface FileData {
	path: string;
	extension: string;
	content: string;
}

interface ContextOptions {
	openFilePath?: string;
	markedFiles?: string[];
	includePackageJson?: boolean;
	outputMethod?: string;
	outputLanguage?: string;
}

interface IgnoreConfig {
	ignoreFiles: string[];
	ignorePatternsFromFile?: boolean;
}
