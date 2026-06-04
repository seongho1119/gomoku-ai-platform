'use client';

import { useState } from 'react';
import { X, User, Lock, LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력하세요.'); return;
    }
    if (tab === 'register' && username.length < 2) {
      setError('아이디는 2자 이상이어야 합니다.'); return;
    }
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.'); return;
    }

    setLoading(true);
    const fn = tab === 'login' ? login : register;
    const result = await fn(username.trim(), password);
    setLoading(false);

    if (result.success) {
      if (tab === 'register') {
        setSuccess('가입 완료! 이제 AI를 업로드할 수 있어요 🎉');
        setTimeout(onClose, 1200);
      } else {
        onClose();
      }
    } else {
      setError(result.error || '오류가 발생했습니다.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold">
            {tab === 'login' ? '🔐 로그인' : '🤖 회원가입'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex mx-6 mb-5 bg-slate-800 rounded-xl p-1">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccess(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'login' ? <><LogIn className="w-3.5 h-3.5" /> 로그인</> : <><UserPlus className="w-3.5 h-3.5" /> 회원가입</>}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          {/* 아이디 */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-emerald-500/60 text-sm"
            />
          </div>

          {/* 비밀번호 */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              maxLength={50}
              className="w-full bg-slate-800 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-white placeholder-slate-500 outline-none focus:border-emerald-500/60 text-sm"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* 에러/성공 메시지 */}
          {error && <p className="text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-emerald-400 text-xs bg-emerald-400/10 rounded-lg px-3 py-2">{success}</p>}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-1"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 처리 중...</>
              : tab === 'login'
                ? <><LogIn className="w-4 h-4" /> 로그인</>
                : <><UserPlus className="w-4 h-4" /> 가입하기</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
