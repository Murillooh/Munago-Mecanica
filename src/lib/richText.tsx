import React from 'react';

/** Markdown mínimo e seguro (títulos em negrito, negrito, itálico, listas), montado como elementos React. */
export function renderRich(text: string) {
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${key}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>
        : part.length > 2 && part.startsWith('*') && part.endsWith('*')
          ? <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>
          : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>,
    );
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`my-1.5 space-y-1 pl-5 ${list.ordered ? 'list-decimal' : 'list-disc'}`}>
        {list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>)}
      </Tag>,
    );
    list = null;
  };
  text.split('\n').forEach((raw, idx) => {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ol || ul) {
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ol ?? ul)![1]);
      return;
    }
    flush();
    const heading = line.trim().match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) {
      blocks.push(<p key={`h${idx}`} className="mt-3 mb-1 font-semibold first:mt-0">{heading[1]}</p>);
      return;
    }
    if (line.trim()) blocks.push(<p key={`p${idx}`} className="my-1 first:mt-0 last:mb-0">{inline(line, `p${idx}`)}</p>);
  });
  flush();
  return blocks;
}
