import * as cheerio from 'cheerio';

/**
 * Detect if a page is a JavaScript-rendered SPA with no server-side content.
 */
function isSpaShell(html: string): boolean {
  const $ = cheerio.load(html);
  const $body = $('body').clone();
  $body.find('script, style, noscript, link, meta').remove();
  const textContent = $body.text().replace(/\s+/g, ' ').trim();
  const hasContent = $body.find('h1, h2, h3, p, article, section, main').length > 0;
  const hasSpaRoot = $body.find('#root, #app, #__next, [id*="app"], [id*="root"]').length > 0;
  return textContent.length < 100 && !hasContent && hasSpaRoot;
}

export async function scrapePage(url: string): Promise<{ html: string; text: string; title: string }> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const isRetryable = response.status === 503 || response.status === 429 || response.status === 502;
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          console.warn(`[Scraper] ${response.status} from ${url}, retrying in ${(attempt + 1) * 2}s...`);
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      if (!html || html.trim().length < 50) {
        throw new Error('Page returned empty or minimal content');
      }

      const $ = cheerio.load(html);
      const title = $('title').text().trim();

      if (isSpaShell(html)) {
        console.warn(`[Scraper] Detected SPA shell for ${url} (${html.length} bytes). Scripts preserved for client-side rendering.`);
        return { html, text: title, title: title || url };
      }

      // Extract text for analysis — from a clone so original HTML stays intact
      const $clone = cheerio.load(html);
      $clone('script, style, noscript, iframe').remove();
      const text = $clone('body').text().replace(/\s+/g, ' ').trim();

      return { html, text, title };
    } catch (error: any) {
      lastError = error;
      if (error.name === 'AbortError') {
        console.warn(`[Scraper] Timeout fetching ${url}, attempt ${attempt + 1}/${MAX_RETRIES}`);
      } else {
        console.warn(`[Scraper] Error fetching ${url}: ${error.message}, attempt ${attempt + 1}/${MAX_RETRIES}`);
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
}

export function extractPageStructure(html: string) {
  const $ = cheerio.load(html);

  const elements: { type: string; selector: string; text: string }[] = [];
  const seen = new Set<string>(); // deduplicate

  // Extract text with proper spaces between child elements
  function spacedText(el: any): string {
    const parts: string[] = [];
    $(el).contents().each((_: number, node: any) => {
      if (node.type === 'text') {
        const d = (node as any).data?.trim();
        if (d) parts.push(d);
      } else if (node.type === 'tag') {
        const childText = spacedText(node);
        if (childText) parts.push(childText);
      }
    });
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function addElement(type: string, selector: string, text: string) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 3 || seen.has(cleaned)) return;
    // Skip text that is a substring of an already-seen element (e.g., "thing" inside "Be the next big thing")
    const cleanedLower = cleaned.toLowerCase();
    let isFragment = false;
    for (const s of Array.from(seen)) {
      if (s.toLowerCase().includes(cleanedLower) || cleanedLower.includes(s.toLowerCase())) {
        if (cleaned.length < s.length) { isFragment = true; break; }
      }
    }
    if (isFragment) return;
    seen.add(cleaned);
    elements.push({ type, selector, text: cleaned });
  }

  // Extract headlines (h1-h4) — skip short fragments (< 15 chars or < 3 words)
  $('h1, h2, h3, h4').each((i, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase() || 'h1';
    const text = spacedText(el);
    const wordCount = text.split(/\s+/).length;
    if (text.length >= 15 && wordCount >= 3 && text.length < 300) {
      addElement(tag === 'h1' ? 'headline' : 'subheadline', `${tag}:nth-of-type(${i + 1})`, text);
    }
  });

  // Extract CTAs — broader selectors
  const ctaSelectors = [
    'a[class*="btn"]', 'a[class*="button"]', 'a[class*="Button"]',
    'a[class*="cta"]', 'a[class*="CTA"]',
    'button', '[role="button"]',
    'a[href*="signup"]', 'a[href*="register"]', 'a[href*="trial"]',
    'a[href*="demo"]', 'a[href*="start"]', 'a[href*="free"]',
    'a[href*="get-started"]', 'a[href*="pricing"]',
  ];
  $(ctaSelectors.join(', ')).each((i, el) => {
    const text = spacedText(el);
    if (text.length > 0 && text.length < 80) {
      addElement('cta', `cta-${i}`, text);
    }
  });

  // Extract hero/lead text — first large text in main/section/header
  $('main p, header p, section p, [class*="hero"] p, [class*="Hero"] p, [class*="banner"] p').slice(0, 5).each((i, el) => {
    const text = spacedText(el);
    if (text.length > 15 && text.length < 500) {
      addElement('hero', `hero-p-${i}`, text);
    }
  });

  // Extract paragraphs (first 15, skip very short ones)
  $('p').slice(0, 15).each((i, el) => {
    const text = spacedText(el);
    if (text.length > 15 && text.length < 500) {
      addElement('body', `p:nth-of-type(${i + 1})`, text);
    }
  });

  // Extract list items that might be feature bullets
  $('li').slice(0, 10).each((i, el) => {
    const text = spacedText(el);
    if (text.length > 10 && text.length < 200) {
      addElement('body', `li-${i}`, text);
    }
  });

  // Extract span/div with large text that might be headlines in SPAs
  $('[class*="title"], [class*="Title"], [class*="heading"], [class*="Heading"]').each((i, el) => {
    const text = spacedText(el);
    if (text.length > 3 && text.length < 200) {
      addElement('headline', `titled-${i}`, text);
    }
  });

  // Extract meta description
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  if (metaDesc) {
    addElement('meta', 'meta-description', metaDesc);
  }

  return elements;
}
