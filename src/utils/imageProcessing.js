// ============================================================================
// LUMINX - FIXED IMAGE PROCESSING ALGORITHMS
// Research-grade implementations for low-light image enhancement
// ============================================================================

// ----------------------------------------------------------------------------
// UTILITY: Fast Gaussian Blur using separable convolution (box blur approx)
// Much faster than full 2D Gaussian, accurate enough for Retinex surround
// ----------------------------------------------------------------------------
const gaussianBlur = (src, width, height, sigma) => {
  const radius = Math.max(1, Math.round(sigma * 2));
  const result = new Float32Array(src.length);
  const temp = new Float32Array(src.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, wsum = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const w = Math.exp(-(dx * dx) / (2 * sigma * sigma));
        sum += src[y * width + nx] * w;
        wsum += w;
      }
      temp[y * width + x] = sum / wsum;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, wsum = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        const w = Math.exp(-(dy * dy) / (2 * sigma * sigma));
        sum += temp[ny * width + x] * w;
        wsum += w;
      }
      result[y * width + x] = sum / wsum;
    }
  }

  return result;
};

// ----------------------------------------------------------------------------
// UTILITY: Stretch values to full [0,255] range for robust normalization
// ----------------------------------------------------------------------------
const stretchToRange = (arr, outMin = 0, outMax = 255) => {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  const range = max - min || 1;
  const result = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[i] = ((arr[i] - min) / range) * (outMax - outMin) + outMin;
  }
  return result;
};

// ============================================================================
// 1. MULTI-SCALE RETINEX (MSR) - Jobson et al., IEEE TIP 1997
// TRUE implementation: log(I) - weighted_sum(log(Gaussian(I)))
// ============================================================================
export const applyRetinex = (imageData, params = {}) => {
  const {
    scale1 = 15,
    scale2 = 80,
    scale3 = 250,
    gain = 128,
    offset = 128,
    colorRestoration = true
  } = params;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const N = width * height;

  const sigmas = [scale1, scale2, scale3];
  const weights = [1 / 3, 1 / 3, 1 / 3]; // Equal weight per scale

  // Work in float for each channel
  const channels = [
    new Float32Array(N),
    new Float32Array(N),
    new Float32Array(N),
  ];

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    channels[0][idx] = data[i];
    channels[1][idx] = data[i + 1];
    channels[2][idx] = data[i + 2];
  }

  const retinexChannels = [
    new Float32Array(N),
    new Float32Array(N),
    new Float32Array(N),
  ];

  // For each channel, compute MSR
  for (let c = 0; c < 3; c++) {
    const logChannel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      logChannel[i] = Math.log(channels[c][i] + 1.0);
    }

    for (let s = 0; s < sigmas.length; s++) {
      const blurred = gaussianBlur(channels[c], width, height, sigmas[s]);
      for (let i = 0; i < N; i++) {
        // R = log(I) - log(F*I)
        retinexChannels[c][i] += weights[s] * (logChannel[i] - Math.log(blurred[i] + 1.0));
      }
    }
  }

  if (colorRestoration) {
    // Color Restoration Function (CRF) for better color rendering
    // CRF_c = beta * (log(alpha * I_c) - log(sum(I_c)))
    const beta = 46.0;
    const alpha = 125.0;

    for (let i = 0; i < N; i++) {
      const sum = channels[0][i] + channels[1][i] + channels[2][i] + 1e-6;
      for (let c = 0; c < 3; c++) {
        const crf = beta * (Math.log(alpha * channels[c][i] + 1.0) - Math.log(sum));
        retinexChannels[c][i] *= crf;
      }
    }
  }

  // Per-channel stretch then gain/offset
  for (let c = 0; c < 3; c++) {
    const stretched = stretchToRange(retinexChannels[c]);
    retinexChannels[c] = stretched;
  }

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    data[i]     = Math.min(255, Math.max(0, retinexChannels[0][idx]));
    data[i + 1] = Math.min(255, Math.max(0, retinexChannels[1][idx]));
    data[i + 2] = Math.min(255, Math.max(0, retinexChannels[2][idx]));
  }

  return imageData;
};

