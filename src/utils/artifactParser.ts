import type { Artifact } from '../types/claude';

/**
 * Extract interactive Artifacts from model responses:
 * 1. Explicit <artifact title="..." type="html|svg|markdown|code" language="...">...</artifact> tags
 * 2. Substantial standalone ```html or ```svg fenced code blocks
 */
export function extractArtifactsFromMarkdown(text: string): Artifact[] {
  const artifacts: Artifact[] = [];
  const now = new Date().toISOString();

  // 1. Explicit <artifact ...>...</artifact> blocks
  const tagRe =
    /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = tagRe.exec(text)) !== null) {
    const attrStr = match[1];
    const body = match[2].trim();
    if (!body) continue;

    const titleMatch = attrStr.match(/title="([^"]+)"/i);
    const typeMatch = attrStr.match(/type="([^"]+)"/i);
    const langMatch = attrStr.match(/language="([^"]+)"/i);

    const rawType = (typeMatch?.[1] || 'code').toLowerCase();
    const type: Artifact['type'] =
      rawType === 'html' || rawType === 'svg' || rawType === 'markdown' ? rawType : 'code';

    artifacts.push({
      id: `art-${index++}-${body.length}`,
      title: titleMatch?.[1]?.trim() || `Artifact ${index}`,
      type,
      language: langMatch?.[1]?.trim() || (type === 'html' ? 'html' : type === 'svg' ? 'svg' : undefined),
      content: body,
      version: 1,
      updatedAt: now,
    });
  }

  if (artifacts.length > 0) return artifacts;

  // 2. Auto-detect rich fenced HTML or SVG blocks (>= 6 lines)
  const fenceRe = /```(html|svg)\s*\n([\s\S]*?)```/gi;
  while ((match = fenceRe.exec(text)) !== null) {
    const lang = match[1].toLowerCase() as 'html' | 'svg';
    const body = match[2].trim();
    if (body.split('\n').length < 5) continue;
    const titleFromHtml = body.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    artifacts.push({
      id: `art-fence-${index++}-${body.length}`,
      title: titleFromHtml || (lang === 'html' ? 'Aperçu HTML interactif' : 'Illustration SVG'),
      type: lang,
      language: lang,
      content: body,
      version: 1,
      updatedAt: now,
    });
  }

  return artifacts;
}

export function stripArtifactTags(text: string): string {
  return text
    .replace(/<artifact\s+[^>]+>[\s\S]*?<\/artifact>/gi, (block) => {
      const titleMatch = block.match(/title="([^"]+)"/i);
      const title = titleMatch?.[1] || 'Artifact généré';
      return `\n> **Artifact créé** : *${title}* (ouvert dans le panneau Aperçu)\n`;
    })
    .trim();
}
