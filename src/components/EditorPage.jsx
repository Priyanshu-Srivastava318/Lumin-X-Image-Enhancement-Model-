import React, { useState, useRef } from 'react';
import { ArrowLeft, Download, Save, Sliders, RefreshCw, Info, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabase/config';
import { 
  applyRetinex, 
  applyCLAHE, 
  applyDarkChannel, 
  applyLIME,
  applyEnhancements 
} from '../utils/imageProcessing';

const EditorPage = ({ image, onBack, userId }) => {
  const [algorithm, setAlgorithm] = useState('retinex');
  const [brightness, setBrightness] = useState(1.2);
  const [contrast, setContrast] = useState(1.1);
  const [saturation, setSaturation] = useState(1.05);
  const [sharpness, setSharpness] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [shadows, setShadows] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [gamma, setGamma] = useState(1.0);
  const [vibrance, setVibrance] = useState(0);
  const [noiseReduction, setNoiseReduction] = useState(0);
  
  const [enhancedImage, setEnhancedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const canvasRef = useRef(null);

  const algorithms = [
    { id: 'retinex', name: 'Multi-Scale Retinex', desc: 'Color restoration with detail preservation', icon: '🎨' },
    { id: 'clahe', name: 'CLAHE', desc: 'Contrast Limited Adaptive Histogram Equalization', icon: '📊' },
    { id: 'dark_channel', name: 'Dark Channel Prior', desc: 'Atmospheric scattering model based', icon: '🌫️' },
    { id: 'lime', name: 'LIME', desc: 'Low-light Image Enhancement', icon: '💡' },
  ];

  const applyEnhancement = () => {
    if (!image) return;
    
    setIsProcessing(true);
    setSaveSuccess(false);
    
    setTimeout(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = image.width;
      canvas.height = image.height;
      
      ctx.drawImage(image, 0, 0);
      
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      switch (algorithm) {
        case 'retinex':
          imageData = applyRetinex(imageData);
          break;
        case 'clahe':
          imageData = applyCLAHE(imageData);
          break;
        case 'dark_channel':
          imageData = applyDarkChannel(imageData);
          break;
        case 'lime':
          imageData = applyLIME(imageData);
          break;
      }
      
      imageData = applyEnhancements(imageData, {
        brightness, contrast, saturation, sharpness, exposure,
        shadows, highlights, warmth, gamma, vibrance, noiseReduction
      });
      
      ctx.putImageData(imageData, 0, 0);
      
      const enhanced = new Image();
      enhanced.src = canvas.toDataURL();
      enhanced.onload = () => {
        setEnhancedImage(enhanced);
        setIsProcessing(false);
        setShowComparison(true);
      };
    }, 1000);
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
      
      const { error: dbError } = await supabase
        .from('enhancements')
        .insert({
          user_id: userId,
          algorithm: algorithms.find(a => a.id === algorithm).name,
          enhanced_image_url: publicUrl,
          parameters: {
            brightness, contrast, saturation, sharpness, exposure,
            shadows, highlights, warmth, gamma, vibrance, noiseReduction
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
    link.download = `lumin-x-enhanced-${Date.now()}.png`;
    link.href = enhancedImage.src;
    link.click();
  };

  const resetParameters = () => {
    setBrightness(1.2); setContrast(1.1); setSaturation(1.05);
    setSharpness(0); setExposure(0); setShadows(0); setHighlights(0);
    setWarmth(0); setGamma(1.0); setVibrance(0); setNoiseReduction(0);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
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
              <h2 className="text-2xl font-bold text-white">Image Editor</h2>
              <p className="text-slate-400 text-sm">Enhance with 11 controls & 4 algorithms</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-400 bg-green-900/30 px-4 py-2 rounded-lg border border-green-700">
                <Check className="w-5 h-5" />
                Saved!
              </div>
            )}
            {enhancedImage && (
              <>
                <button
                  onClick={downloadImage}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={saveToSupabase}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Algorithm Dropdown */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <label className="block text-sm font-semibold text-white mb-3">
                Enhancement Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                {algorithms.map((algo) => (
                  <option key={algo.id} value={algo.id}>
                    {algo.icon} {algo.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-2">
                {algorithms.find(a => a.id === algorithm)?.desc}
              </p>
            </div>

            {/* Basic Parameters */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Basic Adjustments</h3>
                <button
                  onClick={resetParameters}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Reset all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-slate-300">Brightness</label>
                    <span className="text-sm text-blue-400 font-mono">{brightness.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.5" max="2.5" step="0.1" value={brightness}
                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-slate-300">Contrast</label>
                    <span className="text-sm text-blue-400 font-mono">{contrast.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={contrast}
                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-slate-300">Saturation</label>
                    <span className="text-sm text-blue-400 font-mono">{saturation.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.05" value={saturation}
                    onChange={(e) => setSaturation(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-slate-300">Exposure</label>
                    <span className="text-sm text-blue-400 font-mono">{exposure.toFixed(2)}</span>
                  </div>
                  <input type="range" min="-1" max="1" step="0.1" value={exposure}
                    onChange={(e) => setExposure(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Parameters - Collapsible */}
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/50 transition-colors rounded-lg"
              >
                <span className="text-sm font-semibold text-white">Advanced Controls (7 more)</span>
                {showAdvanced ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {showAdvanced && (
                <div className="p-4 pt-0 space-y-4 border-t border-slate-700">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Sharpness</label>
                      <span className="text-sm text-blue-400 font-mono">{sharpness}</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={sharpness}
                      onChange={(e) => setSharpness(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Shadows</label>
                      <span className="text-sm text-blue-400 font-mono">{shadows}</span>
                    </div>
                    <input type="range" min="-100" max="100" step="5" value={shadows}
                      onChange={(e) => setShadows(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Highlights</label>
                      <span className="text-sm text-blue-400 font-mono">{highlights}</span>
                    </div>
                    <input type="range" min="-100" max="100" step="5" value={highlights}
                      onChange={(e) => setHighlights(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Warmth</label>
                      <span className="text-sm text-blue-400 font-mono">{warmth}</span>
                    </div>
                    <input type="range" min="-10" max="10" step="1" value={warmth}
                      onChange={(e) => setWarmth(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Gamma</label>
                      <span className="text-sm text-blue-400 font-mono">{gamma.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0.5" max="2.5" step="0.1" value={gamma}
                      onChange={(e) => setGamma(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Vibrance</label>
                      <span className="text-sm text-blue-400 font-mono">{vibrance.toFixed(2)}</span>
                    </div>
                    <input type="range" min="-1" max="1" step="0.1" value={vibrance}
                      onChange={(e) => setVibrance(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-slate-300">Noise Reduction</label>
                      <span className="text-sm text-blue-400 font-mono">{noiseReduction}</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={noiseReduction}
                      onChange={(e) => setNoiseReduction(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Apply Button */}
            <button
              onClick={applyEnhancement}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium ${
                isProcessing
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sliders className="w-4 h-4" />
                  Apply Enhancement
                </>
              )}
            </button>
          </div>

          {/* Image Preview */}
          <div className="lg:col-span-3 space-y-4">
            {showComparison && enhancedImage ? (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Before & After</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Original</div>
                    <div className="bg-slate-900 rounded-lg p-2">
                      <img src={image.src} alt="Original" className="w-full h-auto rounded" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Enhanced</div>
                    <div className="bg-slate-900 rounded-lg p-2">
                      <img src={enhancedImage.src} alt="Enhanced" className="w-full h-auto rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Original Image</h3>
                <div className="bg-slate-900 rounded-lg p-4">
                  <img src={image.src} alt="Original" className="w-full h-auto rounded" />
                </div>
              </div>
            )}

            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <strong className="text-blue-400">Current:</strong> {algorithms.find(a => a.id === algorithm)?.name}
                  <br />
                  <span className="text-slate-400">Adjust parameters and click "Apply Enhancement" to process.</span>
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