// ============================================================================
// IMAGE QUALITY ASSESSMENT METRICS
// Research-grade quantitative evaluation for low-light enhancement
// ============================================================================

// ----------------------------------------------------------------------------
// 1. PSNR - Peak Signal-to-Noise Ratio
// Measures pixel-level reconstruction quality (higher is better)
// Typical range: 20-50 dB (>30 dB is good for enhancement)
// ----------------------------------------------------------------------------
const calculatePSNR = (original, enhanced) => {
  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  
  canvas1.width = canvas2.width = original.width;
  canvas1.height = canvas2.height = original.height;
  
  ctx1.drawImage(original, 0, 0);
  ctx2.drawImage(enhanced, 0, 0);
  
  const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
  const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;
  
  let mse = 0;
  let pixelCount = 0;
  
  for (let i = 0; i < data1.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = data1[i + c] - data2[i + c];
      mse += diff * diff;
    }
    pixelCount += 3;
  }
  
  mse /= pixelCount;
  
  if (mse === 0) return '∞';
  
  const maxPixel = 255;
  const psnr = 10 * Math.log10((maxPixel * maxPixel) / mse);
  
  return psnr.toFixed(2);
};

// ----------------------------------------------------------------------------
// 2. SSIM - Structural Similarity Index
// Measures perceptual quality considering luminance, contrast, structure
// Range: 0-1 (>0.8 is excellent, >0.9 is outstanding)
// ----------------------------------------------------------------------------
const calculateSSIM = (original, enhanced) => {
  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  
  canvas1.width = canvas2.width = original.width;
  canvas1.height = canvas2.height = original.height;
  
  ctx1.drawImage(original, 0, 0);
  ctx2.drawImage(enhanced, 0, 0);
  
  const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
  const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;
  
  // Convert to grayscale
  const gray1 = [];
  const gray2 = [];
  
  for (let i = 0; i < data1.length; i += 4) {
    gray1.push(0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2]);
    gray2.push(0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2]);
  }
  
  // Calculate means
  const mean1 = gray1.reduce((a, b) => a + b, 0) / gray1.length;
  const mean2 = gray2.reduce((a, b) => a + b, 0) / gray2.length;
  
  // Calculate variances and covariance
  let var1 = 0, var2 = 0, covar = 0;
  
  for (let i = 0; i < gray1.length; i++) {
    const diff1 = gray1[i] - mean1;
    const diff2 = gray2[i] - mean2;
    var1 += diff1 * diff1;
    var2 += diff2 * diff2;
    covar += diff1 * diff2;
  }
  
  var1 /= gray1.length;
  var2 /= gray2.length;
  covar /= gray1.length;
  
  // SSIM constants (to avoid division by zero)
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  
  // SSIM formula
  const numerator = (2 * mean1 * mean2 + C1) * (2 * covar + C2);
  const denominator = (mean1 * mean1 + mean2 * mean2 + C1) * (var1 + var2 + C2);
  
  const ssim = numerator / denominator;
  
  return ssim.toFixed(4);
};

// ----------------------------------------------------------------------------
// 3. BRIGHTNESS METRICS
// Measures average luminance increase
// ----------------------------------------------------------------------------
const calculateBrightness = (image) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = image.width;
  canvas.height = image.height;
  
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  let totalBrightness = 0;
  let pixelCount = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    // Calculate perceived brightness (luminance)
    const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalBrightness += brightness;
    pixelCount++;
  }
  
  return (totalBrightness / pixelCount).toFixed(1);
};

// ----------------------------------------------------------------------------
// 4. CONTRAST RATIO
// Measures dynamic range improvement
// ----------------------------------------------------------------------------
const calculateContrast = (image) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = image.width;
  canvas.height = image.height;
  
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  let min = 255, max = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    min = Math.min(min, brightness);
    max = Math.max(max, brightness);
  }
  
  // Michelson contrast
  if (max + min === 0) return 0;
  return ((max - min) / (max + min)).toFixed(4);
};

// ----------------------------------------------------------------------------
// 5. ENTROPY - Information Content
// Measures detail and texture preservation
// Higher entropy = more detail (typical range: 4-8 bits)
// ----------------------------------------------------------------------------
const calculateEntropy = (image) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = image.width;
  canvas.height = image.height;
  
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  // Build histogram
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
    totalPixels++;
  }
  
  // Calculate entropy
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > 0) {
      const probability = histogram[i] / totalPixels;
      entropy -= probability * Math.log2(probability);
    }
  }
  
  return entropy.toFixed(3);
};

// ----------------------------------------------------------------------------
// 6. NATURALNESS METRIC (NIQE-inspired)
// Assesses perceptual quality and naturalness
// Lower is better (typical range: 2-7)
// ----------------------------------------------------------------------------
const calculateNaturalness = (image) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = image.width;
  canvas.height = image.height;
  
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  // Calculate statistics
  let mean = 0, variance = 0;
  const pixels = [];
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    pixels.push(gray);
    mean += gray;
  }
  mean /= pixels.length;
  
  for (const pixel of pixels) {
    variance += (pixel - mean) ** 2;
  }
  variance /= pixels.length;
  
  // Simplified naturalness score
  // Penalize extreme variance and non-normal distributions
  const stdDev = Math.sqrt(variance);
  const naturalness = Math.abs(stdDev - 50) / 10; // Ideal std dev around 50
  
  return naturalness.toFixed(3);
};

