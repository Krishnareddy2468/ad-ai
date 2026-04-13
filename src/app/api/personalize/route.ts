import { NextRequest, NextResponse } from 'next/server';
import { orchestrate } from '@/lib/agents/orchestrator';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, imageUrl, landingPageUrl } = body;

    if (!landingPageUrl) {
      return NextResponse.json({ error: 'Landing page URL is required' }, { status: 400 });
    }

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'Ad creative is required' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(landingPageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid landing page URL' }, { status: 400 });
    }

    // Run the full Planner → Executor → Verifier → Memory pipeline
    const result = await orchestrate({
      imageBase64,
      imageUrl,
      landingPageUrl,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Personalization error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to personalize page' },
      { status: 500 }
    );
  }
}
