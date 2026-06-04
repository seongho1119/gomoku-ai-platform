'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cpu, Home, UploadCloud, Swords, Zap, User, LogOut, LogIn } from 'lucide-react';
import { useTraining } from '@/context/TrainingContext';
import { useAuth } from '@/hooks/useAuth';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

export default function Navbar() {
  const pathname = usePathname();
  const { isAutoTraining, sessionAutoEpisodes, stopAutoTraining } = useTraining();
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  const navLinks = [
    { href: '/',       label: '홈',       icon: Home },
    { href: '/studio', label: '스튜디오', icon: Cpu },
    { href: '/hub',    label: '허브',     icon: UploadCloud },
    { href: '/arena',  label: '아레나',   icon: Swords },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 glass-panel border-b-0 border-x-0 border-t-0 rounded-b-2xl mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">
              <Cpu className="w-6 h-6 text-blue-400" />
              <span>오목 AI</span>
            </Link>

            <div className="flex items-center gap-2">
              {/* 백그라운드 학습 표시기 */}
              {isAutoTraining && (
                <button
                  onClick={stopAutoTraining}
                  className="flex items-center gap-2 bg-emerald-500/20 hover:bg-red-500/20 border border-emerald-500/40 hover:border-red-500/40 text-emerald-400 hover:text-red-400 px-3 py-1.5 rounded-full text-xs font-bold transition-all group"
                  title="클릭하여 학습 중지"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <Zap className="w-3 h-3" />
                  <span className="hidden sm:inline">학습 중 {sessionAutoEpisodes.toLocaleString()}판</span>
                  <span className="sm:hidden">{sessionAutoEpisodes.toLocaleString()}</span>
                  <span className="hidden group-hover:inline text-red-400">■ 중지</span>
                </button>
              )}

              {/* 데스크탑 네비 */}
              <div className="hidden md:flex space-x-1 border border-white/10 p-1 rounded-xl bg-black/20">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all ${
                      pathname === link.href
                        ? 'bg-emerald-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <link.icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>

              {/* 계정 버튼 */}
              {user ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-300">{user.username}</span>
                  <button onClick={logout} title="로그아웃" className="ml-1 text-slate-500 hover:text-red-400 transition-colors">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" /> 로그인
                </button>
              )}

              {/* 모바일 네비 */}
              <div className="flex md:hidden space-x-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`p-2 rounded-lg transition-all ${
                      pathname === link.href
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <link.icon className="w-5 h-5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
