// Advanced Image Enhancement Algorithms

/**
 * Multi-Scale Retinex Algorithm
 * Enhances image by decomposing it into illumination and reflectance
 */
export const applyRetinex = (imageData) => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  const scales = [15, 80, 250]; // Multi-scale sigma values
  const weights = [1/3, 1/3, 1/3];
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // Log domain processing
    const logR = Math.log(Math.max(r, 1));
    const logG = Math.log(Math.max(g, 1));
    const logB = Math.log(Math.max(b, 1));
    
    // Simplified Retinex (without full Gaussian blur for performance)
    const enhancedR = logR * 1.5;
    const enhancedG = logG * 1.5;
    const enhancedB = logB * 1.5;
    
    // Exp domain
    data[i] = Math.min(255, Math.max(0, Math.exp(enhancedR)));
    data[i + 1] = Math.min(255, Math.max(0, Math.exp(enhancedG)));
    data[i + 2] = Math.min(255, Math.max(0, Math.exp(enhancedB)));
  }
  
  return imageData;
};

/**
 * CLAHE - Contrast Limited Adaptive Histogram Equalization
 * Improves local contrast
 */
export const applyCLAHE = (imageData) => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Convert to grayscale for histogram
  const histogram = new Array(256).fill(0);
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }
  
  // Calculate cumulative distribution
  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }
  
  // Normalize CDF
  const totalPixels = width * height;
  const cdfMin = cdf.find(val => val > 0);
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const newGray = Math.round(((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255);
    
    const ratio = newGray / Math.max(gray, 1);
    data[i] = Math.min(255, data[i] * ratio);
    data[i + 1] = Math.min(255, data[i + 1] * ratio);
    data[i + 2] = Math.min(255, data[i + 2] * ratio);
  }
  
  return imageData;
};

/**
 * Dark Channel Prior
 * Removes haze and enhances visibility
 */
export const applyDarkChannel = (imageData) => {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Dark channel = minimum of RGB
    const darkChannel = Math.min(r, g, b);
    
    // Atmospheric light estimation (simplified)
    const atmosphericLight = 220;
    
    // Transmission estimation
    const transmission = 1 - 0.95 * (darkChannel / atmosphericLight);
    
    // Recover scene radiance
    data[i] = Math.min(255, Math.max(0, (r - atmosphericLight * (1 - transmission)) / Math.max(transmission, 0.1) + atmosphericLight));
    data[i + 1] = Math.min(255, Math.max(0, (g - atmosphericLight * (1 - transmission)) / Math.max(transmission, 0.1) + atmosphericLight));
    data[i + 2] = Math.min(255, Math.max(0, (b - atmosphericLight * (1 - transmission)) / Math.max(transmission, 0.1) + atmosphericLight));
  }
  
  return imageData;
};

/**
 * LIME - Low-light Image Enhancement
 * Illumination map estimation and enhancement
 */
export const applyLIME = (imageData) => {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Illumination map (max RGB)
    const illumination = Math.max(r, g, b);
    
    // Enhanced illumination
    const enhancedIllumination = Math.pow(illumination / 255, 0.5) * 255;
    
    // Recover reflectance
    const ratio = enhancedIllumination / Math.max(illumination, 1);
    
    data[i] = Math.min(255, r * ratio * 1.2);
    data[i + 1] = Math.min(255, g * ratio * 1.2);
    data[i + 2] = Math.min(255, b * ratio * 1.2);
  }
  
  return imageData;
};

/**
 * Apply all enhancement parameters
 */
export const applyEnhancements = (imageData, params) => {
  const data = imageData.data;
  const {
    brightness = 1.0,
    contrast = 1.0,
    saturation = 1.0,
    sharpness = 0,
    exposure = 0,
    shadows = 0,
    highlights = 0,
    warmth = 0,
    gamma = 1.0,
    vibrance = 0,
    noiseReduction = 0
  } = params;
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // Brightness
    r *= brightness;
    g *= brightness;
    b *= brightness;
    
    // Exposure
    const exposureFactor = Math.pow(2, exposure);
    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;
    
    // Contrast
    r = ((r - 128) * contrast) + 128;
    g = ((g - 128) * contrast) + 128;
    b = ((b - 128) * contrast) + 128;
    
    // Gamma correction
    r = Math.pow(r / 255, 1 / gamma) * 255;
    g = Math.pow(g / 255, 1 / gamma) * 255;
    b = Math.pow(b / 255, 1 / gamma) * 255;
    
    // Saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;
    
    // Vibrance (affects less saturated colors more)
    const maxRGB = Math.max(r, g, b);
    const minRGB = Math.min(r, g, b);
    const currentSat = (maxRGB - minRGB) / Math.max(maxRGB, 1);
    const vibranceFactor = 1 + vibrance * (1 - currentSat);
    r = gray + (r - gray) * vibranceFactor;
    g = gray + (g - gray) * vibranceFactor;
    b = gray + (b - gray) * vibranceFactor;
    
    // Warmth (color temperature)
    r += warmth * 10;
    b -= warmth * 10;
    
    // Shadows and Highlights
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance < 128) {
      // Shadow adjustment
      const shadowFactor = 1 + (shadows / 100) * (1 - luminance / 128);
      r *= shadowFactor;
      g *= shadowFactor;
      b *= shadowFactor;
    } else {
      // Highlight adjustment
      const highlightFactor = 1 + (highlights / 100) * ((luminance - 128) / 127);
      r *= highlightFactor;
      g *= highlightFactor;
      b *= highlightFactor;
    }
    
    // Clamp values
    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }
  
  // Sharpness (simple unsharp mask approximation)
  if (sharpness > 0) {
    applySharpness(imageData, sharpness);
  }
  
  // Noise reduction
  if (noiseReduction > 0) {
    applyNoiseReduction(imageData, noiseReduction);
  }
  
  return imageData;
};

/**
 * Apply sharpness filter
 */
const applySharpness = (imageData, amount) => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const tempData = new Uint8ClampedArray(data);
  
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += tempData[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        data[idx] = Math.min(255, Math.max(0, data[idx] + (sum - data[idx]) * (amount / 100)));
      }
    }
  }
};

/**
 * Apply noise reduction (simple blur)
 */
const applyNoiseReduction = (imageData, amount) => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const tempData = new Uint8ClampedArray(data);
  const radius = Math.ceil(amount / 20);
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += tempData[idx];
            count++;
          }
        }
        const idx = (y * width + x) * 4 + c;
        data[idx] = sum / count;
      }
    }
  }
};
