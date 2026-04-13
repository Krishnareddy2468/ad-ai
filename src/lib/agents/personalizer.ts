import { AdAnalysis, CROAnalysis, PageElement } from '@/types';
import * as cheerio from 'cheerio';

/**
 * Personalizer — applies CRO changes to the landing page.
 * 
 * KEY DESIGN: We use Cheerio ONLY for read-only matching (finding which
 * elements exist in the page). The actual modifications are applied via
 * an injected client-side script that runs after the page loads.
 * 
 * This preserves the original HTML exactly — all CSS, JS, SVG, and
 * framework-specific markup stays intact. Cheerio's $.html() serialization
 * is known to break modern JS framework pages (Next.js, React, etc.).
 */
export async function personalizeHtml(
  originalHtml: string,
  adAnalysis: AdAnalysis,
  croAnalysis: CROAnalysis
): Promise<{ html: string; appliedChanges: PageElement[] }> {
  const $ = cheerio.load(originalHtml);
  const appliedChanges: PageElement[] = [];
  const verifiedChanges: { original: string; modified: string; type: string }[] = [];

  for (const change of croAnalysis.priorityChanges) {
    try {
      let found = false;

      const typeToTags: Record<string, string[]> = {
        headline: ['h1', 'h2', 'h3', 'h4'],
        subheadline: ['h2', 'h3', 'h4', 'h5'],
        cta: ['a', 'button', '[role="button"]'],
        body: ['p', 'span', 'div', 'li'],
        hero: ['h1', 'h2', 'p', 'span', 'div'],
      };

      const tags = typeToTags[change.type] || ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'span', 'div'];
      const normalizedOriginal = change.original.replace(/\s+/g, ' ').trim().toLowerCase();
      // Collapsed version strips ALL whitespace for fuzzy matching
      const collapsedOriginal = normalizedOriginal.replace(/\s/g, '');

      // Strategy 1: Search by element type
      for (const tag of tags) {
        $(tag).each((_, el) => {
          if (found) return;
          // Use spaced text extraction (joins child texts with spaces)
          const elText = getTextWithSpaces($, el);
          const normalizedElText = elText.toLowerCase();
          const collapsedElText = normalizedElText.replace(/\s/g, '');

          const isMatch =
            normalizedElText === normalizedOriginal ||
            collapsedElText === collapsedOriginal ||
            normalizedElText.includes(normalizedOriginal) ||
            normalizedOriginal.includes(normalizedElText) ||
            (normalizedElText.length > 5 && similarity(normalizedElText, normalizedOriginal) > 0.5) ||
            (change.type === 'cta' && normalizedElText.length < 40 && wordOverlap(normalizedElText, normalizedOriginal) > 0.5);

          if (isMatch) {
            found = true;
            // Record the SPACED version for client-side matching
            verifiedChanges.push({
              original: elText,
              modified: change.modified,
              type: change.type,
            });
            appliedChanges.push(change);
          }
        });
        if (found) break;
      }

      // Strategy 2: Global text search
      if (!found) {
        $('*').each((_, el) => {
          if (found) return;
          if (['script', 'style', 'noscript', 'meta', 'link'].includes(
            ($(el).prop('tagName') || '').toLowerCase()
          )) return;

          const elText = getTextWithSpaces($, el);
          const collapsedEl = elText.toLowerCase().replace(/\s/g, '');
          if (elText.length > 0 && (
            similarity(elText.toLowerCase(), normalizedOriginal) > 0.6 ||
            collapsedEl === collapsedOriginal
          )) {
            found = true;
            verifiedChanges.push({
              original: elText,
              modified: change.modified,
              type: change.type,
            });
            appliedChanges.push(change);
          }
        });
      }

      if (!found) {
        appliedChanges.push({ ...change, rationale: `[Suggested] ${change.rationale}` });
      }
    } catch {
      // Skip failed changes
    }
  }

  // Build personalized HTML from the ORIGINAL (not Cheerio-serialized) HTML
  let html = originalHtml;

  // Strip existing <base> tags (orchestrator injects its own)
  html = html.replace(/<base\b[^>]*\/?>/gi, '');

  // Strip ALL CSP meta tags (any attribute order) that block inline scripts
  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy[^"']*["'][^>]*>/gi, '');
  // Also strip nonce requirements from remaining script-related CSP
  html = html.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');

  // PRIMARY: Direct HTML text replacement (works even when CSP blocks scripts)
  if (verifiedChanges.length > 0) {
    html = applyDirectReplacements(html, verifiedChanges);
  }

  // FALLBACK: Also inject client-side script for SPA/dynamically-rendered content
  if (verifiedChanges.length > 0) {
    const script = buildModificationScript(verifiedChanges);
    const bodyCloseMatch = html.match(/<\/body>/i);
    if (bodyCloseMatch && bodyCloseMatch.index !== undefined) {
      html = html.slice(0, bodyCloseMatch.index) + script + html.slice(bodyCloseMatch.index);
    } else {
      html += script;
    }
  }

  return { html, appliedChanges };
}

