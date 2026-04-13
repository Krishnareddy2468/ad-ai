import { NextRequest, NextResponse } from 'next/server';
import { scrapePage, extractPageStructure } from '@/lib/scraper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const { html, text, title } = await scrapePage(url);
    const elements = extractPageStructure(html);

    return NextResponse.json({
      success: true,
      data: { html, title, elements, textLength: text.length },
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scrape page' },
      { status: 500 }
    );
  }
}
