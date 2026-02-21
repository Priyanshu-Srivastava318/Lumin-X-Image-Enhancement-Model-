// ============================================================================
// LUMINX — IMAGE PROCESSING ALGORITHMS (STABLE FINAL)
// ============================================================================

// ─── Box blur (fast O(N) Gaussian approximation) ──────────────────────────
const boxBlurPass = (src, width, height, radius) => {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const inv = 1 / (2 * radius + 1);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x < Math.min(radius + 1, width); x++) sum += src[row + x];
    for (let x = 0; x < width; x++) {
      if (x + radius < width)  sum += src[row + x + radius];
      if (x - radius - 1 >= 0) sum -= src[row + x - radius - 1];
      tmp[row + x] = sum * inv;
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < Math.min(radius + 1, height); y++) sum += tmp[y * width + x];
    for (let y = 0; y < height; y++) {
      if (y + radius < height)  sum += tmp[(y + radius) * width + x];
      if (y - radius - 1 >= 0)  sum -= tmp[(y - radius - 1) * width + x];
      out[y * width + x] = sum * inv;
    }
  }
  return out;
};

const gaussianBlur = (src, width, height, sigma) => {
  const r = Math.max(1, Math.round(sigma * 0.8)) | 0;
  let res = boxBlurPass(src, width, height, r);
  res     = boxBlurPass(res, width, height, r);
  res     = boxBlurPass(res, width, height, Math.max(1, r - 1));
  return res;
};

const stretchToRange = (arr) => {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  const range = (max - min) || 1;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = ((arr[i] - min) / range) * 255;
  return out;
};

// ─── Brightness detection ─────────────────────────────────────────────────
export const detectBrightness = (imageData) => {
  const data = imageData.data;
  let sum = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const luminance = sum / total;
  let level = 'dark';
  if (luminance > 150) level = 'bright';
  else if (luminance > 85) level = 'medium';
  return { luminance: Math.round(luminance), level };
};

// ─── Smart wrapper ────────────────────────────────────────────────────────
export const smartEnhance = (imageData, algorithm, params) => {
  const detection = detectBrightness(imageData);
  let mode = 'full';

  if (detection.level === 'bright') {
    mode = 'gentle';
    return {
      imageData: applyCLAHEInternal(imageData, { clipLimit: 1.2, tileGridSize: 8 }),
      detection: { ...detection, mode },
    };
  }

  if (detection.level === 'medium') {
    mode = 'medium';
    const safeParams = { ...params };
    if (algorithm === 'lime')         safeParams.gamma  = Math.min((params.gamma  || 0.6)  + 0.15, 0.92);
    if (algorithm === 'dark_channel') safeParams.omega  = Math.min((params.omega  || 0.85) * 0.85,  0.75);
    if (algorithm === 'retinex')      safeParams.colorRestoration = false;
    return {
      imageData: dispatchAlgorithm(imageData, algorithm, safeParams),
      detection: { ...detection, mode },
    };
  }

  return {
    imageData: dispatchAlgorithm(imageData, algorithm, params),
    detection: { ...detection, mode },
  };
};

const dispatchAlgorithm = (imageData, algorithm, params) => {
  switch (algorithm) {
    case 'retinex':      return applyRetinexInternal(imageData, params);
    case 'clahe':        return applyCLAHEInternal(imageData, params);
    case 'dark_channel': return applyDarkChannelInternal(imageData, params);
    case 'lime':         return applyLIMEInternal(imageData, params);
    default:             return imageData;
  }
};

// ============================================================================
// 1. MSR — Jobson et al., IEEE TIP 1997
// ============================================================================
const applyRetinexInternal = (imageData, params = {}) => {
  const { scale1 = 15, scale2 = 80, scale3 = 250 } = params;
  const data = imageData.data, width = imageData.width, height = imageData.height;
  const N = width * height, w = 1 / 3;

  const Ch = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    Ch[0][idx] = data[i]; Ch[1][idx] = data[i + 1]; Ch[2][idx] = data[i + 2];
  }

  const retinex = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for (let c = 0; c < 3; c++) {
    const logCh = new Float32Array(N);
    for (let i = 0; i < N; i++) logCh[i] = Math.log(Ch[c][i] + 1);
    for (const sigma of [scale1, scale2, scale3]) {
      const blurred = gaussianBlur(Ch[c], width, height, sigma);
      for (let i = 0; i < N; i++) {
        retinex[c][i] += w * (logCh[i] - Math.log(blurred[i] + 1));
      }
    }
  }

  for (let c = 0; c < 3; c++) {
    const stretched = stretchToRange(retinex[c]);
    for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
      data[i + c] = Math.min(255, Math.max(0, Math.round(stretched[idx])));
    }
  }
  return imageData;
};

