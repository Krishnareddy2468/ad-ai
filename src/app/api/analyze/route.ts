import { NextRequest, NextResponse } from 'next/server';
import { analyzeAdCreative } from '@/lib/agents/adAnalyzer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, imageUrl } = body;

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: 'Either imageBase64 or imageUrl is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzeAdCreative({ imageBase64, imageUrl });

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Ad analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze ad creative' },
      { status: 500 }
    );
  }
}
