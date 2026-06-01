'use client';

import Link from 'next/link';
import { Cpu, Home, UploadCloud, Swords, Globe } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Navbar() {
  const { t, language, toggleLanguage } = useLanguage();

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b-0 border-x-0 border-t-0 rounded-b-2xl mb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">
              <Cpu className="w-6 h-6 text-blue-400" />
              <span>Gomoku AI</span>
            </Link>
          </div>
          <div className="flex space-x-4 items-center">
            <Link href="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
              <Home className="w-4 h-4" /> {t('home')}
            </Link>
            <Link href="/studio" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
              <Cpu className="w-4 h-4" /> {t('studio')}
            </Link>
            <Link href="/hub" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
              <UploadCloud className="w-4 h-4" /> {t('hub')}
            </Link>
            <Link href="/arena" className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors border border-primary/30">
              <Swords className="w-4 h-4" /> {t('arena')}
            </Link>
            <button onClick={toggleLanguage} className="text-gray-400 hover:text-white ml-4 flex items-center gap-1 transition-colors text-sm font-bold bg-white/10 px-2 py-1 rounded">
              <Globe className="w-4 h-4" /> {language === 'en' ? 'EN' : '한국어'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
