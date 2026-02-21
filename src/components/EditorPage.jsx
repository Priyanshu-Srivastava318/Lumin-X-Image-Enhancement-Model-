import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Download, Save, Play, RefreshCw, Info, Check, Zap, BookOpen, Award, AlertCircle, ChevronDown, Eye, Sliders } from 'lucide-react';
import { supabase } from '../supabase/config';
import {
  applyRetinex,
  applyCLAHE,
  applyDarkChannel,
  applyLIME
} from '../utils/imageProcessing';
import { calculateAllMetrics, metricExplanations } from '../utils/metrics';

// ─── Algorithm Registry ────────────────────────────────────────────────────
const ALGORITHMS = [
  {
    id: 'retinex',
    name: 'Multi-Scale Retinex',
    badge: 'MSR',
    ref: 'Jobson et al., IEEE TIP 1997',
    desc: 'Decomposes the image into illumination and reflectance components across multiple Gaussian scales. Excellent colour restoration and dynamic range compression.',
    tag: 'Color · Dynamic Range',
    color: '#6366f1',
    params: [
      { key: 'scale1',   label: 'σ₁ Fine Details',  min: 5,   max: 30,  step: 1,   default: 15,  unit: 'px',  tip: 'Small-scale surround (5-30 px)' },
      { key: 'scale2',   label: 'σ₂ Mid-Range',     min: 40,  max: 120, step: 5,   default: 80,  unit: 'px',  tip: 'Medium-scale surround (40-120 px)' },
      { key: 'scale3',   label: 'σ₃ Global',        min: 150, max: 350, step: 10,  default: 250, unit: 'px',  tip: 'Coarse-scale surround (150-350 px)' },
    ],
    defaultParams: { scale1: 15, scale2: 80, scale3: 250, colorRestoration: true }
  },
  {
    id: 'clahe',
    name: 'CLAHE',
    badge: 'CLAHE',
    ref: 'Zuiderveld, Graphics Gems IV 1994',
    desc: 'Contrast-Limited Adaptive Histogram Equalization. Processes independent tiles with clipped histograms and bilinear interpolation to prevent noise amplification.',
    tag: 'Local Contrast · Noise Control',
    color: '#10b981',
    params: [
      { key: 'clipLimit',    label: 'Clip Limit',   min: 0.5, max: 8,  step: 0.5, default: 2.0, unit: '',   tip: 'Histogram clip threshold – lower = less noise' },
      { key: 'tileGridSize', label: 'Tile Grid',    min: 4,   max: 16, step: 4,   default: 8,   unit: '',   tip: 'Number of tiles per axis (4-16)' },
    ],
    defaultParams: { clipLimit: 2.0, tileGridSize: 8 }
  },
  {
    id: 'dark_channel',
    name: 'Dark Channel Prior',
    badge: 'DCP',
    ref: 'He et al., IEEE CVPR 2009',
    desc: 'Exploits the dark channel statistic of haze-free images to estimate transmission and atmospheric light, then recovers scene radiance through a physics-based model.',
    tag: 'Haze · Atmospheric Scattering',
    color: '#f59e0b',
    params: [
      { key: 'patchSize', label: 'Patch Size',    min: 5,   max: 25,  step: 2,    default: 15,  unit: 'px',  tip: 'Dark channel minimum filter size' },
      { key: 'omega',     label: 'ω Retention',  min: 0.7, max: 1.0, step: 0.05, default: 0.85, unit: '',   tip: 'Higher = retains depth cues' },
      { key: 'tMin',      label: 't min floor',  min: 0.1, max: 0.4, step: 0.05, default: 0.2,  unit: '',   tip: 'Minimum transmission bound' },
    ],
    defaultParams: { patchSize: 15, omega: 0.85, tMin: 0.2 }
  },
  {
    id: 'lime',
    name: 'LIME',
    badge: 'LIME',
    ref: 'Guo et al., IEEE TIP 2017',
    desc: 'Estimates an initial illumination map using max-RGB, then refines it with structure-aware bilateral smoothing. Gamma correction lifts dark regions naturally.',
    tag: 'Severe Low-Light · Naturalness',
    color: '#ec4899',
    params: [
      { key: 'gamma',      label: 'γ Illumination', min: 0.3, max: 1.0, step: 0.05, default: 0.6,  unit: '',  tip: 'Lower = more brightening' },
      { key: 'lambda',     label: 'λ Smoothness',   min: 0.05, max: 0.5, step: 0.05, default: 0.15, unit: '', tip: 'Illumination map smoothness weight' },
      { key: 'iterations', label: 'Iterations',     min: 1,   max: 6,   step: 1,    default: 3,    unit: '',  tip: 'Refinement iterations (more = smoother)' },
    ],
    defaultParams: { gamma: 0.6, lambda: 0.15, iterations: 3 }
  },
];

