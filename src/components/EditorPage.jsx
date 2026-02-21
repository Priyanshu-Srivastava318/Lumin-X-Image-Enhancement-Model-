import React, { useState, useRef } from 'react';
import { ArrowLeft, Download, Save, Play, RefreshCw, Info, Check, TrendingUp, Zap, BookOpen, Award, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase/config';
import { 
  applyRetinex, 
  applyCLAHE, 
  applyDarkChannel, 
  applyLIME 
} from '../utils/imageProcessing';
import { calculateAllMetrics, metricExplanations } from '../utils/metrics';

const EditorPage = ({ image, onBack, userId }) => {
  const [algorithm, setAlgorithm] = useState('retinex');
  
  const [retinexParams, setRetinexParams] = useState({
    scale1: 15,
    scale2: 80,
    scale3: 250,
    colorRestoration: true
  });
  
  const [claheParams, setClaheParams] = useState({
    clipLimit: 2.0,
    tileGridSize: 8
  });
  
  const [darkChannelParams, setDarkChannelParams] = useState({
    patchSize: 15,
    omega: 0.85,
    tMin: 0.2
  });
  
  const [limeParams, setLimeParams] = useState({
    gamma: 0.6,
    lambda: 0.15,
    iterations: 2
  });
  
  const [enhancedImage, setEnhancedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [showMetricInfo, setShowMetricInfo] = useState(null);
  
  const canvasRef = useRef(null);

  const algorithms = [
    { 
      id: 'retinex', 
      name: 'Multi-Scale Retinex (MSR)', 
      shortName: 'MSR',
      desc: 'Decomposes image into illumination and reflectance components using multi-scale Gaussian surround functions',
      reference: 'Jobson et al., IEEE TIP 1997',
      bestFor: 'Color restoration, dynamic range compression',
      theory: 'Based on human visual perception model - separates intrinsic reflectance from incident illumination'
    },
    { 
      id: 'clahe', 
      name: 'Contrast Limited Adaptive Histogram Equalization', 
      shortName: 'CLAHE',
      desc: 'Adaptive histogram equalization with contrast limiting to prevent noise over-amplification in uniform regions',
      reference: 'Zuiderveld, Graphics Gems IV 1994',
      bestFor: 'Local contrast enhancement, medical imaging',
      theory: 'Divides image into tiles, applies histogram equalization with clip limit to each tile independently'
    },
    { 
      id: 'dark_channel', 
      name: 'Dark Channel Prior', 
      shortName: 'DCP',
      desc: 'Exploits dark channel statistics to estimate and remove atmospheric scattering effects',
      reference: 'He et al., IEEE CVPR 2009',
      bestFor: 'Haze removal, outdoor scenes, atmospheric correction',
      theory: 'Based on observation: most outdoor haze-free patches contain very low intensity pixels in at least one color channel'
    },
    { 
      id: 'lime', 
      name: 'Low-light Image Enhancement via Illumination Map', 
      shortName: 'LIME',
      desc: 'Estimates illumination map and refines it using structure-preserving optimization',
      reference: 'Guo et al., IEEE TIP 2017',
      bestFor: 'Severe low-light conditions, naturalness preservation',
      theory: 'Formulates enhancement as illumination map estimation problem with smoothness and naturalness constraints'
    },
  ];

  const applyEnhancement = () => {
    if (!image) return;
    
    setIsProcessing(true);
    setSaveSuccess(false);
    const startTime = performance.now();
    
    setTimeout(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = image.width;
      canvas.height = image.height;
      
      ctx.drawImage(image, 0, 0);
      
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      try {
        switch (algorithm) {
          case 'retinex':
            imageData = applyRetinex(imageData, retinexParams);
            break;
          case 'clahe':
            imageData = applyCLAHE(imageData, claheParams);
            break;
          case 'dark_channel':
            imageData = applyDarkChannel(imageData, darkChannelParams);
            break;
          case 'lime':
            imageData = applyLIME(imageData, limeParams);
            break;
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const enhanced = new Image();
        enhanced.src = canvas.toDataURL();
        enhanced.onload = () => {
          const endTime = performance.now();
          const processingTime = (endTime - startTime) / 1000;
          
          const calculatedMetrics = calculateAllMetrics(image, enhanced, processingTime);
          setMetrics(calculatedMetrics);
          
          setEnhancedImage(enhanced);
          setIsProcessing(false);
        };
      } catch (error) {
        console.error('Enhancement error:', error);
        alert('Processing failed. Please try different parameters.');
        setIsProcessing(false);
      }
    }, 100);
  };

  const saveToSupabase = async () => {
    if (!enhancedImage || !userId) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch(enhancedImage.src);
      const blob = await response.blob();
      
      const fileName = `${userId}/${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('enhanced-images')
        .upload(fileName, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('enhanced-images')
        .getPublicUrl(fileName);
      
      let currentParams = {};
      switch (algorithm) {
        case 'retinex':     currentParams = retinexParams;      break;
        case 'clahe':       currentParams = claheParams;        break;
        case 'dark_channel':currentParams = darkChannelParams;  break;
        case 'lime':        currentParams = limeParams;         break;
      }
      
      const { error: dbError } = await supabase
        .from('enhancements')
        .insert({
          user_id: userId,
          algorithm: algorithms.find(a => a.id === algorithm).name,
          enhanced_image_url: publicUrl,
          parameters: {
            algorithm_id: algorithm,
            algorithm_name: algorithms.find(a => a.id === algorithm).name,
            ...currentParams,
            metrics: metrics ? {
              psnr: metrics.psnr,
              ssim: metrics.ssim,
              processingTime: metrics.processingTime,
              illuminationGain: metrics.illuminationGain,
              contrastImprovement: metrics.contrastImprovement,
              originalBrightness: metrics.originalBrightness,
              enhancedBrightness: metrics.enhancedBrightness,
              qualityGrade: metrics.qualityGrade
            } : null
          }
        });
      
      if (dbError) throw dbError;
      
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save. Please try again.');
      setIsSaving(false);
    }
  };

  const downloadImage = () => {
    if (!enhancedImage) return;
    const link = document.createElement('a');
    const algoShort = algorithms.find(a => a.id === algorithm).shortName;
    link.download = `LuminX_${algoShort}_Enhanced_${Date.now()}.png`;
    link.href = enhancedImage.src;
    link.click();
  };

  const renderAlgorithmParameters = () => {
    const currentAlgo = algorithms.find(a => a.id === algorithm);
    
    switch (algorithm) {
      case 'retinex':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
              <p className="text-xs text-slate-300">
                <strong className="text-blue-400">Theory:</strong> {currentAlgo.theory}
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">Scale σ₁ (Fine Details)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{retinexParams.scale1}</span>
              </div>
              <input
                type="range" min="5" max="30" step="1"
                value={retinexParams.scale1}
                onChange={(e) => setRetinexParams({...retinexParams, scale1: parseInt(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Captures fine texture and edges (5-30 pixels)</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">Scale σ₂ (Mid-range)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{retinexParams.scale2}</span>
              </div>
              <input
                type="range" min="40" max="120" step="5"
                value={retinexParams.scale2}
                onChange={(e) => setRetinexParams({...retinexParams, scale2: parseInt(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Balances local and global features (40-120 pixels)</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">Scale σ₃ (Global)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{retinexParams.scale3}</span>
              </div>
              <input
                type="range" min="150" max="350" step="10"
                value={retinexParams.scale3}
                onChange={(e) => setRetinexParams({...retinexParams, scale3: parseInt(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Handles overall illumination (150-350 pixels)</p>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Color Restoration (CRF)</label>
              <button
                onClick={() => setRetinexParams({...retinexParams, colorRestoration: !retinexParams.colorRestoration})}
                className={`w-10 h-5 rounded-full transition-colors ${retinexParams.colorRestoration ? 'bg-blue-600' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${retinexParams.colorRestoration ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        );
      
      case 'clahe':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
              <p className="text-xs text-slate-300">
                <strong className="text-blue-400">Theory:</strong> {currentAlgo.theory}
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">Clip Limit (Contrast Threshold)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{claheParams.clipLimit.toFixed(1)}</span>
              </div>
              <input
                type="range" min="1" max="5" step="0.5"
                value={claheParams.clipLimit}
                onChange={(e) => setClaheParams({...claheParams, clipLimit: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Lower = less noise amplification, Higher = more contrast (1-5)</p>
            </div>
            
            <div>
              <label className="text-sm text-slate-300 block mb-2">Tile Grid Size</label>
              <select
                value={claheParams.tileGridSize}
                onChange={(e) => setClaheParams({...claheParams, tileGridSize: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
              >
                <option value="4">4×4 - Fine (High spatial resolution)</option>
                <option value="8">8×8 - Standard (Recommended)</option>
                <option value="16">16×16 - Coarse (Faster processing)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Smaller tiles = more local adaptation</p>
            </div>
          </div>
        );
      
      case 'dark_channel':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
              <p className="text-xs text-slate-300">
                <strong className="text-blue-400">Theory:</strong> {currentAlgo.theory}
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">Patch Size (Local Window)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{darkChannelParams.patchSize}×{darkChannelParams.patchSize}</span>
              </div>
              <input
                type="range" min="5" max="25" step="2"
                value={darkChannelParams.patchSize}
                onChange={(e) => setDarkChannelParams({...darkChannelParams, patchSize: parseInt(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Size of neighborhood for dark channel estimation (5-25 pixels)</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">ω (Transmission Retention)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{darkChannelParams.omega.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.7" max="1.0" step="0.05"
                value={darkChannelParams.omega}
                onChange={(e) => setDarkChannelParams({...darkChannelParams, omega: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Higher = keeps more haze for depth perception (0.7-1.0)</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">t min (Transmission Floor)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{darkChannelParams.tMin.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.1" max="0.4" step="0.05"
                value={darkChannelParams.tMin}
                onChange={(e) => setDarkChannelParams({...darkChannelParams, tMin: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum transmission bound (0.1-0.4)</p>
            </div>
          </div>
        );
      
      case 'lime':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
              <p className="text-xs text-slate-300">
                <strong className="text-blue-400">Theory:</strong> {currentAlgo.theory}
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">γ (Gamma Correction)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{limeParams.gamma.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.3" max="1.0" step="0.05"
                value={limeParams.gamma}
                onChange={(e) => setLimeParams({...limeParams, gamma: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Lower = more brightening (0.3-1.0)</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">λ (Smoothness Weight)</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{limeParams.lambda.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.05" max="0.5" step="0.05"
                value={limeParams.lambda}
                onChange={(e) => setLimeParams({...limeParams, lambda: parseFloat(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Illumination map smoothness (0.05-0.5)</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-300">Iterations</label>
                <span className="text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">{limeParams.iterations}</span>
              </div>
              <input
                type="range" min="1" max="4" step="1"
                value={limeParams.iterations}
                onChange={(e) => setLimeParams({...limeParams, iterations: parseInt(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Refinement iterations — more = smoother but slower (1-4)</p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const currentAlgo = algorithms.find(a => a.id === algorithm);

  return (
    <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-400" />
                Low-Light Image Enhancement Platform
              </h2>
              <p className="text-slate-400 text-sm">Computer Vision Research Tool • Academic Implementation</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-400 bg-green-900/30 px-4 py-2 rounded-lg border border-green-700 animate-pulse">
                <Check className="w-5 h-5" />
                Saved to Database
              </div>
            )}
            {enhancedImage && (
              <>
                <button
                  onClick={downloadImage}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  Export Result
                </button>
                <button
                  onClick={saveToSupabase}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save to History'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Algorithm Selection */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-xl">
              <label className="block text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Enhancement Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer font-medium"
              >
                {algorithms.map((algo) => (
                  <option key={algo.id} value={algo.id}>
                    {algo.shortName} - {algo.name.split('(')[0].trim()}
                  </option>
                ))}
              </select>
              
              <div className="mt-3 p-3 bg-blue-900/30 border border-blue-600/50 rounded-lg">
                <div className="text-xs font-semibold text-blue-300 mb-1">
                  📚 {currentAlgo?.reference}
                </div>
                <p className="text-xs text-slate-300 mb-2">{currentAlgo?.desc}</p>
                <div className="text-xs text-green-400">
                  <strong>Best for:</strong> {currentAlgo?.bestFor}
                </div>
              </div>
            </div>

            {/* Parameters */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-xl">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                Algorithm Parameters
              </h3>
              {renderAlgorithmParameters()}
            </div>

            {/* Apply Enhancement Button */}
            <button
              onClick={applyEnhancement}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold shadow-lg ${
                isProcessing
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white hover:shadow-blue-500/50'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Processing Image...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Apply Enhancement
                </>
              )}
            </button>

            {/* Metrics Panel */}
            {metrics && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border-2 border-green-600/50 shadow-2xl">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  Quality Assessment
                </h3>
                
                <div className="mb-3 p-2 bg-green-900/30 border border-green-600/50 rounded text-center">
                  <div className="text-lg font-bold text-green-300">{metrics.qualityGrade}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center group cursor-help"
                       onClick={() => setShowMetricInfo(showMetricInfo === 'psnr' ? null : 'psnr')}>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      PSNR <Info className="w-3 h-3" />
                    </span>
                    <span className="text-sm font-bold text-green-400">{metrics.psnr} dB</span>
                  </div>
                  {showMetricInfo === 'psnr' && (
                    <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded">
                      {metricExplanations.psnr.interpretation}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center group cursor-help"
                       onClick={() => setShowMetricInfo(showMetricInfo === 'ssim' ? null : 'ssim')}>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      SSIM <Info className="w-3 h-3" />
                    </span>
                    <span className="text-sm font-bold text-blue-400">{metrics.ssim}</span>
                  </div>
                  {showMetricInfo === 'ssim' && (
                    <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded">
                      {metricExplanations.ssim.interpretation}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center group cursor-help"
                       onClick={() => setShowMetricInfo(showMetricInfo === 'illum' ? null : 'illum')}>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      Illumination Gain <Info className="w-3 h-3" />
                    </span>
                    <span className="text-sm font-bold text-yellow-400">{metrics.illuminationGain}×</span>
                  </div>
                  {showMetricInfo === 'illum' && (
                    <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded">
                      {metricExplanations.illuminationGain.interpretation}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Contrast Improvement</span>
                    <span className="text-sm font-bold text-orange-400">{metrics.contrastImprovement}%</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Processing Time</span>
                    <span className="text-sm font-bold text-purple-400">{metrics.processingTime}s</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Color Fidelity</span>
                    <span className="text-sm font-bold text-cyan-400">{metrics.colorFidelity}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Image Comparison */}
          <div className="lg:col-span-3 space-y-4">
            {enhancedImage ? (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Comparative Analysis</h3>
                  <div className="flex gap-2 text-xs bg-blue-900/30 px-3 py-1 rounded border border-blue-600/50">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-300 font-semibold">{currentAlgo.shortName} Applied</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-300 mb-2 flex justify-between items-center">
                      <span className="font-semibold">Original (Input)</span>
                      <span className="text-xs bg-slate-900 px-2 py-1 rounded">
                        Avg Brightness: {metrics?.originalBrightness}
                      </span>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2 border-2 border-slate-700">
                      <img src={image.src} alt="Original" className="w-full h-auto rounded" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-slate-300 mb-2 flex justify-between items-center">
                      <span className="font-semibold">Enhanced (Output)</span>
                      <span className="text-xs bg-green-900 px-2 py-1 rounded text-green-300">
                        Avg Brightness: {metrics?.enhancedBrightness}
                      </span>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2 border-2 border-green-600/50">
                      <img src={enhancedImage.src} alt="Enhanced" className="w-full h-auto rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Input Image Preview</h3>
                <div className="bg-slate-900 rounded-lg p-4">
                  <img src={image.src} alt="Original" className="w-full h-auto rounded" />
                </div>
              </div>
            )}

            {/* Research Guidelines */}
            <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <strong className="text-yellow-300">Research Guidelines:</strong>
                  <ul className="mt-2 space-y-1 text-xs list-disc list-inside text-slate-400">
                    <li>PSNR &gt;30 dB indicates good reconstruction quality</li>
                    <li>SSIM &gt;0.85 suggests excellent perceptual similarity</li>
                    <li>Use genuinely low-light images for best algorithm results</li>
                    <li>Compare multiple algorithms for comprehensive analysis</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default EditorPage;