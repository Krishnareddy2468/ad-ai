import { AdAnalysis, CROAnalysis, PageElement } from '@/types';
import * as cheerio from 'cheerio';

export async function personalizeHtml(
  originalHtml: string,
  adAnalysis: AdAnalysis,
  croAnalysis: CROAnalysis
): Promise<{ html: string; appliedChanges: PageElement[] }> {
  const $ = cheerio.load(originalHtml);
  const appliedChanges: PageElement[] = [];

  // Remove existing base tags first
  $('base').remove();

  for (const change of croAnalysis.priorityChanges) {
    try {
      let found = false;

      // Strategy 1: Search by element type and text content
      const typeToTags: Record<string, string[]> = {
        headline: ['h1', 'h2', 'h3', 'h4'],
        subheadline: ['h2', 'h3', 'h4', 'h5'],
        cta: ['a', 'button', '[role="button"]'],
        body: ['p', 'span', 'div', 'li'],
        hero: ['h1', 'h2', 'p', 'span', 'div'],
      };

      const tags = typeToTags[change.type] || ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'span', 'div'];

      // Normalize the original text from the CRO recommendation
      const normalizedOriginal = change.original.replace(/\s+/g, ' ').trim().toLowerCase();

      for (const tag of tags) {
        $(tag).each((_, el) => {
          if (found) return;
          const elText = $(el).text().replace(/\s+/g, ' ').trim();
          const normalizedElText = elText.toLowerCase();

          // Match strategies (from most to least strict)
          const isMatch =
            normalizedElText === normalizedOriginal ||
            normalizedElText.includes(normalizedOriginal) ||
            normalizedOriginal.includes(normalizedElText) ||
            (normalizedElText.length > 5 && similarity(normalizedElText, normalizedOriginal) > 0.5) ||
            // Partial word overlap for short CTA texts
            (change.type === 'cta' && normalizedElText.length < 40 && wordOverlap(normalizedElText, normalizedOriginal) > 0.5);

          if (isMatch) {
            // For elements with children, be careful about replacement
            if ($(el).children().length === 0) {
              $(el).text(change.modified);
            } else {
              // Try to replace the original text within the HTML
              const html = $(el).html() || '';
              const escaped = escapeRegExp(change.original);
              const newHtml = html.replace(new RegExp(escaped, 'i'), change.modified);
              if (newHtml !== html) {
                $(el).html(newHtml);
              } else {
                // Replace first text node
                const textNodes = $(el).contents().filter(function () {
                  return this.type === 'text' && (this as any).data?.trim().length > 0;
                });
                if (textNodes.length > 0) {
                  textNodes.first().replaceWith(change.modified + ' ');
                } else {
                  // Fallback: replace the innermost child's text
                  const deepest = findDeepestTextElement($, el);
                  if (deepest) {
                    $(deepest).text(change.modified);
                  }
                }
              }
            }
            found = true;
            $(el).attr('data-personalized', 'true');
            appliedChanges.push(change);
          }
        });
        if (found) break;
      }

      // Strategy 2: Global text search across all elements
      if (!found) {
        $('*').each((_, el) => {
          if (found) return;
          if (['script', 'style', 'noscript', 'meta', 'link'].includes(
            ($(el).prop('tagName') || '').toLowerCase()
          )) return;
          
          const elText = $(el).clone().children().remove().end().text().trim();
          if (elText.length > 0 && similarity(elText.toLowerCase(), normalizedOriginal) > 0.6) {
            $(el).contents().filter(function () {
              return this.type === 'text';
            }).first().replaceWith(change.modified);
            found = true;
            $(el).attr('data-personalized', 'true');
            appliedChanges.push(change);
          }
        });
      }

      if (!found) {
        // Record as suggested (couldn't find in page)
        appliedChanges.push({ ...change, modified: `[SUGGESTED] ${change.modified}` });
      }
    } catch {
      // Skip failed changes silently
    }
  }

  // Inject personalization indicator styles
  $('head').append(`
    <style>
      [data-personalized="true"] {
        position: relative;
      }
      [data-personalized="true"]::after {
        content: '✨ Personalized';
        position: absolute;
        top: -8px;
        right: -8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 8px;
        font-weight: 600;
        letter-spacing: 0.5px;
        z-index: 9999;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      }
    </style>
  `);

  return { html: $.html(), appliedChanges };
}

/**
 * Find the deepest element that contains primarily text content
 */
function findDeepestTextElement($: cheerio.CheerioAPI, el: any): any {
  const children = $(el).children();
  if (children.length === 0) return el;
  // Find child with most text
  let bestChild = null;
  let bestLen = 0;
  children.each((_, child) => {
    const text = $(child).text().trim();
    if (text.length > bestLen) {
      bestLen = text.length;
      bestChild = child;
    }
  });
  return bestChild ? findDeepestTextElement($, bestChild) : el;
}

/**
 * Calculate word overlap ratio between two strings
 */
function wordOverlap(s1: string, s2: string): number {
  const arr1 = s1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = new Set(s2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (arr1.length === 0 || words2.size === 0) return 0;
  let overlap = 0;
  for (const w of arr1) {
    if (words2.has(w)) overlap++;
  }
  return overlap / Math.min(arr1.length, words2.size);
}

function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  const editDist = editDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDist) / longer.length;
}

function editDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