// ─── Tiny helper: metric badge colour ─────────────────────────────────────
const psnrColor  = v => v >= 30 ? '#10b981' : v >= 25 ? '#f59e0b' : '#ef4444';
const ssimColor  = v => v >= 0.85 ? '#10b981' : v >= 0.75 ? '#f59e0b' : '#ef4444';
const gradeColor = g => g.startsWith('Excellent') ? '#10b981' : g.startsWith('Very') ? '#6366f1' : g.startsWith('Good') ? '#f59e0b' : '#ef4444';

// ─── Component ─────────────────────────────────────────────────────────────
const EditorPage = ({ image, onBack, userId }) => {
  const [algoId,      setAlgoId]      = useState('lime');
  const [params,      setParams]      = useState({});
  const [enhanced,    setEnhanced]    = useState(null);
  const [processing,  setProcessing]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [metrics,     setMetrics]     = useState(null);
  const [activeTab,   setActiveTab]   = useState('params'); // 'params' | 'metrics'
  const [compareMode, setCompareMode] = useState(false);
  const [compareX,    setCompareX]    = useState(50); // % for slider
  const canvasRef = useRef(null);
  const compareRef = useRef(null);

  const algo = ALGORITHMS.find(a => a.id === algoId);

  // Initialise params when algo changes
  useEffect(() => {
    setParams({ ...algo.defaultParams });
    setEnhanced(null);
    setMetrics(null);
  }, [algoId]);

  const setParam = (key, value) => setParams(p => ({ ...p, [key]: value }));

  // ── Process ──────────────────────────────────────────────────────────────
  const process = () => {
    if (!image || processing) return;
    setProcessing(true);
    setSaved(false);
    const t0 = performance.now();

    requestAnimationFrame(() => setTimeout(() => {
      try {
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');
        canvas.width  = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        switch (algoId) {
          case 'retinex':     imageData = applyRetinex(imageData, params);     break;
          case 'clahe':       imageData = applyCLAHE(imageData, params);       break;
          case 'dark_channel':imageData = applyDarkChannel(imageData, params); break;
          case 'lime':        imageData = applyLIME(imageData, params);        break;
        }

        ctx.putImageData(imageData, 0, 0);
        const src = canvas.toDataURL();
        const img = new Image();
        img.src = src;
        img.onload = () => {
          const ms = performance.now() - t0;
          const m  = calculateAllMetrics(image, img, ms / 1000);
          setMetrics(m);
          setEnhanced(img);
          setActiveTab('metrics');
          setProcessing(false);
        };
      } catch (e) {
        console.error(e);
        setProcessing(false);
      }
    }, 50));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveResult = async () => {
    if (!enhanced || !userId || saving) return;
    setSaving(true);
    try {
      const blob = await (await fetch(enhanced.src)).blob();
      const path = `${userId}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from('enhanced-images').upload(path, blob);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('enhanced-images').getPublicUrl(path);
      await supabase.from('enhancements').insert({
        user_id: userId,
        algorithm: algo.name,
        enhanced_image_url: publicUrl,
        parameters: { algorithm_id: algoId, ...params, metrics }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const download = () => {
    if (!enhanced) return;
    const a = document.createElement('a');
    a.download = `LuminX_${algo.badge}_${Date.now()}.png`;
    a.href = enhanced.src;
    a.click();
  };

  // ── Compare slider logic ──────────────────────────────────────────────────
  const handleCompareMove = (e) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setCompareX(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  // ============================================================
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}
         className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col">

      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-[#0d0d14]">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-white font-semibold tracking-tight">LuminX</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 tracking-widest uppercase">
            Research
          </span>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {enhanced && (
            <>
              <button onClick={download}
                      className="text-xs px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5">
                <Download className="w-3 h-3" /> Export PNG
              </button>
              <button onClick={saveResult} disabled={saving}
                      className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors flex items-center gap-1.5 text-white font-medium">
                <Save className="w-3 h-3" /> {saving ? 'Saving…' : 'Save to History'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Panel ── */}
        <aside className="w-72 flex-shrink-0 border-r border-white/[0.06] bg-[#0d0d14] flex flex-col overflow-y-auto">

          {/* Algorithm Picker */}
          <div className="p-4 border-b border-white/[0.06]">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Algorithm</p>
            <div className="space-y-1.5">
              {ALGORITHMS.map(a => (
                <button key={a.id}
                        onClick={() => setAlgoId(a.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${
                          algoId === a.id
                            ? 'border-white/10 bg-white/[0.06]'
                            : 'border-transparent hover:bg-white/[0.03]'
                        }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-white">{a.name}</span>
                    <span style={{ color: a.color }}
                          className="text-[10px] font-bold">{a.badge}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{a.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] text-slate-600 mb-1">📄 Reference</p>
            <p className="text-[10px] text-slate-400">{algo.ref}</p>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{algo.desc}</p>
          </div>

          {/* Tabs: Params / Metrics */}
          <div className="flex border-b border-white/[0.06]">
            {['params', 'metrics'].map(tab => (
              <button key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 text-[10px] uppercase tracking-widest transition-colors ${
                        activeTab === tab
                          ? 'text-white border-b-2'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                      style={activeTab === tab ? { borderColor: algo.color } : {}}>
                {tab === 'params' ? <><Sliders className="w-3 h-3 inline mr-1" />Params</> : <><Award className="w-3 h-3 inline mr-1" />Metrics</>}
              </button>
            ))}
          </div>

          {/* Params Panel */}
          {activeTab === 'params' && (
            <div className="p-4 space-y-5 flex-1">
              {algo.params.map(p => (
                <div key={p.key}>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-[11px] text-slate-400">{p.label}</label>
                    <span className="text-[11px] font-bold"
                          style={{ color: algo.color }}>
                      {typeof params[p.key] === 'number'
                        ? (Number.isInteger(p.step) ? params[p.key] : params[p.key]?.toFixed(2))
                        : p.default}
                      {p.unit && <span className="text-slate-600 ml-0.5">{p.unit}</span>}
                    </span>
                  </div>
                  <input type="range"
                         min={p.min} max={p.max} step={p.step}
                         value={params[p.key] ?? p.default}
                         onChange={e => setParam(p.key, parseFloat(e.target.value))}
                         className="w-full h-[3px] rounded-full appearance-none cursor-pointer"
                         style={{ accentColor: algo.color }} />
                  <p className="text-[10px] text-slate-600 mt-1">{p.tip}</p>
                </div>
              ))}
            </div>
          )}

          {/* Metrics Panel */}
          {activeTab === 'metrics' && (
            <div className="p-4 flex-1">
              {!metrics ? (
                <div className="text-center py-8 text-slate-600 text-xs">
                  Run enhancement to see metrics
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Grade */}
                  <div className="rounded-lg p-3 border border-white/10 bg-white/[0.03] text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Overall Grade</p>
                    <p className="text-base font-bold" style={{ color: gradeColor(metrics.qualityGrade) }}>
                      {metrics.qualityGrade}
                    </p>
                  </div>

                  {/* Primary metrics */}
                  {[
                    { label: 'PSNR', value: `${metrics.psnr} dB`, color: psnrColor(parseFloat(metrics.psnr)) },
                    { label: 'SSIM', value: metrics.ssim, color: ssimColor(parseFloat(metrics.ssim)) },
                    { label: 'Illumination Gain', value: `${metrics.illuminationGain}×`, color: '#f59e0b' },
                    { label: 'Contrast Δ', value: `${metrics.contrastImprovement}%`, color: '#6366f1' },
                    { label: 'Color Fidelity', value: `${metrics.colorFidelity}%`, color: '#10b981' },
                    { label: 'Entropy Δ', value: metrics.entropyChange, color: '#ec4899' },
                    { label: 'Process Time', value: `${metrics.processingTime}s`, color: '#64748b' },
                  ].map(m => (
                    <div key={m.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{m.label}</span>
                      <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.value}</span>
                    </div>
                  ))}

                  <div className="mt-3 pt-3 border-t border-white/[0.06] text-[10px] text-slate-600 leading-relaxed">
                    PSNR &gt;30 dB · SSIM &gt;0.85 → high quality
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          <div className="p-4 border-t border-white/[0.06]">
            <button onClick={process} disabled={processing}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: processing ? '#1e1e2e' : algo.color, color: '#fff' }}>
              {processing
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                : <><Play  className="w-4 h-4" /> Run {algo.badge}</>}
            </button>
          </div>
        </aside>

        {/* ── Right: Image Area ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#070709]">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-[#0a0a0f]">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">View</span>
            <button onClick={() => setCompareMode(false)}
                    className={`text-[10px] px-2.5 py-1 rounded transition-colors ${!compareMode ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              Side by Side
            </button>
            {enhanced && (
              <button onClick={() => setCompareMode(true)}
                      className={`text-[10px] px-2.5 py-1 rounded transition-colors ${compareMode ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                Overlay Slider
              </button>
            )}
            {metrics && (
              <>
                <div className="w-px h-4 bg-white/10 ml-auto" />
                <span className="text-[10px] text-slate-600">PSNR:</span>
                <span className="text-[10px] font-bold" style={{ color: psnrColor(parseFloat(metrics.psnr)) }}>{metrics.psnr} dB</span>
                <span className="text-[10px] text-slate-600">SSIM:</span>
                <span className="text-[10px] font-bold" style={{ color: ssimColor(parseFloat(metrics.ssim)) }}>{metrics.ssim}</span>
              </>
            )}
          </div>

          {/* Image Display */}
          <div className="flex-1 overflow-auto p-5 flex items-start justify-center">
            {!compareMode || !enhanced ? (
              /* Side-by-side */
              <div className={`grid ${enhanced ? 'grid-cols-2' : 'grid-cols-1'} gap-4 w-full max-w-6xl`}>
                {/* Original */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Input</span>
                    {metrics && <span className="text-[10px] text-slate-600">Brightness: {metrics.originalBrightness}</span>}
                  </div>
                  <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black">
                    <img src={image?.src} alt="Original"
                         className="w-full h-auto block" style={{ display: 'block' }} />
                  </div>
                </div>

                {/* Enhanced */}
                {enhanced && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: algo.color }}>
                        {algo.badge} Output
                      </span>
                      {metrics && <span className="text-[10px] text-slate-600">Brightness: {metrics.enhancedBrightness}</span>}
                    </div>
                    <div className="rounded-xl overflow-hidden border bg-black"
                         style={{ borderColor: algo.color + '40' }}>
                      <img src={enhanced?.src} alt="Enhanced"
                           className="w-full h-auto block" />
                    </div>
                  </div>
                )}

                {/* Processing overlay */}
                {processing && (
                  <div className="col-span-2 flex items-center justify-center py-20 text-slate-600 gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Applying {algo.name}…</span>
                  </div>
                )}
              </div>
            ) : (
              /* Overlay slider */
              <div className="w-full max-w-5xl space-y-3">
                <p className="text-[10px] text-slate-500 text-center">Drag to compare</p>
                <div ref={compareRef}
                     className="relative rounded-xl overflow-hidden border border-white/10 cursor-col-resize select-none"
                     onMouseMove={handleCompareMove}
                     onTouchMove={handleCompareMove}>
                  {/* Enhanced (full) */}
                  <img src={enhanced?.src} alt="Enhanced" className="w-full block" />
                  {/* Original clipped */}
                  <div className="absolute inset-0 overflow-hidden"
                       style={{ width: `${compareX}%` }}>
                    <img src={image?.src} alt="Original"
                         className="absolute inset-0 h-full"
                         style={{ width: compareRef.current?.offsetWidth + 'px', maxWidth: 'none' }} />
                  </div>
                  {/* Divider */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/70 pointer-events-none"
                       style={{ left: `${compareX}%` }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                      <span className="text-[8px] text-black font-bold">↔</span>
                    </div>
                  </div>
                  {/* Labels */}
                  <div className="absolute top-3 left-3 text-[10px] bg-black/60 px-2 py-0.5 rounded text-slate-300">Original</div>
                  <div className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded font-bold"
                       style={{ background: algo.color + '30', color: algo.color }}>{algo.badge}</div>
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="px-5 py-2 border-t border-white/[0.06] bg-[#0a0a0f] flex items-center gap-4 text-[10px] text-slate-600">
            <span>{image?.width}×{image?.height}px</span>
            <span>Algorithm: {algo.name}</span>
            {metrics && <span style={{ color: gradeColor(metrics.qualityGrade) }}>● {metrics.qualityGrade}</span>}
            <span className="ml-auto">LuminX · Low-Light Enhancement Platform</span>
          </div>
        </main>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default EditorPage;