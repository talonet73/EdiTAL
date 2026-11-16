import {DraggableWindow} from './DraggableWindow';
import React, { useEffect, useRef, useState } from 'react';
import { Youtube, X } from 'lucide-react';
import { importMediaFile } from '../services/mediaService';
import type { MediaAsset } from '../types/editor';
export function YouTubeDialog({ onClose, onImported }: { onClose: () => void; onImported: (asset: MediaAsset) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const localFile = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  async function importLocal(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setLocalBusy(true); setError('');
    try {
      const asset = await importMediaFile(file);
      if (asset.type !== 'video') throw new Error('Scegli un file video locale.');
      if (mounted.current) { onImported(asset); onClose(); }
    } catch (error) { if (mounted.current) setError((error as Error).message); }
    finally { if (mounted.current) setLocalBusy(false); }
  }
  async function download(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/youtube/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossibile avviare il download.');
      while (mounted.current) {
        const statusResponse = await fetch(`/api/youtube/download/${result.jobId}`);
        const status = await statusResponse.json();
        if (!statusResponse.ok || status.status === 'error') throw new Error(status.error || 'Download fallito.');
        setProgress(status.progress);
        if (status.status === 'complete') { onImported(status.asset); onClose(); return; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) { if (mounted.current) setError((error as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="youtube-title">
    <DraggableWindow as="form" onSubmit={download} className="bg-slate-900/95 backdrop-blur-xl border border-red-500/40 rounded-2xl p-6 w-full max-w-lg space-y-4 text-sm shadow-2xl shadow-red-500/20">
      <div data-window-handle className="flex items-center justify-between border-b border-red-500/20 pb-3"><h2 id="youtube-title" className="font-bold flex items-center gap-2 text-red-300"><Youtube className="text-red-500" /> Importa da YouTube</h2><button type="button" aria-label="Chiudi YouTube" onClick={onClose} disabled={busy || localBusy} className="hover:bg-rose-500/20 rounded-full p-1"><X /></button></div>
      <p className="text-slate-300">Incolla un link YouTube. L’app scarica il video (migliore qualità disponibile) e lo aggiunge automaticamente allo stage.</p>
      <label className="block font-medium text-slate-200">Link del video
        <input autoFocus type="url" required value={url} onChange={e => setUrl(e.target.value)} disabled={busy || localBusy} placeholder="https://youtu.be/… o https://www.youtube.com/watch?v=…" className="mt-2 w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2.5 focus:outline-none focus:border-red-500" />
      </label>
      {busy && <div role="status" className="bg-slate-800/60 p-3 rounded-lg"><progress max="100" value={progress} className="w-full accent-red-500" /><div className="text-xs text-slate-400 mt-1">{progress > 0 ? `${progress.toFixed(0)}% — download e unione audio/video…` : 'Connessione a YouTube…'}</div></div>}
      {error && <p role="alert" className="text-rose-300 bg-rose-950/40 p-2 rounded">{error}</p>}
      <div className="border-t border-slate-700 pt-3 space-y-2">
        <p className="text-slate-400 text-xs">Se YouTube non è raggiungibile (proxy o anti-bot), puoi importare un video già presente sul tuo dispositivo.</p>
        <input ref={localFile} type="file" aria-label="File video locale" accept="video/*,.mkv,.mov,.avi" className="hidden" onChange={importLocal} />
        <button type="button" onClick={() => localFile.current?.click()} disabled={busy || localBusy} className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg py-2 font-bold">{localBusy ? 'Caricamento locale…' : 'Carica video locale'}</button>
      </div>
      <button disabled={busy || localBusy} className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 rounded-xl py-3 font-bold shadow-lg shadow-red-500/30 transition-all">{busy ? 'Download in corso…' : 'Scarica e importa nello stage'}</button>
    </DraggableWindow>
  </div>;
}
