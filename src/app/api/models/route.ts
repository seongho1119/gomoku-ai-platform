import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

function getPool() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;
  return createPool({ connectionString });
}

async function ensureSchema(pool: any) {
  try {
    const { rows: tableCheck } = await pool.sql`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'models';
    `;
    if (tableCheck.length > 0) {
      const { rows: colCheck } = await pool.sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'models' AND column_name = 'user_id';
      `;
      if (colCheck.length === 0) {
        console.log('[Migration] 기존 models 테이블에 user_id 컬럼이 없으므로 DROP합니다.');
        await pool.sql`DROP TABLE IF EXISTS models CASCADE;`;
      }
    }
  } catch (err) {
    console.error('[Migration Error] ensureSchema 실패:', err);
  }
}

// ─── GET: 전체 모델 목록 ──────────────────────────────────────────────────────
export async function GET() {
  try {
    const pool = getPool();
    if (!pool) {
      return NextResponse.json([
        { id: 1, name: 'AlphaGomoku v1', author: 'DeepMindFan', winrate: 92, downloads: 1205 },
        { id: 2, name: 'Defensive Bot',  author: 'TurtleMaster', winrate: 68, downloads: 890 },
      ]);
    }
    await ensureSchema(pool);

    // models + users JOIN (username을 author로 사용)
    const { rows } = await pool.sql`
      SELECT m.id, u.username AS author, m.winrate, m.downloads, m.model_url, m.created_at
      FROM models m
      LEFT JOIN users u ON m.user_id = u.id
      ORDER BY m.winrate DESC, m.created_at DESC;
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('GET Error:', error);
    return NextResponse.json([]);
  }
}

// ─── POST: 내 AI 업로드 (upsert) ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ success: true, message: 'Mock 업로드 성공' });
    }
    await ensureSchema(pool);

    const { username, winrate, modelUrl } = await request.json();

    if (!username) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // users 테이블에서 user_id 조회
    const { rows: users } = await pool.sql`
      SELECT id FROM users WHERE username = ${username};
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: '존재하지 않는 계정입니다.' }, { status: 401 });
    }
    const userId = users[0].id;

    // 테이블 초기화
    await pool.sql`
      CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        winrate NUMERIC DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        model_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Upsert: 계정당 1개
    const { rows } = await pool.sql`
      INSERT INTO models (user_id, winrate, model_url)
      VALUES (${userId}, ${winrate ?? 0}, ${modelUrl || null})
      ON CONFLICT (user_id)
      DO UPDATE SET winrate = EXCLUDED.winrate, model_url = EXCLUDED.model_url, created_at = NOW()
      RETURNING id, winrate, model_url;
    `;

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: 내 AI 삭제 ───────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ success: true, message: 'Mock 삭제 성공' });
    }
    await ensureSchema(pool);

    const { username, password } = await request.json();
    if (!username) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 사용자 인증
    const { rows: users } = await pool.sql`
      SELECT id, password_hash FROM users WHERE username = ${username};
    `;
    if (users.length === 0) {
      return NextResponse.json({ error: '존재하지 않는 계정입니다.' }, { status: 401 });
    }

    if (password) {
      const isMatch = await bcrypt.compare(password, users[0].password_hash);
      if (!isMatch) {
        return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
      }
    }

    const { rowCount } = await pool.sql`
      DELETE FROM models WHERE user_id = ${users[0].id};
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json({ error: '업로드된 AI가 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
