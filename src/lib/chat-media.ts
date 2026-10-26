export const IMAGE_FENCE = "%%CHAT_IMAGES%%";

export type ChatImageAnnotation = {
    type: "images";
    urls: string[];
};

export function encodeUserContent(text: string, images: string[]) {
    const trimmed = text.trim();
    const imageBlock = images.length
        ? `\n\n${IMAGE_FENCE}\n${images.join("\n")}\n${IMAGE_FENCE}`
        : "";
    return `${trimmed}${imageBlock}`.trim();
}

export function decodeUserContent(content: string): { text: string; images: string[] } {
    const start = content.indexOf(IMAGE_FENCE);

    if (start === -1) {
        return { text: content.trim(), images: [] };
    }

    const end = content.indexOf(IMAGE_FENCE, start + IMAGE_FENCE.length);
    const text = content.slice(0, start).trim();
    if (end === -1) {
        return { text, images: [] };
    }

    const images = content
        .slice(start + IMAGE_FENCE.length, end)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:image/"));

    return { text, images };
}

export function wantsGeneratedImage(text: string, hasAttachedImages = false) {
    const normalized = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

    const asksToAnalyze = /\b(o que|qual|quais|descrev\w*|analis\w*|explic\w*|leia|ler|identific\w*|quant\w*)\b/.test(normalized);
    if (hasAttachedImages && asksToAnalyze) return false;

    const createVerb = /\b(desenh\w*|ilustr\w*|esboc\w*|pint\w*|rascunh\w*|ger\w*|cri\w*|faz\w*|faca|quero|preciso|manda|mostra)\b/;
    const imageNoun = /\b(imagem|foto|ilustracao|figura|logo|desenho)\b/;

    return (
        /\b(desenh\w*|ilustr\w*|esboc\w*|pint\w*)\b/.test(normalized) ||
        (createVerb.test(normalized) && imageNoun.test(normalized)) ||
        /\b(imagem|foto|ilustracao|logo)\s+(de|do|da)\b/.test(normalized) ||
        /\b(draw|sketch|illustrat\w*|paint)\b/.test(normalized) ||
        /\b(generate|create|make)\b[\s\S]{0,40}\b(image|picture|photo|illustration|logo)\b/.test(normalized) ||
        (hasAttachedImages && /\b(edit\w*|transform\w*|mud\w*|alter\w*|remov\w*|adicion\w*|troc\w*)\b/.test(normalized))
    );
}

export function extractEmbeddedImages(text: string): { text: string; images: string[] } {
    const images: string[] = [];
    let next = text;

    next = next.replace(/```(?:xml|svg|html)?[^\n]*\n?([\s\S]*?)```/gi, (block, inner: string) => {
        const svg = inner.match(/<svg[\s\S]*<\/svg>/i);
        if (!svg) return block;
        images.push(svgToDataUrl(svg[0]));
        return "";
    });

    next = next.replace(/<svg[\s\S]*?<\/svg>/gi, (svg) => {
        images.push(svgToDataUrl(svg));
        return "";
    });

    next = next.replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (tag, src: string) => {
        if (src.startsWith("data:image/") || src.startsWith("http://") || src.startsWith("https://")) {
            images.push(src);
            return "";
        }
        return tag;
    });

    next = next.replace(/!\[[^\]]*]\((data:image\/[^)\s]+)\)/g, (_tag, src: string) => {
        images.push(src);
        return "";
    });

    return { text: next.trim(), images };
}

function svgToDataUrl(svg: string) {
    const bytes = new TextEncoder().encode(svg);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${btoa(binary)}`;
}

export function imagesFromAnnotations(annotations: unknown): string[] {
    if (!Array.isArray(annotations)) return [];

    const urls: string[] = [];
    for (const item of annotations) {
        if (!item || typeof item !== "object") continue;
        const annotation = item as Partial<ChatImageAnnotation>;
        if (annotation.type !== "images" || !Array.isArray(annotation.urls)) continue;
        urls.push(...annotation.urls.filter((url): url is string => typeof url === "string" && url.startsWith("data:image/")));
    }
    return urls;
}

export function parseDataUrl(url: string): { mimeType: string; data: string } | null {
    const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2].replace(/\s/g, "") };
}
