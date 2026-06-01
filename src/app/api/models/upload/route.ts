import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Fallback if Vercel Blob is not configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn("BLOB_READ_WRITE_TOKEN is not set. Simulating upload.");
      return NextResponse.json({ success: true, message: "Simulated upload complete." });
    }

    const uploadedUrls: string[] = [];

    // TF.js sends multiple files, e.g., 'model.json' and 'model.weights.bin'
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Upload to Vercel Blob
        const blob = await put(`models/${Date.now()}-${value.name}`, value, {
          access: 'public',
        });
        uploadedUrls.push(blob.url);
      }
    }

    return NextResponse.json({ 
      success: true, 
      urls: uploadedUrls 
    });

  } catch (error: any) {
    console.error('Blob Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
