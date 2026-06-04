import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('BLOB_READ_WRITE_TOKEN 미설정 — 업로드 시뮬레이션');
      return NextResponse.json({
        success: true,
        message: '시뮬레이션 업로드 완료 (Blob 미설정)',
        urls: [],
        modelUrl: null,
      });
    }

    const modelName = formData.get('modelName')?.toString() || `model_${Date.now()}`;
    const uploadedUrls: { filename: string; url: string }[] = [];

    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const safeName = value.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const blobPath = `gomoku-models/${modelName}/${Date.now()}-${safeName}`;

        // Private 스토어 → access: 'private' 사용
        const blob = await put(blobPath, value, {
          access: 'private',
          contentType: value.type || 'application/octet-stream',
        });

        // private blob은 blob.url (만료 포함) 또는 downloadUrl 사용
        uploadedUrls.push({ filename: value.name, url: blob.url });
      }
    }

    const modelJsonEntry = uploadedUrls.find(f => f.filename === 'model.json');
    const modelJsonUrl = modelJsonEntry?.url || uploadedUrls[0]?.url || null;

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
      modelUrl: modelJsonUrl,
    });

  } catch (error: any) {
    console.error('Blob Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
