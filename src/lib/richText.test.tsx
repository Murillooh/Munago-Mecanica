import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderRich } from './richText';

const html = (text: string) => renderToStaticMarkup(<>{renderRich(text)}</>);

describe('renderRich', () => {
  it('turns a fully bold line into a section title', () => {
    expect(html('**1. DIAGNÓSTICO GERAL**')).toBe('<p class="mt-3 mb-1 font-semibold first:mt-0">1. DIAGNÓSTICO GERAL</p>');
  });

  it('renders bullets with bold and italic inline', () => {
    const out = html('* **Bico Injetor:** comprar o *Bico injetor* hoje');
    expect(out).toContain('<ul');
    expect(out).toContain('<strong class="font-semibold">Bico Injetor:</strong>');
    expect(out).toContain('<em>Bico injetor</em>');
    expect(out).not.toContain('*');
  });

  it('keeps plain text and escapes HTML', () => {
    expect(html('2 * 3 <b>x</b>')).toBe('<p class="my-1 first:mt-0 last:mb-0">2 * 3 &lt;b&gt;x&lt;/b&gt;</p>');
  });
});
