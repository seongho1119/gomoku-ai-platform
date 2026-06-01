'use client';

import { useState, useEffect } from 'react';
import { Download, Star, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Model {
  id: number;
  name: string;
  author: string;
  winrate: number;
  downloads: number;
}

export default function HubPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        setModels(data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Model Hub</h1>
          <p className="text-slate-400">Discover and challenge Gomoku AIs created by the community.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {models.map(model => (
            <div key={model.id} className="glass-panel p-6 rounded-2xl flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{model.name}</h2>
                  <p className="text-slate-400 text-sm">by {model.author}</p>
                </div>
                <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Star className="w-4 h-4" /> {Math.round(model.winrate)}% WR
                </div>
              </div>
              
              <div className="flex-grow"></div>
              
              <div className="flex gap-3 mt-6">
                <Link href={`/arena?model=${model.id}`} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2 px-4 rounded-lg font-bold text-center transition-colors">
                  Challenge
                </Link>
                <button className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
                  <Download className="w-4 h-4" /> {model.downloads}
                </button>
              </div>
            </div>
          ))}
          {models.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500">
              No models uploaded yet. Be the first!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
