import { NextResponse } from 'next/server';
import { createPool } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      return NextResponse.json({ success: true, message: 'Mock verify successful' });
    }

    const { id, password } = await request.json();

    if (!id || !password) {
      return NextResponse.json({ success: false, error: 'id와 password는 필수입니다.' }, { status: 400 });
    }

    const pool = createPool({ connectionString });

    const { rows } = await pool.sql`
      SELECT password_hash FROM models 
      WHERE id = ${id};
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: '모델을 찾을 수 없습니다.' }, { status: 404 });
    }

    const storedHash = rows[0].password_hash;
    const isMatch = await bcrypt.compare(password, storedHash);

    if (isMatch) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

  } catch (error: any) {
    console.error('Verify Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
