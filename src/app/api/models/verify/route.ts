import { NextResponse } from 'next/server';
import { createClient } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      // Mock logic for development
      return NextResponse.json({ success: true, message: "Mock verify successful" });
    }

    const { id, password } = await request.json();
    
    const client = createClient({ connectionString: dbUrl });
    await client.connect();

    // Check if password matches
    const { rows } = await client.sql`
      SELECT id FROM models 
      WHERE id = ${id} AND password = ${password};
    `;

    await client.end();

    if (rows.length > 0) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Incorrect password" }, { status: 401 });
    }

  } catch (error: any) {
    console.error('Verify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
