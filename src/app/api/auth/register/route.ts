import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

const hasDb = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username?.trim() || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }
    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ error: '아이디는 2~20자여야 합니다.' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9가-힣_]+$/.test(username)) {
      return NextResponse.json({ error: '아이디는 영문, 숫자, 한글, _ 만 사용 가능합니다.' }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
    }

    if (!hasDb) {
      // DB 없는 환경: 임시 모의 응답
      return NextResponse.json({ success: true, userId: 1, username: username.trim() });
    }

    // users 테이블 생성 (없을 경우)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username.trim()}, ${passwordHash})
      RETURNING id, username;
    `;

    return NextResponse.json({ success: true, userId: rows[0].id, username: rows[0].username });
  } catch (error: any) {
    if (error.message?.includes('unique') || error.code === '23505') {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
    }
    console.error('Register Error:', error);
    return NextResponse.json({ error: `서버 오류가 발생했습니다: ${error.message}` }, { status: 500 });
  }
}
