export const IMAGE_FENCE = "%%CHAT_IMAGES%%";

export function encodeUserContent(text: string, images: string[]) {
    const trimmed = text.trim();
    const imageBlock = images.length
        ? `\n\n${IMAGE_FENCE}\n${images.join("\n")}\n${IMAGE_FENCE}`
        : "";
    return `${trimmed}${imageBlock}`.trim();
}

export function decodeUserContent(content: string): { text: string; images: string[] } {
    const start = content.indexOf(IMAGE_FENCE);
    if (start === -1) return { text: content.trim(), images: [] };

    const end = content.indexOf(IMAGE_FENCE, start + IMAGE_FENCE.length);
    const text = content.slice(0, start).trim();
    if (end === -1) return { text, images: [] };

    const images = content
        .slice(start + IMAGE_FENCE.length, end)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:image/"));

    return { text, images };
}