/**
 * Apply text replacements directly in the HTML string. 
 * This is the PRIMARY approach — works even when CSP blocks inline scripts.
 * 
 * Strategy:
 * 1. Try exact string replacement (text appears as-is in HTML)
 * 2. Try regex replacement that allows HTML tags between words
 *    (handles <span>Be the next</span><span>big thing</span>)
 * 3. Try replacing just the first occurrence of the text in tag content
 */
function applyDirectReplacements(
  html: string,
  changes: { original: string; modified: string; type: string }[]
): string {
  for (const change of changes) {
    const orig = change.original.trim();
    if (!orig || orig.length < 3) continue;

    // Strategy 1: Exact text replacement (most common case)
    if (html.includes(orig)) {
      html = html.replace(orig, change.modified);
      continue;
    }

    // Strategy 2: Build a regex that matches the text with HTML tags between words.
    // "Be the next big thing" → matches "Be the next</span><span>big thing"
    // or "Be the next</span> <span>big thing" etc.
    try {
      const words = orig.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2) {
        // Each word is literal, with optional HTML tags + whitespace between them
        const escapedWords = words.map(w => escapeRegExp(w));
        const tagGap = '(?:\\s*<[^>]*>\\s*)*\\s*';  // zero or more HTML tags with optional whitespace
        const pattern = new RegExp(escapedWords.join(tagGap), 'i');
        const match = html.match(pattern);
        if (match && match.index !== undefined) {
          // Find the enclosing tag to replace its full inner content
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          
          // Look backwards for the nearest opening tag
          const beforeMatch = html.substring(Math.max(0, matchStart - 200), matchStart);
          const openTagMatch = beforeMatch.match(/.*(<(?:h[1-6]|p|a|button|span|div|li)\b[^>]*>)/i);
          
          if (openTagMatch && openTagMatch[1]) {
            const tagStart = matchStart - (beforeMatch.length - beforeMatch.lastIndexOf(openTagMatch[1]));
            const tagName = openTagMatch[1].match(/<(\w+)/)?.[1] || '';
            
            if (tagName) {
              // Find closing tag after the match
              const afterMatch = html.substring(matchEnd);
              const closePattern = new RegExp(`((?:\\s*<[^>]*>\\s*)*</${tagName}>)`, 'i');
              const closeMatch = afterMatch.match(closePattern);
              
              if (closeMatch && closeMatch.index !== undefined) {
                // Replace everything between opening and closing tag
                const fullEnd = matchEnd + closeMatch.index + closeMatch[0].length;
                const openTag = openTagMatch[1];
                const closeTag = `</${tagName}>`;
                html = html.substring(0, tagStart < 0 ? matchStart : tagStart + beforeMatch.lastIndexOf(openTagMatch[1])) +
                  openTag + change.modified + closeTag +
                  html.substring(fullEnd);
                continue;
              }
            }
          }
          
          // Fallback: just replace the matched segment
          html = html.substring(0, matchStart) + change.modified + html.substring(matchEnd);
          continue;
        }
      }
    } catch {
      // Regex failed, try next strategy
    }

    // Strategy 3: Case-insensitive exact match
    const lowerHtml = html.toLowerCase();
    const lowerOrig = orig.toLowerCase();
    const idx = lowerHtml.indexOf(lowerOrig);
    if (idx !== -1) {
      html = html.substring(0, idx) + change.modified + html.substring(idx + orig.length);
    }
  }
  return html;
}

