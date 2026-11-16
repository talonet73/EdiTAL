import React,{useState,useEffect,useRef} from 'react';
import {Scissors,AudioLines,LoaderCircle,X,Undo2} from 'lucide-react';
import {DraggableWindow} from './DraggableWindow';
import type {TimelineClip,Track} from '../types/editor';
import type {AudioSettings} from '../services/audioMixer';
import type {CutRange} from '../services/smartCut';
export function SmartCutPanel({clips,tracks,master,language,onClose,onApply}:{clips:TimelineClip[];tracks:Track[];master:AudioSettings;language:string;onClose:()=>void;onApply:(ranges:CutRange[],warning?:string)=>void}){
  const [margin,setMargin]=useState(0.5),[fillers,setFillers]=useState(false),[retakes,setRetakes]=useState(false),[analysisLanguage,setAnalysisLanguage]=useState(language);
  const [flatSilence,setFlatSilence]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const version=JSON.stringify([clips,tracks,master]),currentVersion=useRef(version),alive=useRef(true),running=useRef(false);currentVersion.current=version;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const run=async()=>{
    if(running.current)return;running.current=true;setBusy(true);setError('');setStatus('Scansione di tutto l’audio…');const basis=currentVersion.current;
    try{
      const response=await fetch('/api/smart-cut',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clips,tracks,audioMaster:master,language:analysisLanguage,mode:'automatic',margin,flatSilence,fillers,retakes,durationSec:Math.max(0,...clips.map(c=>c.startTime+c.duration))})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Analisi non riuscita.');
      while(alive.current){
        const r=await fetch(`/api/captions/${result.jobId}`),j=await r.json();if(!r.ok||j.status==='error')throw new Error(j.error||'Analisi non riuscita.');
        if(j.status==='complete'){
          if(currentVersion.current!==basis)throw new Error('Il montaggio è cambiato durante la scansione. Premi di nuovo il pulsante per analizzare la versione aggiornata.');
          const ranges=(j.candidates||[]) as CutRange[];
          if(ranges.length){setStatus('Taglio automatico in corso…');onApply(ranges,j.warning);}else setStatus(flatSilence?'Scansione completata: nessun tratto a volume zero.':'Scansione completata: nessuna pausa supera il margine impostato.');
          if(j.warning)setError(j.warning);break;
        }
        setStatus(j.phase||'Scansione di tutto l’audio…');await new Promise(resolve=>setTimeout(resolve,500));
      }
    }catch(e){if(alive.current){setError((e as Error).message);setStatus('');}}
    finally{running.current=false;if(alive.current)setBusy(false);}
  };
  return <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center"><DraggableWindow as="section" role="dialog" aria-label="Montaggio intelligente" className="smart-cut-panel bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
    <header data-window-handle className="bg-gradient-to-r from-cyan-950/80 to-slate-900 border-b border-cyan-500/20"><strong className="flex items-center gap-2 text-cyan-300"><Scissors size={18}/> AI Cut · taglio automatico</strong><button aria-label="Chiudi montaggio intelligente" onClick={onClose} disabled={busy} className="hover:bg-rose-500/20 rounded-full p-1"><X size={16}/></button></header>
    <div className="p-5 space-y-5 text-sm">
      <div className="bg-slate-800/60 rounded-xl p-4 border border-cyan-500/20">
        <label className="block font-medium text-cyan-200 mb-2">Pausa da conservare: <output className="text-cyan-400 font-bold text-lg ml-1">{margin.toFixed(1)} s</output></label>
        <div className="relative">
          <input aria-label="Margine pause" type="range" min="0.1" max="5" step="0.1" value={margin} disabled={busy||flatSilence} onChange={e=>setMargin(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-500/50 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"/>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0.1s</span><span>2.5s</span><span>5s</span></div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Trascina la levetta per scegliere quanti secondi di pausa lasciare. Pause più lunghe vengono accorciate.</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" aria-label="Automatico volume zero" checked={flatSilence} disabled={busy} onChange={e=>setFlatSilence(e.target.checked)} className="accent-cyan-500"/> <span>Automatico · taglia i tratti a volume zero</span></label>
      {flatSilence&&<p className="text-xs text-slate-400 bg-slate-800/40 p-2 rounded">Rimuove i tratti di silenzio digitale di almeno 30 ms, conservando 5 ms ai bordi. Le voci a basso volume non vengono considerate silenzio.</p>}
      {!flatSilence&&<p className="text-xs text-slate-400">Ogni pausa più lunga del valore scelto viene accorciata, distribuendo il margine ai due lati. Analizza tutto l’audio, anche piste in Mute.</p>}
      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2"><input type="checkbox" aria-label="Elimina esitazioni" checked={fillers} disabled={busy} onChange={e=>setFillers(e.target.checked)} className="accent-amber-500"/> Elimina anche ehm/uhm riconosciuti</label>
        <label className="flex items-center gap-2"><input type="checkbox" aria-label="Elimina ciak e ripetizioni" checked={retakes} disabled={busy} onChange={e=>setRetakes(e.target.checked)} className="accent-amber-500"/> Elimina anche ciak e ripetizioni riconosciuti</label>
      </div>
      {(fillers||retakes)&&<div className="bg-slate-800/50 p-3 rounded-lg"><label className="block text-xs mb-1">Lingua <select aria-label="Lingua analisi" disabled={busy} value={analysisLanguage} onChange={e=>setAnalysisLanguage(e.target.value)} className="ml-2 bg-slate-700 border border-slate-600 rounded px-2 py-1">{['Italian','English','Spanish','French','German','Japanese','Auto'].map(l=><option key={l}>{l}</option>)}</select></label><p className="text-[11px] text-slate-400">Usa Whisper. I tagli sono annullabili con Indietro.</p></div>}
      <button className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 font-bold py-3 rounded-xl shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50" disabled={busy||!clips.some(c=>c.type==='audio'||c.type==='video')} onClick={run}>{busy?<LoaderCircle size={18} className="animate-spin"/>:<AudioLines size={18}/>} {busy?'Scansione e taglio in corso…':'Scansiona e taglia automaticamente'}</button>
      {status&&<p role="status" className="text-cyan-300 text-sm">{status}</p>}{error&&<p role="alert" className="text-rose-400 text-sm">{error}</p>}
      <p className="flex items-center gap-2 text-[11px] text-slate-400"><Undo2 size={15}/> Nessuna conferma aggiuntiva. Video e audio restano sincronizzati; Indietro annulla i tagli. I file originali restano invariati.</p>
    </div>
  </DraggableWindow></div>;
}
