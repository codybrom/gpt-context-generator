import hljs from 'highlight.js';

export const getMarkdownLang = (extension: string): string => {
	// Remove the dot if present
	const ext = extension.replace(/^\./, '');

	// Try to get the language from highlight.js
	const language = hljs.getLanguage(ext);

	// If found, return the name, otherwise fallback to the extension
	return language?.name ?? ext;
};

export const formatFileComment = (file: FileData): string => {
	const markdownLang = getMarkdownLang(file.extension);
	// Always use the standard format: filename in language specifier
	return `\`\`\`${markdownLang} ${file.path}\n${file.content}\`\`\``;
};
