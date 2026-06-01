'use client';

import Link from "next/link";
import { Cpu, UploadCloud, Swords } from "lucide-react";
import { useLanguage } from '@/context/LanguageContext';

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
        {t('heroTitle')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-500">Gomoku</span> {t('heroTitle2')}
      </h1>
      <p className="text-xl text-slate-300 mb-12 max-w-2xl">
        {t('heroSubtitle')}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <Link href="/studio" className="glass-panel p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300 group cursor-pointer text-left">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/40 transition-colors">
            <Cpu className="w-6 h-6 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('studioTitle')}</h2>
          <p className="text-slate-400">{t('studioDesc')}</p>
        </Link>
        
        <Link href="/hub" className="glass-panel p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300 group cursor-pointer text-left">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/40 transition-colors">
            <UploadCloud className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('hubTitle')}</h2>
          <p className="text-slate-400">{t('hubDesc')}</p>
        </Link>
        
        <Link href="/arena" className="glass-panel p-8 rounded-2xl hover:-translate-y-2 transition-transform duration-300 group cursor-pointer text-left relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/40 transition-colors relative z-10">
            <Swords className="w-6 h-6 text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('arenaTitle')}</h2>
          <p className="text-slate-400 relative z-10">{t('arenaDesc')}</p>
        </Link>
      </div>
    </div>
  );
}