/**
 * Extract text from an element, adding spaces between child elements.
 * Cheerio's .text() concatenates children without separators (e.g., 
 * <h1><span>Be the next</span><span>big thing</span></h1> → "Be the nextbig thing").
 * This function returns "Be the next big thing" instead.
 */
function getTextWithSpaces($: cheerio.CheerioAPI, el: any): string {
  const parts: string[] = [];
  $(el).contents().each((_, node) => {
    if (node.type === 'text') {
      const d = (node as any).data?.trim();
      if (d) parts.push(d);
    } else if (node.type === 'tag') {
      const childText = getTextWithSpaces($, node);
      if (childText) parts.push(childText);
    }
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build a self-contained script that modifies text nodes in the live DOM.
 * Runs on DOMContentLoaded + retries to catch SPA-rendered content.
 */
function buildModificationScript(
  changes: { original: string; modified: string; type: string }[]
): string {
  // Escape JSON for safe inline <script> embedding
  const safeJson = JSON.stringify(changes)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  return `
<script data-ad-personalization="true">
(function(){
  var changes=${safeJson};
  var applied={};

  function normalize(s){return (s||'').replace(/\\s+/g,' ').trim()}
  function normLower(s){return normalize(s).toLowerCase()}
  function collapse(s){return normLower(s).replace(/\\s/g,'')}

  function textMatch(a,b){
    if(a===b) return true;
    // Collapsed match: ignore all whitespace differences
    if(collapse(a)===collapse(b)) return true;
    if(a.length>5&&(a.indexOf(b)!==-1||b.indexOf(a)!==-1)) return true;
    return false;
  }

  function applyChanges(){
    changes.forEach(function(c,i){
      if(applied[i]) return;
      var origL=normLower(c.original);
      if(!origL) return;

      // Strategy A: Element-level matching using innerText (handles child spans)
      var tags=c.type==='headline'?'h1,h2,h3,h4':c.type==='subheadline'?'h2,h3,h4,h5':c.type==='cta'?'a,button,[role=button]':'p,span,div,li';
      var allTags='h1,h2,h3,h4,h5,h6,p,a,button,span,div,li';
      var els=document.querySelectorAll(tags);
      for(var j=0;j<els.length;j++){
        var et=normLower(els[j].innerText||els[j].textContent);
        if(textMatch(et,origL)){
          var target=els[j];
          while(target.children.length===1&&textMatch(normLower(target.children[0].innerText||target.children[0].textContent),et)){
            target=target.children[0];
          }
          if(target.children.length===0){
            target.textContent=c.modified;
          }else{
            // Put the replacement text into the first text node, clear the rest
            var tw2=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,null);
            var firstText=tw2.nextNode();
            if(firstText){
              firstText.textContent=c.modified;
              var remaining;
              while(remaining=tw2.nextNode()){remaining.textContent='';}
            }
          }
          applied[i]=true;
          break;
        }
      }

      // Strategy B: TreeWalker on individual text nodes
      if(!applied[i]){
        var tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
        var node;
        while(node=tw.nextNode()){
          var t=normLower(node.textContent);
          if(!t) continue;
          if(textMatch(t,origL)){
            node.textContent=c.modified;
            applied[i]=true;
            break;
          }
        }
      }

      // Strategy C: Broadest search using all common tags
      if(!applied[i]){
        var broadEls=document.querySelectorAll(allTags);
        for(var k=0;k<broadEls.length;k++){
          var bt=normLower(broadEls[k].innerText||broadEls[k].textContent);
          if(bt===origL){
            var bTarget=broadEls[k];
            while(bTarget.children.length===1&&normLower(bTarget.children[0].innerText||bTarget.children[0].textContent)===bt){
              bTarget=bTarget.children[0];
            }
            if(bTarget.children.length===0){
              bTarget.textContent=c.modified;
            }else{
              var tw3=document.createTreeWalker(bTarget,NodeFilter.SHOW_TEXT,null);
              var ft=tw3.nextNode();
              if(ft){ft.textContent=c.modified;var r;while(r=tw3.nextNode()){r.textContent='';}}
            }
            applied[i]=true;
            break;
          }
        }
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyChanges);
  }else{
    applyChanges();
  }
  setTimeout(applyChanges,1000);
  setTimeout(applyChanges,3000);
  setTimeout(applyChanges,6000);
})();
<\/script>`;
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
