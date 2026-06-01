import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Fallback if Vercel Postgres is not yet configured by the user
    if (!process.env.POSTGRES_URL) {
      console.warn("POSTGRES_URL is not set. Returning mock data.");
      return NextResponse.json([
        { id: 1, name: "AlphaGomoku v1", author: "DeepMindFan", winrate: 92, downloads: 1205 },
        { id: 2, name: "Basic Q-Learning", author: "StudentJS", winrate: 45, downloads: 304 },
        { id: 3, name: "Defensive Bot", author: "TurtleMaster", winrate: 68, downloads: 890 },
      ]);
    }

    // Try to query the real database
    const { rows } = await sql`SELECT * FROM models ORDER BY created_at DESC;`;
    return NextResponse.json(rows);
  } catch (error) {
    // If table doesn't exist yet (first run), return empty or mock
    console.error('Database error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.POSTGRES_URL) {
      return NextResponse.json({ success: true, message: "Mock upload successful (No DB configured)" });
    }

    const { name, author, winrate, modelUrl } = await request.json();
    
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        winrate NUMERIC DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        model_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const result = await sql`
      INSERT INTO models (name, author, winrate, model_url) 
      VALUES (${name}, ${author}, ${winrate}, ${modelUrl || null})
      RETURNING *;
    `;

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
