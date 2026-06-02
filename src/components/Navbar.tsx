'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cpu, Home, UploadCloud, Swords } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: '홈', icon: Home },
    { href: '/studio', label: '스튜디오', icon: Cpu },
    { href: '/hub', label: '허브', icon: UploadCloud },
  ];

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b-0 border-x-0 border-t-0 rounded-b-2xl mb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">
              <Cpu className="w-6 h-6 text-blue-400" />
              <span>오목 AI</span>
            </Link>
          </div>
          
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
        </div>
      </div>
    </nav>
  );
}