export const applyRetinex = applyRetinexInternal;

// ============================================================================
// 2. CLAHE — Zuiderveld, Graphics Gems IV 1994
// ============================================================================
const applyCLAHEInternal = (imageData, params = {}) => {
  const { clipLimit = 2.0, tileGridSize = 8 } = params;
  const data = imageData.data, width = imageData.width, height = imageData.height;
  const N = width * height;

  const H = new Float32Array(N), S = new Float32Array(N), L = new Float32Array(N);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    L[idx] = l;
    if (mx === mn) { H[idx] = 0; S[idx] = 0; }
    else {
      const d = mx - mn;
      S[idx] = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if      (mx === r) H[idx] = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) H[idx] = ((b - r) / d + 2) / 6;
      else               H[idx] = ((r - g) / d + 4) / 6;
    }
  }

  const Luint = new Uint8Array(N);
  for (let i = 0; i < N; i++) Luint[i] = Math.round(L[i] * 255);

  const tilesX = tileGridSize, tilesY = tileGridSize;
  const tileW = Math.ceil(width / tilesX), tileH = Math.ceil(height / tilesY);
  const luts = new Array(tilesX * tilesY);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileW, x1 = Math.min(x0 + tileW, width);
      const y0 = ty * tileH, y1 = Math.min(y0 + tileH, height);
      const px = (x1 - x0) * (y1 - y0);
      const hist = new Int32Array(256);
      for (let y = y0; y < y1; y++) {
        const row = y * width;
        for (let x = x0; x < x1; x++) hist[Luint[row + x]]++;
      }
      const clip = Math.max(1, Math.floor(clipLimit * px / 256));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clip) { excess += hist[i] - clip; hist[i] = clip; }
      }
      const add = (excess / 256) | 0; let rem = excess % 256;
      for (let i = 0; i < 256; i++) { hist[i] += add; if (rem-- > 0) hist[i]++; }
      const lut = new Uint8Array(256);
      let cum = 0, cdfMin = -1;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > 0 && cdfMin < 0) cdfMin = cum;
        cum += hist[i];
      }
      const span = (px - Math.max(0, cdfMin)) || 1;
      cum = 0;
      for (let i = 0; i < 256; i++) {
        cum += hist[i];
        lut[i] = Math.round(Math.max(0, cum - Math.max(0, cdfMin)) / span * 255);
      }
      luts[ty * tilesX + tx] = lut;
    }
  }

  const Lout = new Float32Array(N);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const v = Luint[row + x];
      const txf = (x + 0.5) / tileW - 0.5, tyf = (y + 0.5) / tileH - 0.5;
      const tx0 = Math.max(0, Math.floor(txf)), tx1 = Math.min(tilesX - 1, tx0 + 1);
      const ty0 = Math.max(0, Math.floor(tyf)), ty1 = Math.min(tilesY - 1, ty0 + 1);
      const wx = Math.max(0, Math.min(1, txf - tx0));
      const wy = Math.max(0, Math.min(1, tyf - ty0));
      Lout[row + x] = (
        luts[ty0 * tilesX + tx0][v] * (1 - wx) * (1 - wy) +
        luts[ty0 * tilesX + tx1][v] *  wx       * (1 - wy) +
        luts[ty1 * tilesX + tx0][v] * (1 - wx) *  wy       +
        luts[ty1 * tilesX + tx1][v] *  wx       *  wy
      ) / 255;
    }
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const h = H[idx], s = S[idx], l = Lout[idx];
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    }
    data[i]     = Math.min(255, Math.max(0, Math.round(r * 255)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
  }
  return imageData;
};

export const applyCLAHE = applyCLAHEInternal;

