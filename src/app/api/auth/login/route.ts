import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

function getPool() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;
  return createPool({ connectionString });
}

async function ensureUsersTable(pool: ReturnType<typeof createPool>) {
  await pool.sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username?.trim() || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) {
      // DB 없음 — 개발 환경 mock
      return NextResponse.json({ success: true, userId: 1, username: username.trim() });
    }

    await ensureUsersTable(pool);

    const { rows } = await pool.sql`
      SELECT id, username, password_hash FROM users
      WHERE username = ${username.trim()};
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: '존재하지 않는 아이디입니다.' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, rows[0].password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, userId: rows[0].id, username: rows[0].username });
  } catch (error: any) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: `로그인 오류: ${error.message}` }, { status: 500 });
  }
}