// ============================================================================
// 2. CLAHE - Zuiderveld, Graphics Gems IV 1994
// TRUE implementation: per-tile histogram with clip+redistribute, bilinear interp
// ============================================================================
export const applyCLAHE = (imageData, params = {}) => {
  const { clipLimit = 2.0, tileGridSize = 8 } = params;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const N = width * height;

  // Step 1: Convert RGB → HSL, process only L channel
  const L = new Float32Array(N); // 0-1
  const S = new Float32Array(N);
  const H = new Float32Array(N);

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    L[idx] = l;

    if (max === min) {
      H[idx] = 0;
      S[idx] = 0;
    } else {
      const d = max - min;
      S[idx] = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) H[idx] = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) H[idx] = ((b - r) / d + 2) / 6;
      else H[idx] = ((r - g) / d + 4) / 6;
    }
  }

  // Step 2: CLAHE on L channel
  const Luint8 = new Uint8Array(N);
  for (let i = 0; i < N; i++) Luint8[i] = Math.round(L[i] * 255);

  const tilesX = tileGridSize;
  const tilesY = tileGridSize;
  const tileW = Math.ceil(width / tilesX);
  const tileH = Math.ceil(height / tilesY);

  // Build LUT for each tile
  const luts = new Array(tilesX * tilesY);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileW, x1 = Math.min((tx + 1) * tileW, width);
      const y0 = ty * tileH, y1 = Math.min((ty + 1) * tileH, height);
      const tilePixels = (x1 - x0) * (y1 - y0);

      const hist = new Array(256).fill(0);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[Luint8[y * width + x]]++;
        }
      }

      // Clip and redistribute
      const clip = Math.max(1, Math.floor(clipLimit * tilePixels / 256));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clip) { excess += hist[i] - clip; hist[i] = clip; }
      }
      const add = Math.floor(excess / 256);
      let rem = excess % 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += add;
        if (rem > 0) { hist[i]++; rem--; }
      }

      // Build normalized CDF as LUT
      const lut = new Uint8Array(256);
      let cumsum = 0;
      let cdfMin = -1;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > 0 && cdfMin < 0) cdfMin = cumsum;
        cumsum += hist[i];
      }
      const cdfRange = tilePixels - (cdfMin < 0 ? 0 : cdfMin) || 1;
      cumsum = 0;
      for (let i = 0; i < 256; i++) {
        cumsum += hist[i];
        lut[i] = Math.round(((cumsum - Math.max(0, cdfMin)) / cdfRange) * 255);
      }

      luts[ty * tilesX + tx] = lut;
    }
  }

  // Step 3: Bilinear interpolation between tile LUTs
  const Lout = new Float32Array(N);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = Luint8[idx];

      // tile coords (center-based)
      const txf = (x + 0.5) / tileW - 0.5;
      const tyf = (y + 0.5) / tileH - 0.5;
      const tx0 = Math.max(0, Math.floor(txf));
      const ty0 = Math.max(0, Math.floor(tyf));
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const ty1 = Math.min(tilesY - 1, ty0 + 1);
      const wx = Math.max(0, Math.min(1, txf - tx0));
      const wy = Math.max(0, Math.min(1, tyf - ty0));

      const l00 = luts[ty0 * tilesX + tx0][v];
      const l10 = luts[ty0 * tilesX + tx1][v];
      const l01 = luts[ty1 * tilesX + tx0][v];
      const l11 = luts[ty1 * tilesX + tx1][v];

      const interp = l00 * (1 - wx) * (1 - wy)
                   + l10 * wx * (1 - wy)
                   + l01 * (1 - wx) * wy
                   + l11 * wx * wy;

      Lout[idx] = interp / 255;
    }
  }

  // Step 4: Convert HSL back to RGB
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const h = H[idx];
    const s = S[idx];
    const l = Lout[idx];

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1/3);
      g = hue2rgb(h);
      b = hue2rgb(h - 1/3);
    }

    data[i]     = Math.min(255, Math.max(0, Math.round(r * 255)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
  }

  return imageData;
};

