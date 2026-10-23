/* Plain text of a Markdown body, for list snippets. */
export function stripMarkdown(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, " ") // code blocks, mermaid diagrams included
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list markers
        .replace(/[*_~`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