// ----------------------------------------------------------------------------
// 7. COLOR FIDELITY
// Measures color preservation (0-100%, higher is better)
// ----------------------------------------------------------------------------
const calculateColorFidelity = (original, enhanced) => {
  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  
  canvas1.width = canvas2.width = original.width;
  canvas1.height = canvas2.height = original.height;
  
  ctx1.drawImage(original, 0, 0);
  ctx2.drawImage(enhanced, 0, 0);
  
  const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;
  const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;
  
  let colorDiff = 0;
  let pixelCount = 0;
  
  for (let i = 0; i < data1.length; i += 4) {
    // Calculate color distance in RGB space
    const rDiff = data1[i] - data2[i];
    const gDiff = data1[i + 1] - data2[i + 1];
    const bDiff = data1[i + 2] - data2[i + 2];
    
    colorDiff += Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    pixelCount++;
  }
  
  const avgDiff = colorDiff / pixelCount;
  const maxDiff = Math.sqrt(3 * 255 * 255); // Maximum possible color distance
  
  const fidelity = (1 - avgDiff / maxDiff) * 100;
  
  return fidelity.toFixed(2);
};

// ----------------------------------------------------------------------------
// MAIN METRICS CALCULATOR
// Returns comprehensive quality assessment
// ----------------------------------------------------------------------------
export const calculateAllMetrics = (originalImage, enhancedImage, processingTime) => {
  const originalBrightness = calculateBrightness(originalImage);
  const enhancedBrightness = calculateBrightness(enhancedImage);
  const originalContrast = calculateContrast(originalImage);
  const enhancedContrast = calculateContrast(enhancedImage);
  const originalEntropy = calculateEntropy(originalImage);
  const enhancedEntropy = calculateEntropy(enhancedImage);
  
  const psnr = calculatePSNR(originalImage, enhancedImage);
  const ssim = calculateSSIM(originalImage, enhancedImage);
  const naturalness = calculateNaturalness(enhancedImage);
  const colorFidelity = calculateColorFidelity(originalImage, enhancedImage);
  
  // Derived metrics
  const illuminationGain = (enhancedBrightness / Math.max(1, originalBrightness)).toFixed(2);
  const contrastImprovement = (((enhancedContrast - originalContrast) / Math.max(0.01, originalContrast)) * 100).toFixed(1);
  const entropyChange = (enhancedEntropy - originalEntropy).toFixed(3);
  
  return {
    // Primary quality metrics
    psnr: psnr,
    ssim: ssim,
    
    // Brightness analysis
    originalBrightness: originalBrightness,
    enhancedBrightness: enhancedBrightness,
    illuminationGain: illuminationGain,
    
    // Contrast analysis
    originalContrast: originalContrast,
    enhancedContrast: enhancedContrast,
    contrastImprovement: contrastImprovement,
    
    // Detail preservation
    originalEntropy: originalEntropy,
    enhancedEntropy: enhancedEntropy,
    entropyChange: entropyChange,
    
    // Perceptual quality
    naturalness: naturalness,
    colorFidelity: colorFidelity,
    
    // Performance
    processingTime: processingTime.toFixed(2),
    
    // Overall assessment
    qualityGrade: getQualityGrade(ssim, psnr, naturalness)
  };
};

// ----------------------------------------------------------------------------
// QUALITY GRADING SYSTEM
// Provides academic assessment based on metrics
// ----------------------------------------------------------------------------
const getQualityGrade = (ssim, psnr, naturalness) => {
  const ssimVal = parseFloat(ssim);
  const psnrVal = parseFloat(psnr);
  const natVal = parseFloat(naturalness);
  
  if (ssimVal > 0.90 && psnrVal > 35 && natVal < 3) return 'Excellent (A+)';
  if (ssimVal > 0.85 && psnrVal > 30 && natVal < 4) return 'Very Good (A)';
  if (ssimVal > 0.80 && psnrVal > 28 && natVal < 5) return 'Good (B+)';
  if (ssimVal > 0.75 && psnrVal > 25) return 'Acceptable (B)';
  return 'Needs Improvement (C)';
};

// ----------------------------------------------------------------------------
// METRIC EXPLANATIONS FOR UI
// ----------------------------------------------------------------------------
export const metricExplanations = {
  psnr: {
    name: 'Peak Signal-to-Noise Ratio',
    unit: 'dB',
    range: '20-50 dB',
    interpretation: 'Measures pixel-level accuracy. >30 dB indicates good reconstruction quality.',
    formula: '10 × log₁₀(MAX² / MSE)'
  },
  ssim: {
    name: 'Structural Similarity Index',
    unit: 'ratio',
    range: '0-1',
    interpretation: 'Measures perceptual quality. >0.9 is excellent, >0.8 is very good.',
    formula: 'Combines luminance, contrast, and structural comparison'
  },
  illuminationGain: {
    name: 'Illumination Enhancement Factor',
    unit: '×',
    range: '1-4×',
    interpretation: 'Average brightness increase. 1.5-2.5× is typical for low-light enhancement.',
    formula: 'Enhanced brightness / Original brightness'
  },
  contrastImprovement: {
    name: 'Contrast Enhancement',
    unit: '%',
    range: '10-100%',
    interpretation: 'Dynamic range expansion. Higher values mean better detail visibility.',
    formula: '((Enhanced - Original) / Original) × 100'
  },
  entropy: {
    name: 'Information Entropy',
    unit: 'bits',
    range: '4-8 bits',
    interpretation: 'Measures detail and texture. Higher entropy = more preserved detail.',
    formula: '-Σ P(i) × log₂(P(i))'
  },
  naturalness: {
    name: 'Perceptual Naturalness Score',
    unit: 'score',
    range: '2-7',
    interpretation: 'Lower is better. <3 indicates natural-looking results without artifacts.',
    formula: 'Statistical deviation from natural image properties'
  },
  colorFidelity: {
    name: 'Color Preservation',
    unit: '%',
    range: '0-100%',
    interpretation: 'Color accuracy. >90% indicates excellent color fidelity.',
    formula: '1 - (Color distance / Maximum distance)'
  }
};