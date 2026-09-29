/**
 * QR Code Generator - Standalone Vanilla JavaScript implementation
 * Supports QR Code Versions 1 to 10, Byte Mode (UTF-8), Error Correction Levels L and M,
 * with standard penalty scoring for optimal mask selection.
 * Generates crisp SVG and Canvas representations completely offline with zero dependencies.
 */
(function (global) {
  'use strict';

  // Galois Field GF(2^8) with primitive polynomial 0x11D (285)
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x & 128 ? 0x11D : 0);
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function polyMul(p1, p2) {
    const res = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        res[i + j] ^= gfMul(p1[i], p2[j]);
      }
    }
    return res;
  }

  function getGeneratorPoly(deg) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < deg; i++) {
      poly = polyMul(poly, new Uint8Array([1, EXP[i]]));
    }
    return poly;
  }

  function calcEC(data, ecCount) {
    const gen = getGeneratorPoly(ecCount);
    const msg = new Uint8Array(data.length + ecCount);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          msg[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  // Specifications for Error Correction Level M (15% recovery, good for retail & camera scan)
  // [version, totalCodewords, ecCount, numBlocks, alignmentCoords]
  const VERSIONS_M = [
    null,
    { ver: 1, total: 26, ec: 10, blocks: 1, align: [] },
    { ver: 2, total: 44, ec: 16, blocks: 1, align: [6, 18] },
    { ver: 3, total: 70, ec: 26, blocks: 1, align: [6, 22] },
    { ver: 4, total: 100, ec: 36, blocks: 2, align: [6, 26] },
    { ver: 5, total: 134, ec: 48, blocks: 2, align: [6, 30] },
    { ver: 6, total: 172, ec: 64, blocks: 4, align: [6, 34] },
    { ver: 7, total: 196, ec: 72, blocks: 4, align: [6, 22, 38] },
    { ver: 8, total: 242, ec: 88, blocks: 4, align: [6, 24, 42] },
    { ver: 9, total: 292, ec: 110, blocks: 5, align: [6, 26, 46] },
    { ver: 10, total: 346, ec: 130, blocks: 5, align: [6, 28, 50] }
  ];

  // Error Correction Level L fallback (7% recovery, higher capacity)
  const VERSIONS_L = [
    null,
    { ver: 1, total: 26, ec: 7, blocks: 1, align: [] },
    { ver: 2, total: 44, ec: 10, blocks: 1, align: [6, 18] },
    { ver: 3, total: 70, ec: 15, blocks: 1, align: [6, 22] },
    { ver: 4, total: 100, ec: 20, blocks: 1, align: [6, 26] },
    { ver: 5, total: 134, ec: 26, blocks: 1, align: [6, 30] },
    { ver: 6, total: 172, ec: 36, blocks: 2, align: [6, 34] },
    { ver: 7, total: 196, ec: 40, blocks: 2, align: [6, 22, 38] },
    { ver: 8, total: 242, ec: 48, blocks: 2, align: [6, 24, 42] },
    { ver: 9, total: 292, ec: 60, blocks: 2, align: [6, 26, 46] },
    { ver: 10, total: 346, ec: 72, blocks: 4, align: [6, 28, 50] }
  ];

  function textToUtf8(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        i++;
        code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function pickVersion(dataLen, ecLevel) {
    const list = ecLevel === 'L' ? VERSIONS_L : VERSIONS_M;
    for (let v = 1; v < list.length; v++) {
      const spec = list[v];
      const dataCap = spec.total - spec.ec;
      const lengthBits = (v < 10) ? 8 : 16;
      const reqBytes = Math.ceil((4 + lengthBits + dataLen * 8) / 8);
      if (reqBytes <= dataCap) {
        return { spec, ecLevel };
      }
    }
    if (ecLevel !== 'L') {
      return pickVersion(dataLen, 'L');
    }
    throw new Error('Data payload too large for QR Versions 1-10');
  }

  function encodeData(utf8, spec, ecLevel) {
    const dataCap = spec.total - spec.ec;
    const bits = [];

    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }

    // Byte mode: 0100
    pushBits(0b0100, 4);
    // Character count indicator: 8 bits for versions 1-9, 16 bits for version 10
    const lenBits = (spec.ver < 10) ? 8 : 16;
    pushBits(utf8.length, lenBits);

    // Data
    for (let i = 0; i < utf8.length; i++) {
      pushBits(utf8[i], 8);
    }

    // Terminator (up to 4 zero bits)
    const capBits = dataCap * 8;
    const termLen = Math.min(4, capBits - bits.length);
    pushBits(0, termLen);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }

    // Alternate pad bytes (0xEC, 0x11)
    const pad = [0xEC, 0x11];
    let padIdx = 0;
    while (bits.length < capBits) {
      pushBits(pad[padIdx % 2], 8);
      padIdx++;
    }

    // Group into data bytes
    const dataBytes = new Uint8Array(dataCap);
    for (let i = 0; i < dataCap; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataBytes[i] = b;
    }

    // Block division & Error Correction calculation
    const numBlocks = spec.blocks;
    const shortBlockLen = Math.floor(dataCap / numBlocks);
    const numLongBlocks = dataCap % numBlocks;
    const blockEcLen = Math.floor(spec.ec / numBlocks);

    const dataBlocks = [];
    const ecBlocks = [];

    let offset = 0;
    for (let b = 0; b < numBlocks; b++) {
      const bLen = shortBlockLen + (b >= numBlocks - numLongBlocks ? 1 : 0);
      const dBlock = dataBytes.slice(offset, offset + bLen);
      offset += bLen;
      dataBlocks.push(dBlock);
      ecBlocks.push(calcEC(dBlock, blockEcLen));
    }

    // Interleave data codewords
    const finalCodewords = [];
    const maxDLen = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxDLen; i++) {
      for (let b = 0; b < numBlocks; b++) {
        if (i < dataBlocks[b].length) {
          finalCodewords.push(dataBlocks[b][i]);
        }
      }
    }

    // Interleave EC codewords
    const maxEcLen = ecBlocks[0].length;
    for (let i = 0; i < maxEcLen; i++) {
      for (let b = 0; b < numBlocks; b++) {
        finalCodewords.push(ecBlocks[b][i]);
      }
    }

    return finalCodewords;
  }

  function createMatrix(version, alignCoords) {
    const size = version * 4 + 17;
    const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const reserved = Array.from({ length: size }, () => new Uint8Array(size));

    function setModule(r, c, val, isRes = true) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = val ? 1 : 0;
        if (isRes) reserved[r][c] = 1;
      }
    }

    // Finder patterns (7x7) + separators
    function addFinder(topR, topC) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const row = topR + r;
          const col = topC + c;
          if (row < 0 || row >= size || col < 0 || col >= size) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isDark = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
            setModule(row, col, isDark, true);
          } else {
            setModule(row, col, 0, true);
          }
        }
      }
    }

    addFinder(0, 0);
    addFinder(0, size - 7);
    addFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      setModule(6, i, i % 2 === 0, true);
      setModule(i, 6, i % 2 === 0, true);
    }

    // Alignment patterns for versions >= 2
    if (alignCoords && alignCoords.length > 0) {
      for (let i = 0; i < alignCoords.length; i++) {
        for (let j = 0; j < alignCoords.length; j++) {
          const ar = alignCoords[i];
          const ac = alignCoords[j];
          if (reserved[ar][ac]) continue; // Skip if overlapping finder pattern
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const isDark = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
              setModule(ar + r, ac + c, isDark, true);
            }
          }
        }
      }
    }

    // Dark module at (4*V + 9, 8)
    setModule(size - 8, 8, 1, true);

    // Reserve format info area
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        reserved[8][i] = 1;
        reserved[i][8] = 1;
      }
    }
    for (let i = size - 8; i < size; i++) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }

    return { matrix, reserved, size };
  }

  // Precalculated Format Info (BCH 15,5 with mask 0x5412)
  // Level L: 01, Level M: 00
  const FORMAT_INFO = {
    // Level M (00)
    M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
    // Level L (01)
    L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976]
  };

  function placeFormatInfo(matrix, maskPattern, ecLevel) {
    const size = matrix.length;
    const format = FORMAT_INFO[ecLevel][maskPattern];
    const bits = [];
    for (let i = 14; i >= 0; i--) {
      bits.push((format >> i) & 1);
    }

    // Around top-left finder
    const pos1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (let i = 0; i < 15; i++) {
      const [r, c] = pos1[i];
      matrix[r][c] = bits[i];
    }

    // Around bottom-left & top-right finders
    for (let i = 0; i < 7; i++) {
      matrix[size - 1 - i][8] = bits[i];
    }
    for (let i = 7; i < 15; i++) {
      matrix[8][size - 15 + i] = bits[i];
    }
  }

  function maskCondition(pattern, r, c) {
    switch (pattern) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  // Calculate penalty score for ISO mask evaluation
  function calcPenalty(mat, size) {
    let penalty = 0;

    // Rule 1: 5 or more same color in row/col
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (mat[r][c] === mat[r][c - 1]) {
          run++;
        } else {
          if (run >= 5) penalty += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (mat[r][c] === mat[r - 1][c]) {
          run++;
        } else {
          if (run >= 5) penalty += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }

    // Rule 2: 2x2 same color blocks
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const val = mat[r][c];
        if (val === mat[r + 1][c] && val === mat[r][c + 1] && val === mat[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // Rule 4: Balance of dark/light modules
    let dark = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (mat[r][c] === 1) dark++;
      }
    }
    const total = size * size;
    const ratio = (dark / total) * 100;
    const diff = Math.abs(ratio - 50);
    penalty += Math.floor(diff / 5) * 10;

    return penalty;
  }

  function generateMatrix(text, targetEc = 'M') {
    const utf8 = textToUtf8(text);
    const { spec, ecLevel } = pickVersion(utf8.length, targetEc);
    const codewords = encodeData(utf8, spec, ecLevel);
    const base = createMatrix(spec.ver, spec.align);
    const size = base.size;

    // Evaluate all 8 masks to pick the optimal one
    let bestMask = 0;
    let bestScore = Infinity;
    let bestMatrix = null;

    for (let mask = 0; mask < 8; mask++) {
      // Copy matrix
      const testMat = Array.from({ length: size }, (_, r) => new Int8Array(base.matrix[r]));

      let codewordIdx = 0;
      let bitIdx = 7;
      let upward = true;

      for (let right = size - 1; right > 0; right -= 2) {
        if (right === 6) right--; // skip timing column

        const rows = [];
        for (let i = 0; i < size; i++) {
          rows.push(upward ? size - 1 - i : i);
        }

        for (const r of rows) {
          for (let colOffset = 0; colOffset < 2; colOffset++) {
            const c = right - colOffset;
            if (base.reserved[r][c]) continue;

            let bit = 0;
            if (codewordIdx < codewords.length) {
              bit = (codewords[codewordIdx] >> bitIdx) & 1;
              bitIdx--;
              if (bitIdx < 0) {
                bitIdx = 7;
                codewordIdx++;
              }
            }

            const masked = maskCondition(mask, r, c) ? (bit ^ 1) : bit;
            testMat[r][c] = masked;
          }
        }
        upward = !upward;
      }

      placeFormatInfo(testMat, mask, ecLevel);
      const score = calcPenalty(testMat, size);
      if (score < bestScore) {
        bestScore = score;
        bestMask = mask;
        bestMatrix = testMat;
      }
    }

    return { matrix: bestMatrix, size, version: spec.ver, mask: bestMask };
  }

  /**
   * Generates a scalable vector SVG string representing the QR code.
   * @param {string} text - Content or URL to encode.
   * @param {object} options - Configuration { size: 240, margin: 4, darkColor: '#000000', lightColor: '#ffffff' }
   * @returns {string} SVG HTML string
   */
  function generateSVG(text, options = {}) {
    const qr = generateMatrix(text, options.ecLevel || 'M');
    const margin = options.margin !== undefined ? options.margin : 3;
    const fullSize = qr.size + margin * 2;
    const darkColor = options.darkColor || '#0f172a';
    const lightColor = options.lightColor || '#ffffff';
    const displaySize = options.size || 220;

    let pathD = '';
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.matrix[r][c] === 1) {
          pathD += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return `
      <svg class="qr-svg-rendered" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${displaySize}" height="${displaySize}" shape-rendering="crispEdges">
        <rect width="${fullSize}" height="${fullSize}" fill="${lightColor}" />
        <path d="${pathD}" fill="${darkColor}" />
      </svg>
    `.trim();
  }

  /**
   * Renders the QR code directly onto an HTML5 <canvas> element.
   * @param {HTMLCanvasElement} canvas
   * @param {string} text
   * @param {object} options
   */
  function drawCanvas(canvas, text, options = {}) {
    if (!canvas || !canvas.getContext) return;
    const qr = generateMatrix(text, options.ecLevel || 'M');
    const margin = options.margin !== undefined ? options.margin : 3;
    const fullModules = qr.size + margin * 2;
    const displaySize = options.size || 220;
    const scale = Math.floor(displaySize / fullModules) || 4;
    const totalDim = fullModules * scale;

    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = options.lightColor || '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    ctx.fillStyle = options.darkColor || '#0f172a';
    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (qr.matrix[r][c] === 1) {
          ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
      }
    }
  }

  const StockProQR = {
    generateMatrix,
    generateSVG,
    drawCanvas
  };

  if (typeof window !== 'undefined') {
    window.StockProQR = StockProQR;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockProQR;
  }
})(typeof window !== 'undefined' ? window : globalThis);
