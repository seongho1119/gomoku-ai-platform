import { NextResponse } from 'next/server';
import { createClient } from '@vercel/postgres';

export async function GET() {
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    // Fallback if Vercel Postgres/Neon is not yet configured by the user
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

    // Try to query the real database
    const { rows } = await client.sql`SELECT * FROM models ORDER BY created_at DESC;`;
    
    // Close the connection explicitly when using createClient (if needed, though in edge/serverless it's often cached)
    await client.end();
    
    return NextResponse.json(rows);
  } catch (error) {
    // If table doesn't exist yet (first run), return empty or mock
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

    const { name, author, winrate, modelUrl } = await request.json();
    
    const client = createClient({ connectionString: dbUrl });
    await client.connect();

    // Ensure table exists
    await client.sql`
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

    const result = await client.sql`
      INSERT INTO models (name, author, winrate, model_url) 
      VALUES (${name}, ${author}, ${winrate}, ${modelUrl || null})
      RETURNING *;
    `;

    await client.end();
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