// ============================================================================
// 3. DCP — He et al., CVPR 2009
// ============================================================================
const applyDarkChannelInternal = (imageData, params = {}) => {
  const { patchSize = 15, omega = 0.85, tMin = 0.2 } = params;
  const data = imageData.data, width = imageData.width, height = imageData.height;
  const N = width * height, half = (patchSize / 2) | 0;

  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    R[idx] = data[i] / 255; G[idx] = data[i + 1] / 255; B[idx] = data[i + 2] / 255;
  }

  const minRGB = new Float32Array(N);
  for (let i = 0; i < N; i++) minRGB[i] = Math.min(R[i], G[i], B[i]);

  const tmpH = new Float32Array(N);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let mn = 1;
      const x0 = Math.max(0, x - half), x1 = Math.min(width - 1, x + half);
      for (let xx = x0; xx <= x1; xx++) if (minRGB[row + xx] < mn) mn = minRGB[row + xx];
      tmpH[row + x] = mn;
    }
  }
  const dark = new Float32Array(N);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let mn = 1;
      const y0 = Math.max(0, y - half), y1 = Math.min(height - 1, y + half);
      for (let yy = y0; yy <= y1; yy++) if (tmpH[yy * width + x] < mn) mn = tmpH[yy * width + x];
      dark[y * width + x] = mn;
    }
  }

  const hist256 = new Int32Array(256);
  for (let i = 0; i < N; i++) hist256[Math.round(dark[i] * 255)]++;
  const topCount = Math.max(1, (N * 0.001) | 0);
  let remaining = topCount, thr = 255;
  while (thr > 0 && remaining > 0) remaining -= hist256[thr--];
  const thrVal = thr / 255;

  let Ar = 0, Ag = 0, Ab = 0, cnt = 0;
  for (let i = 0; i < N; i++) {
    if (dark[i] >= thrVal) { Ar += R[i]; Ag += G[i]; Ab += B[i]; cnt++; }
  }
  if (cnt === 0) { Ar = Ag = Ab = 0.8; cnt = 1; }
  Ar /= cnt; Ag /= cnt; Ab /= cnt;

  const trans = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = Math.min(R[i] / (Ar + 1e-6), G[i] / (Ag + 1e-6), B[i] / (Ab + 1e-6));
    trans[i] = Math.max(tMin, 1 - omega * d);
  }

  const r2 = Math.max(2, (patchSize / 4) | 0);
  const tSmooth = boxBlurPass(boxBlurPass(trans, width, height, r2), width, height, r2);

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const t = Math.max(tMin, tSmooth[idx]);
    data[i]     = Math.min(255, Math.max(0, Math.round(((R[idx] - Ar) / t + Ar) * 255)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(((G[idx] - Ag) / t + Ag) * 255)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(((B[idx] - Ab) / t + Ab) * 255)));
  }
  return imageData;
};

export const applyDarkChannel = applyDarkChannelInternal;

// ============================================================================
// 4. LIME — Guo et al., IEEE TIP 2017
// ============================================================================
const applyLIMEInternal = (imageData, params = {}) => {
  const { gamma = 0.6, lambda = 0.15, iterations = 2 } = params;
  const data = imageData.data, width = imageData.width, height = imageData.height;
  const N = width * height;

  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const T = new Float32Array(N);
  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    R[idx] = data[i] / 255; G[idx] = data[i + 1] / 255; B[idx] = data[i + 2] / 255;
    T[idx] = Math.max(R[idx], G[idx], B[idx]);
  }

  let Tref = new Float32Array(T);
  const eps = 1e-4;
  for (let iter = 0; iter < iterations; iter++) {
    const Tnew = new Float32Array(N);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x, tval = T[idx];
        let wsum = 0, vsum = 0;
        const nb = [
          y > 0          ? idx - width : -1,
          y < height - 1 ? idx + width : -1,
          x > 0          ? idx - 1     : -1,
          x < width  - 1 ? idx + 1     : -1,
        ];
        for (let n = 0; n < 4; n++) {
          const ni = nb[n]; if (ni < 0) continue;
          const wt = 1 / (Math.abs(tval - Tref[ni]) + eps);
          vsum += wt * Tref[ni]; wsum += wt;
        }
        Tnew[idx] = (tval + lambda * vsum) / (1 + lambda * wsum);
      }
    }
    Tref = Tnew;
  }

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    const t  = Math.max(0.01, Math.min(1, Tref[idx]));
    const sc = Math.pow(t, gamma) / t;
    data[i]     = Math.min(255, Math.max(0, Math.round(R[idx] * sc * 255)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(G[idx] * sc * 255)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(B[idx] * sc * 255)));
  }
  return imageData;
};

export const applyLIME = applyLIMEInternal;

export const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if      (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else               h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, mx ? d / mx : 0, mx];
};

export const hsvToRgb = (h, s, v) => {
  h /= 60;
  const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  const hi = h | 0;
  if      (hi === 0) [r, g, b] = [c, x, 0];
  else if (hi === 1) [r, g, b] = [x, c, 0];
  else if (hi === 2) [r, g, b] = [0, c, x];
  else if (hi === 3) [r, g, b] = [0, x, c];
  else if (hi === 4) [r, g, b] = [x, 0, c];
  else               [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};