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
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const title = $('title').text().trim();

  // Detect SPA pages — keep scripts intact so iframe can render them
  if (isSpaShell(html)) {
    console.warn(`[Scraper] Detected SPA shell for ${url} (${html.length} bytes). Scripts preserved for client-side rendering.`);
    return { html, text: title, title: title || url };
  }

  // Normal SSR page — extract text (strip scripts for text extraction only)
  $('script, style, noscript, iframe').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  return { html, text, title };
}

export function extractPageStructure(html: string) {
  const $ = cheerio.load(html);

  const elements: { type: string; selector: string; text: string }[] = [];
  const seen = new Set<string>(); // deduplicate

  function addElement(type: string, selector: string, text: string) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 3 || seen.has(cleaned)) return;
    seen.add(cleaned);
    elements.push({ type, selector, text: cleaned });
  }

  // Extract headlines (h1-h4)
  $('h1, h2, h3, h4').each((i, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase() || 'h1';
    const text = $(el).text().trim();
    if (text.length > 0 && text.length < 300) {
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
    const text = $(el).text().trim();
    if (text.length > 0 && text.length < 80) {
      addElement('cta', `cta-${i}`, text);
    }
  });

  // Extract hero/lead text — first large text in main/section/header
  $('main p, header p, section p, [class*="hero"] p, [class*="Hero"] p, [class*="banner"] p').slice(0, 5).each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 15 && text.length < 500) {
      addElement('hero', `hero-p-${i}`, text);
    }
  });

  // Extract paragraphs (first 15, skip very short ones)
  $('p').slice(0, 15).each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 15 && text.length < 500) {
      addElement('body', `p:nth-of-type(${i + 1})`, text);
    }
  });

  // Extract list items that might be feature bullets
  $('li').slice(0, 10).each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 200) {
      addElement('body', `li-${i}`, text);
    }
  });

  // Extract span/div with large text that might be headlines in SPAs
  $('[class*="title"], [class*="Title"], [class*="heading"], [class*="Heading"]').each((i, el) => {
    const text = $(el).text().trim();
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
