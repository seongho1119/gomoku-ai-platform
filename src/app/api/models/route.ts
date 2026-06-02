import { NextResponse } from 'next/server';
import { createClient } from '@vercel/postgres';

export async function GET() {
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn("Database URL is not set. Returning mock data.");
      return NextResponse.json([
        { id: 1, name: "AlphaGomoku v1", author: "DeepMindFan", winrate: 92, downloads: 1205 },
        { id: 2, name: "Basic Q-Learning", author: "StudentJS", winrate: 45, downloads: 304 },
        { id: 3, name: "Defensive Bot", author: "TurtleMaster", winrate: 68, downloads: 890 },
      ]);
    }

    const client = createClient({ connectionString: dbUrl });
    await client.connect();

    // Do not return the password field to the client
    const { rows } = await client.sql`
      SELECT id, name, author, winrate, downloads, model_url, created_at 
      FROM models 
      ORDER BY created_at DESC;
    `;
    
    await client.end();
    
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ success: true, message: "Mock upload successful (No DB configured)" });
    }

    const { name, author, password, winrate, modelUrl } = await request.json();
    
    const client = createClient({ connectionString: dbUrl });
    await client.connect();

    // Ensure table exists with password column
    await client.sql`
      CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        password VARCHAR(255) DEFAULT '',
        winrate NUMERIC DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        model_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Try to add password column if migrating from old schema
    try {
      await client.sql`ALTER TABLE models ADD COLUMN password VARCHAR(255) DEFAULT '';`;
    } catch (e) {
      // Column already exists, ignore
    }

    const result = await client.sql`
      INSERT INTO models (name, author, password, winrate, model_url) 
      VALUES (${name}, ${author}, ${password || ''}, ${winrate}, ${modelUrl || null})
      RETURNING id, name, author, winrate, downloads, model_url, created_at;
    `;

    await client.end();
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
