'use client';

import { useState, useEffect } from 'react';
import { Download, Star, Loader2, Play, Lock, ChevronRight, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Model {
  id: number;
  name: string;
  author: string;
  winrate: number;
  downloads: number;
}

export default function HubPage() {
  const router = useRouter();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const openContinueTraining = (model: Model) => {
    setSelectedModel(model);
    setPasswordInput('');
    setErrorMsg('');
    setShowPasswordModal(true);
  };

  const handleVerify = async () => {
    if (!selectedModel || !passwordInput.trim()) return;
    
    setVerifying(true);
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/models/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedModel.id,
          password: passwordInput
        })
      });
      
      const data = await res.json();
      if (data.success) {
        // Successfully authenticated! 
        // In a real app, we would download the model weights here.
        // For now, we simulate loading their brain.
        localStorage.setItem('gomoku-ai-brainSize', 'standard'); 
        alert(`Authentication successful! Welcome back, ${selectedModel.author}.`);
        router.push('/studio');
      } else {
        setErrorMsg('Incorrect password.');
      }
    } catch (err) {
      setErrorMsg('Error verifying password.');
    } finally {
      setVerifying(false);
    }
  };

  const handleRandomMatch = () => {
    if (models.length === 0) return;
    const randomModel = models[Math.floor(Math.random() * models.length)];
    router.push(`/arena?model=${randomModel.id}`);
  };

  return (
    <div className="max-w-4xl mx-auto relative">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Model Hub</h1>
          <p className="text-slate-400">Discover and challenge Gomoku AIs created by the community.</p>
        </div>
        <button 
          onClick={handleRandomMatch}
          disabled={models.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 px-6 rounded-xl font-bold flex items-center gap-2 transition-colors"
        >
          <Shuffle className="w-5 h-5" /> Random Match
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
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
              
              <div className="flex gap-2 mt-6">
                <Link href={`/arena?model=${model.id}`} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2 px-3 rounded-lg font-bold text-sm text-center flex items-center justify-center gap-1 transition-colors">
                  <Play className="w-4 h-4" /> Challenge
                </Link>
                <button 
                  onClick={() => openContinueTraining(model)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-colors"
                >
                  <Lock className="w-4 h-4" /> Continue Training
                </button>
              </div>
            </div>
          ))}
          {models.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500 glass-panel rounded-2xl">
              No models uploaded yet. Be the first to train and upload one from the Studio!
            </div>
          )}
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && selectedModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Continue Training</h3>
            <p className="text-slate-400 text-sm mb-6">Enter the password for <strong className="text-white">{selectedModel.name}</strong> to load it into your Studio.</p>
            
            <input 
              type="password"
              placeholder="Password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white mb-2 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {errorMsg && <p className="text-red-400 text-sm mb-4">{errorMsg}</p>}
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleVerify}
                disabled={verifying || !passwordInput.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
