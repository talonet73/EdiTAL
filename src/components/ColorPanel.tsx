import React,{useEffect,useRef,useState} from 'react';
import {Play,Pause,RotateCcw,Palette,SlidersHorizontal,Spline,Power} from 'lucide-react';
import type {TimelineClip} from '../types/editor';
import {COLOR_CONTROLS,CURVE_X,curveValue,gradeValues,hasGrade,type ColorGrade,type ColorKey,type CurveChannel} from '../services/colorGrade';
import {drawScope,scopeData} from '../services/colorScopes';
import {playbackEngine} from '../services/playbackEngine';
import {timelineSubtitles} from '../services/captionClips';

type Control=typeof COLOR_CONTROLS[number];
function ColorKnob({control,value,onChange,disabled}:{control:Control;value:number;onChange:(n:number)=>void;disabled:boolean}){
  const [key,label,min,max,initial,step,unit]=control,drag=useRef<{y:number;value:number}|null>(null);
  const update=(n:number)=>onChange(Math.min(max,Math.max(min,Number((Math.round(n/step)*step).toFixed(5)))));
  return <div className="audio-knob-control"><span>{label}</span><div role="slider" tabIndex={disabled?-1:0} aria-disabled={disabled} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} className="audio-knob" title="Trascina su/giù; doppio clic per ripristinare"
    onPointerDown={e=>{if(disabled)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={y:e.clientY,value};}}
    onPointerMove={e=>{if(drag.current)update(drag.current.value+(drag.current.y-e.clientY)*(max-min)/180);}} onPointerUp={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onDoubleClick={()=>{if(!disabled)onChange(initial);}}
    onKeyDown={e=>{if(!disabled&&['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();update(e.key==='Home'?min:e.key==='End'?max:value+(['ArrowUp','ArrowRight'].includes(e.key)?step:-step)*(e.shiftKey?10:1));}}}>
    <i style={{transform:`rotate(${-135+(value-min)/(max-min)*270}deg)`}}/></div>
    <label className="audio-knob-value"><input type="number" aria-label={`${label} valore`} disabled={disabled} min={min} max={max} step={step} value={value} onChange={e=>{if(e.target.value!=='')update(Number(e.target.value));}}/>{unit}</label>
  </div>;
}
function Wheel({name,settings,onUpdate,disabled}:{name:'lift'|'gamma'|'gain'|'offset';settings:ColorGrade;onUpdate:(s:ColorGrade)=>void;disabled:boolean}){
  const title=name[0].toUpperCase()+name.slice(1),values=gradeValues(settings),rgb=['R','G','B'].map(c=>values[`${name}${c}` as ColorKey]),max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
  let hue=delta===0?0:max===rgb[0]?((rgb[1]-rgb[2])/delta)%6:max===rgb[1]?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4;hue*=Math.PI/3;
  const radius=Math.min(1,delta/100),x=50+Math.sin(hue)*radius*44,y=50-Math.cos(hue)*radius*44;
  const move=(event:React.PointerEvent<HTMLDivElement>)=>{
    const box=event.currentTarget.getBoundingClientRect(),dx=(event.clientX-box.left-box.width/2)/(box.width*.44),dy=(event.clientY-box.top-box.height/2)/(box.height*.44),sat=Math.min(1,Math.hypot(dx,dy)),h=((Math.atan2(dx,-dy)*180/Math.PI+360)%360)/60;
    const chroma=1-Math.abs(h%2-1),base=h<1?[1,chroma,0]:h<2?[chroma,1,0]:h<3?[0,1,chroma]:h<4?[0,chroma,1]:h<5?[chroma,0,1]:[1,0,chroma],mean=base.reduce((s,v)=>s+v,0)/3;
    onUpdate({...settings,...Object.fromEntries(base.map((v,i)=>[`${name}${['R','G','B'][i]}`,Math.round((v-mean)*sat*100)])),bypass:false});
  };
  return <article className="color-wheel-group"><strong>{title}</strong><div className="color-wheel" role="slider" aria-label={`Ruota ${title}`} aria-disabled={disabled} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={rgb[0]} aria-valuetext={`R ${rgb[0]}, G ${rgb[1]}, B ${rgb[2]}`} tabIndex={disabled?-1:0}
    onPointerDown={e=>{if(!disabled){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);move(e);}}} onPointerMove={e=>{if(!disabled&&e.buttons===1&&e.currentTarget.hasPointerCapture(e.pointerId))move(e);}}
    onDoubleClick={()=>{if(!disabled)onUpdate({...settings,...Object.fromEntries(['R','G','B'].map(c=>[`${name}${c}`,0])),bypass:false});}}
    onKeyDown={e=>{if(disabled)return;const channel=['ArrowLeft','ArrowRight'].includes(e.key)?'R':['ArrowUp','ArrowDown'].includes(e.key)?'B':null;if(channel){e.preventDefault();const key=`${name}${channel}` as ColorKey;onUpdate({...settings,[key]:Math.min(100,Math.max(-100,values[key]+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1))),bypass:false});}}}><span style={{left:`${x}%`,top:`${y}%`}}/></div>
    <div className="color-wheel-knobs">{COLOR_CONTROLS.filter(c=>c[0].startsWith(name)).map(c=><ColorKnob key={c[0]} control={c} value={values[c[0]]} disabled={disabled} onChange={value=>onUpdate({...settings,[c[0]]:value,bypass:false})}/>)}</div>
  </article>;
}
function Curves({settings,onUpdate,disabled}:{settings:ColorGrade;onUpdate:(s:ColorGrade)=>void;disabled:boolean}){
  const [channel,setChannel]=useState<CurveChannel>('master'),dragPoint=useRef<number|null>(null);const points=settings.curves?.[channel]||[...CURVE_X];
  const update=(index:number,value:number)=>{const next=[...points];next[index]=Math.max(0,Math.min(1,value));onUpdate({...settings,curves:{...settings.curves,[channel]:next},bypass:false});};
  // Coordinate esatte nel sistema dell'SVG (anche quando il grafico è centrato con bande laterali).
  const svgPoint=(e:React.PointerEvent<SVGSVGElement>)=>{const svg=e.currentTarget,pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM()!.inverse());return {x:p.x/400,y:1-p.y/200};};
  const path=Array.from({length:201},(_,i)=>`${i?'L':'M'}${i*2},${200-curveValue(i/200,points)*200}`).join(' ');
  return <div className="color-curves"><div className="color-curve-channels" role="radiogroup" aria-label="Canale curva">{([['master','Master RGB'],['red','Rosso'],['green','Verde'],['blue','Blu']] as const).map(([v,l])=><button key={v} type="button" role="radio" aria-checked={channel===v} className={`curve-chip curve-chip-${v}`} onClick={()=>setChannel(v)}><i/>{l}</button>)}</div>
    <svg viewBox="-8 -8 416 224" aria-label="Curva personalizzata" role="img" className={`curve-${channel}`} style={{touchAction:'none',cursor:'ns-resize'}}
      onPointerDown={e=>{if(disabled)return;e.preventDefault();const {x,y}=svgPoint(e);let index=0;CURVE_X.forEach((cx,i)=>{if(Math.abs(cx-x)<Math.abs(CURVE_X[index]-x))index=i;});dragPoint.current=index;e.currentTarget.setPointerCapture(e.pointerId);update(index,y);}}
      onPointerMove={e=>{if(dragPoint.current===null||!e.currentTarget.hasPointerCapture(e.pointerId))return;update(dragPoint.current,svgPoint(e).y);}}
      onPointerUp={()=>{dragPoint.current=null;}} onLostPointerCapture={()=>{dragPoint.current=null;}}
      onDoubleClick={()=>{if(!disabled)onUpdate({...settings,curves:{...settings.curves,[channel]:[...CURVE_X]}});}}><title>Trascina un punto su/giù; doppio clic per ripristinare la curva</title><rect x="0" y="0" width="400" height="200" fill="#090c14"/>{[0,.25,.5,.75,1].map(v=><g key={v} stroke="#303747"><path d={`M${v*400} 0V200 M0 ${v*200}H400`}/></g>)}<path d="M0 200L400 0" stroke="#5b6475" strokeDasharray="4 4"/><path d={path} stroke="currentColor" strokeWidth="2" fill="none"/>{points.map((y,i)=><circle key={i} cx={CURVE_X[i]*400} cy={(1-y)*200} r="6" fill="currentColor" stroke="#fff" strokeWidth="1.5"/>)}</svg>
    <div className="color-curve-points">{points.map((y,i)=><label key={i}>{Math.round(CURVE_X[i]*100)}%<input aria-label={`Curva ${channel} punto ${i+1}`} disabled={disabled} type="number" min="0" max="100" step="1" value={Math.round(y*100)} onChange={e=>{if(e.target.value!=='')update(i,Number(e.target.value)/100);}}/></label>)}</div>
    <button disabled={disabled} onClick={()=>onUpdate({...settings,curves:{...settings.curves,[channel]:[...CURVE_X]}})}>Ripristina curva {channel}</button>
  </div>;
}
interface Props {clips:TimelineClip[];selectedId:string|null;currentTime:number;duration:number;playing:boolean;aspectRatio:string;onSelect:(id:string)=>void;onUpdate:(id:string,grade:ColorGrade)=>void;onSeek:(n:number)=>void;onPlay:()=>void}
export function ColorPanel({clips,selectedId,currentTime,duration,playing,aspectRatio,onSelect,onUpdate,onSeek,onPlay}:Props){
  const [tab,setTab]=useState('Ruote'),[scopeSource,setScopeSource]=useState<'before'|'after'>('after'),[error,setError]=useState(''),[stats,setStats]=useState({min:0,max:0,black:0,white:0});
  const before=useRef<HTMLCanvasElement>(null),after=useRef<HTMLCanvasElement>(null),scopeRefs=useRef<(HTMLCanvasElement|null)[]>([]),last=useRef(0);
  const visual=clips.filter(c=>c.type==='video'||c.type==='image'),selected=visual.find(c=>c.id===selectedId);
  // Controlli sempre attivi: clip selezionata, altrimenti la clip sotto la testina, altrimenti una bozza locale
  // che viene applicata alla prima clip (senza correzione) che selezioni.
  const [draft,setDraft]=useState<ColorGrade>({});
  const target=selected||[...visual].reverse().find(c=>currentTime>=c.startTime&&currentTime<c.startTime+c.duration),settings=target?(target.colorGrade||{}):draft,values=gradeValues(settings);
  const update=(s:ColorGrade)=>{if(target)onUpdate(target.id,s);else setDraft(s);};
  useEffect(()=>{if(selected&&!hasGrade(selected.colorGrade)&&hasGrade(draft)){onUpdate(selected.id,draft);setDraft({});}},[selected?.id]);
  useEffect(()=>{
    let cancelled=false;const timestamp=performance.now();if(playing&&timestamp-last.current<90)return;last.current=timestamp;
    const render=async()=>{
      const b=before.current,a=after.current;if(!a||!b)return;
      const ratio=aspectRatio==='9:16'?9/16:aspectRatio==='1:1'?1:aspectRatio==='4:3'?4/3:16/9;for(const c of [a,b]){const w=Math.round(360*ratio);if(c.width!==w)c.width=w;if(c.height!==360)c.height=360;}
      const videos=clips.filter(c=>c.type==='video'),images=clips.filter(c=>c.type==='image'),effects=clips.filter(c=>c.type==='effect'),subtitles=timelineSubtitles(clips);
      try{
        await playbackEngine.prepareAndRenderFrame(a,currentTime,videos,effects,images,subtitles,()=>!cancelled);if(cancelled)return;
        const clean=(c:TimelineClip)=>({...c,effects:[],adjustments:{},colorGrade:undefined,mask:undefined});
        playbackEngine.renderFrame(b,currentTime,videos.map(clean),[],images.map(clean),subtitles);
        const sample=document.createElement('canvas');sample.width=320;sample.height=Math.max(1,Math.round(320/ratio));const ctx=sample.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(scopeSource==='before'?b:a,0,0,sample.width,sample.height);
        const s=scopeData(ctx.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);scopeRefs.current.forEach((c,i)=>{if(c)drawScope(c,(['wave','parade','hist','vector'] as const)[i],s);});setStats(s);setError('');
      }catch(e){if(!cancelled)setError(`Anteprima COLOR non disponibile: ${(e as Error).message}`);}
    };void render();return()=>{cancelled=true;};
  },[clips,currentTime,playing,aspectRatio,scopeSource]);
  return <section className="color-workspace" aria-label="Color grading">
    <header className="color-transport"><strong>COLOR</strong><button aria-label={playing?'Pausa COLOR':'Riproduci COLOR'} onClick={onPlay}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><output>{currentTime.toFixed(2)} s</output><input aria-label="Posizione COLOR" type="range" min={0} max={duration} step="0.01" value={currentTime} onChange={e=>onSeek(Number(e.target.value))}/><select aria-label="Clip da correggere" value={selected?.id||''} onChange={e=>{const c=visual.find(c=>c.id===e.target.value);if(c){onSelect(c.id);if(currentTime<c.startTime||currentTime>=c.startTime+c.duration)onSeek(c.startTime);}}}><option value="">Seleziona una clip video o immagine</option>{visual.map(c=><option key={c.id} value={c.id}>{c.name} · {c.startTime.toFixed(2)} s</option>)}</select></header>
    {error&&<p role="alert">{error}</p>}
    <div className="color-monitors"><figure><figcaption>ORIGINALE · senza effetti</figcaption><canvas data-testid="color-original" ref={before}/></figure><figure><figcaption>CORRETTO · effetti applicati</figcaption><canvas data-testid="color-corrected" ref={after}/></figure></div>
    <div className="color-lower"><div className="color-controls"><header><div role="tablist" aria-label="Controlli colore">{([['Ruote',Palette],['Primarie',SlidersHorizontal],['Curve',Spline]] as const).map(([t,Icon])=><button key={t} role="tab" className="color-tab-btn" aria-selected={tab===t} onClick={()=>setTab(t)}><Icon size={15}/><span>{t}</span></button>)}</div><div className="color-actions"><button className="color-action-btn" aria-label="Bypass COLOR" aria-pressed={!!settings.bypass} onClick={()=>update({...settings,bypass:!settings.bypass})}><Power size={13}/> Bypass</button><button className="color-action-btn" aria-label="Ripristina COLOR" onClick={()=>update({})}><RotateCcw size={13}/> Reset</button></div></header>
      <p className="color-help">{target?`Clip${selected?'':' sotto la testina'}: ${target.name} · trascina ruote o manopole (su/giù) · doppio clic per resettare`:'Nessuna clip qui: le regolazioni restano in bozza e vanno sulla prima clip che selezioni · doppio clic per resettare'}</p>
      <div className="color-control-scroll">{tab==='Ruote'?<div className="color-wheels">{(['lift','gamma','gain','offset'] as const).map(name=><Wheel key={name} name={name} settings={settings} onUpdate={update} disabled={false}/>)}</div>:tab==='Primarie'?<div className="color-primary-knobs">{COLOR_CONTROLS.slice(0,13).map(c=><ColorKnob key={c[0]} control={c} value={values[c[0]]} disabled={false} onChange={value=>update({...settings,[c[0]]:value,bypass:false})}/>)}</div>:<Curves settings={settings} disabled={false} onUpdate={update}/>}</div>
    </div><aside className="color-scopes" aria-label="Scopes colore"><header><strong>SCOPES · SDR Rec.709</strong><select aria-label="Sorgente scopes" value={scopeSource} onChange={e=>setScopeSource(e.target.value as 'before'|'after')}><option value="after">Corretto</option><option value="before">Originale</option></select></header><div className="color-scope-grid">{['Waveform Y · 0–100 IRE','Parade RGB · 0–100 IRE','Istogramma RGB · 0–255','Vectorscope Cb/Cr'].map((label,i)=><figure key={label}><figcaption>{label}</figcaption><canvas data-testid={`scope-${i}`} aria-label={label} width="320" height="156" ref={el=>{scopeRefs.current[i]=el;}}/></figure>)}</div><p data-testid="scope-stats">Y {Math.round(stats.min/255*100)}–{Math.round(stats.max/255*100)} IRE · Neri {stats.black.toFixed(1)}% · Bianchi {stats.white.toFixed(1)}%</p><small>Misura del fotogramma visualizzato, gamma SDR a 8 bit, intervallo completo.</small></aside></div>
  </section>;
}