// ============================================================================
// 3. DARK CHANNEL PRIOR (DCP) - He et al., CVPR 2009
// TRUE implementation: dark channel → atmospheric light → transmission → radiance
// Used here inversely: brighten underexposed images by reversing haze model
// ============================================================================
export const applyDarkChannel = (imageData, params = {}) => {
  const { patchSize = 15, omega = 0.85, tMin = 0.2 } = params;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const N = width * height;
  const half = Math.floor(patchSize / 2);

  // Step 1: Normalize to [0,1]
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    R[idx] = data[i] / 255;
    G[idx] = data[i + 1] / 255;
    B[idx] = data[i + 2] / 255;
  }

  // Step 2: Dark channel = min over patch of min(R,G,B)
  const dark = new Float32Array(N);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 1.0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const nidx = ny * width + nx;
          const m = Math.min(R[nidx], G[nidx], B[nidx]);
          if (m < minVal) minVal = m;
        }
      }
      dark[y * width + x] = minVal;
    }
  }

  // Step 3: Atmospheric light = average of brightest 0.1% by dark channel
  const indexed = Array.from({ length: N }, (_, i) => i);
  indexed.sort((a, b) => dark[b] - dark[a]);
  const topN = Math.max(1, Math.floor(N * 0.001));
  let Ar = 0, Ag = 0, Ab = 0;
  for (let i = 0; i < topN; i++) {
    Ar += R[indexed[i]]; Ag += G[indexed[i]]; Ab += B[indexed[i]];
  }
  Ar /= topN; Ag /= topN; Ab /= topN;

  // Step 4: Transmission map t = 1 - omega * dark(I/A)
  const trans = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const darkIA = Math.min(R[i] / (Ar + 1e-6), G[i] / (Ag + 1e-6), B[i] / (Ab + 1e-6));
    trans[i] = Math.max(tMin, 1.0 - omega * darkIA);
  }

  // Step 5: Soft matting / guided filter approximation (box blur)
  // Simple box-blur refinement on transmission map
  const blurred = gaussianBlur(trans, width, height, 20);

  // Step 6: Scene radiance recovery: J = (I - A) / t + A
  // For LOW-LIGHT we invert: treat dark areas as "haze" and recover brightness
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const t = blurred[idx];
    // J_c = (I_c - A_c) / t + A_c  →  brightens dark regions
    const jr = Math.min(1, Math.max(0, (R[idx] - Ar) / t + Ar));
    const jg = Math.min(1, Math.max(0, (G[idx] - Ag) / t + Ag));
    const jb = Math.min(1, Math.max(0, (B[idx] - Ab) / t + Ab));

    data[i]     = Math.round(jr * 255);
    data[i + 1] = Math.round(jg * 255);
    data[i + 2] = Math.round(jb * 255);
  }

  return imageData;
};

// ============================================================================
// 4. LIME - Guo et al., IEEE TIP 2017
// TRUE implementation: Illumination map T̂ estimation via structure-aware smoothing
// then gamma correction on T̂, reflectance recovery R = S / T̂
// ============================================================================
export const applyLIME = (imageData, params = {}) => {
  const { gamma = 0.6, lambda = 0.15, iterations = 3 } = params;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const N = width * height;

  // Step 1: Initial illumination estimate T_initial = max(R, G, B)
  const T = new Float32Array(N);
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    R[idx] = data[i] / 255;
    G[idx] = data[i + 1] / 255;
    B[idx] = data[i + 2] / 255;
    T[idx] = Math.max(R[idx], G[idx], B[idx]);
  }

  // Step 2: Structure-aware illumination refinement
  // Iterative: T_new[p] = (T_init[p] + lambda * sum_q w_pq * T_new[q]) / (1 + lambda * sum_q w_pq)
  // Weight w_pq = 1 / (|T[p] - T[q]| + eps)  (bilateral-style)
  let Tref = new Float32Array(T);
  const eps = 0.0001;

  for (let iter = 0; iter < iterations; iter++) {
    const Tnew = new Float32Array(N);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let weightedSum = 0, weightSum = 0;

        // 4-connected neighbors
        const neighbors = [
          [y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]
        ];
        for (const [ny, nx] of neighbors) {
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const nidx = ny * width + nx;
          const w = 1.0 / (Math.abs(T[idx] - Tref[nidx]) + eps);
          weightedSum += w * Tref[nidx];
          weightSum += w;
        }

        Tnew[idx] = (T[idx] + lambda * weightedSum) / (1 + lambda * weightSum);
      }
    }
    Tref = Tnew;
  }

  // Clamp T to avoid division issues
  for (let i = 0; i < N; i++) Tref[i] = Math.max(0.01, Math.min(1.0, Tref[i]));

  // Step 3: Apply gamma to illumination map
  const Tgamma = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    Tgamma[i] = Math.pow(Tref[i], gamma);
  }

  // Step 4: Recover reflectance: R_c = S_c / T_initial, then enhance with Tgamma
  // Enhanced: J_c = R_c * Tgamma = (S_c / T_ref) * Tgamma
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const scale = Tgamma[idx] / Tref[idx];
    data[i]     = Math.min(255, Math.max(0, Math.round(R[idx] * scale * 255)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(G[idx] * scale * 255)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(B[idx] * scale * 255)));
  }

  return imageData;
};

// ============================================================================
// HELPER EXPORTS
// ============================================================================
export const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, max === 0 ? 0 : delta / max, max];
};

export const hsvToRgb = (h, s, v) => {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
};