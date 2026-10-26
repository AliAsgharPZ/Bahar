/* ============================================================
 * بهار | مولد QR Code — پیاده‌سازی vendored تک‌فایلی
 * مرجع: Project Nayuki QR Code generator (TypeScript) — MIT License
 * https://www.nayuki.io/page/qr-code-generator-library
 * الگوریتم: ISO/IEC 18004 — انتخاب نسخه، RS-ECC، درهم‌بافی بلوک‌ها،
 * زیگزاگ، انتخاب ماسک بهینه با قواعد جریمه.
 * ============================================================ */

export type QrEcc = "LOW" | "MEDIUM" | "QUARTILE" | "HIGH";

type byte = number;
type int = number;

/* ---- Error correction levels ---- */
class Ecc {
  public static readonly LOW = new Ecc(0, 1);
  public static readonly MEDIUM = new Ecc(1, 0);
  public static readonly QUARTILE = new Ecc(2, 3);
  public static readonly HIGH = new Ecc(3, 2);

  public constructor(
    public readonly ordinal: int,
    public readonly formatBits: int,
  ) {}

  /** جدول تعداد کلمه‌کد ECC در هر بلوک [سطح][نسخه ۱..۴۰] */
  public static readonly ECC_CODEWORDS_PER_BLOCK: ReadonlyArray<ReadonlyArray<int>> = [
    // Low
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Medium
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    // Quartile
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // High
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];

  /** جدول تعداد بلوک‌های ECC [سطح][نسخه ۱..۴۰] */
  public static readonly NUM_ERROR_CORRECTION_BLOCKS: ReadonlyArray<ReadonlyArray<int>> = [
    // Low
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    // Medium
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    // Quartile
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    // High
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];
}

/* ---- Segment modes ---- */
class Mode {
  public constructor(
    public readonly modeBits: int,
  ) {}

  public numCharCountBits(ver: int): int {
    return this === Mode.NUMERIC ? (ver < 10 ? 10 : ver < 27 ? 12 : 14)
      : this === Mode.ALPHANUMERIC ? (ver < 10 ? 9 : ver < 27 ? 11 : 13)
      : this === Mode.BYTE ? (ver < 10 ? 8 : 16)
      : (ver < 10 ? 8 : ver < 27 ? 10 : 12);
  }

  public static readonly NUMERIC = new Mode(0x1);
  public static readonly ALPHANUMERIC = new Mode(0x2);
  public static readonly BYTE = new Mode(0x4);
  public static readonly KANJI = new Mode(0x8);
}

class QrSegment {
  public constructor(
    public readonly mode: Mode,
    public readonly numChars: int,
    public readonly data: Readonly<Array<byte>>,
  ) {}

  public static makeBytes(data: Readonly<Array<byte>>): QrSegment {
    const bits: Array<byte> = [];
    for (const b of data) appendBits(b, 8, bits); // هر بایت به ۸ بیت گسترش می‌یابد — seg.data آرایهٔ «بیت» است
    return new QrSegment(Mode.BYTE, data.length, bits);
  }

  public static makeSegments(text: string): Array<QrSegment> {
    if (isNumericOnly(text)) return [QrSegment.makeNumeric(text)];
    return [QrSegment.makeBytes(toUtf8(text))];
  }

  public static makeNumeric(digits: string): QrSegment {
    const b: Array<byte> = [];
    for (let i = 0; i < digits.length; ) {
      const n = Math.min(digits.length - i, 3);
      let val = 0;
      for (let j = 0; j < n; j++) val = val * 10 + (digits.charCodeAt(i + j) - 48);
      appendBits(val, n * 3 + 1, b);
      i += n;
    }
    return new QrSegment(Mode.NUMERIC, digits.length, b);
  }

  public static getTotalBits(segs: Readonly<Array<QrSegment>>, version: int): int {
    let result: int = 0;
    for (const seg of segs) {
      const ccbits: int = seg.mode.numCharCountBits(version);
      if (seg.numChars >= 1 << ccbits) return Infinity;
      result += 4 + ccbits + seg.data.length; // data بیت است — بدون ×۸
    }
    return result;
  }
}

function isNumericOnly(text: string): boolean {
  for (const c of text) {
    if (c < "0" || c > "9") return false;
  }
  return text.length > 0;
}

/* ---- QR Code symbol ---- */
class QrCode {
  public static readonly MIN_VERSION: int = 1;
  public static readonly MAX_VERSION: int = 40;

  public readonly version: int;
  public readonly size: int;
  public readonly errorCorrectionLevel: Ecc;
  public mask: int = -1;

  private modules: Array<Array<boolean>> = [];
  private isFunction: Array<Array<boolean>> = [];

  private constructor(version: int, ecl: Ecc, dataCodewords: Readonly<Array<byte>>, msk: int) {
    this.version = version;
    this.errorCorrectionLevel = ecl;
    this.size = version * 4 + 17;

    const row: Array<boolean> = [];
    for (let i = 0; i < this.size; i++) row.push(false);
    for (let i = 0; i < this.size; i++) {
      this.modules.push(row.slice());
      this.isFunction.push(row.slice());
    }

    this.drawFunctionPatterns();
    const allCodewords: Array<byte> = this.addEccAndInterleave(version, ecl, dataCodewords);
    this.drawCodewords(allCodewords);

    // Do masking
    if (msk === -1) {
      let minPenalty: int = Infinity;
      for (let i = 0; i < 8; i++) {
        this.applyMask(i);
        this.drawFormatBits(i);
        const penalty: int = this.getPenaltyScore();
        if (penalty < minPenalty) {
          this.mask = i;
          minPenalty = penalty;
        }
        this.applyMask(i); // Undoes the mask due to XOR
      }
    } else {
      this.mask = msk;
    }
    this.applyMask(this.mask);
    this.drawFormatBits(this.mask); // Overwrite old format bits
  }

  public static encodeText(text: string, ecl: Ecc): QrCode {
    const segs = QrSegment.makeSegments(text);
    return QrCode.encodeSegments(segs, ecl);
  }

  public static encodeSegments(segs: Readonly<Array<QrSegment>>, ecl: Ecc, minVersion: int = 1, maxVersion: int = 40, boostEcl: boolean = true): QrCode {
    if (!(QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MAX_VERSION) || boostEcl == null) {
      throw new RangeError("Invalid value");
    }

    // Find the minimal version number to use
    let version: int;
    let dataUsedBits: int;
    for (version = minVersion; ; version++) {
      const dataCapacityBits: int = QrCode.getNumDataCodewords(version, ecl) * 8;
      const usedBits: int = QrSegment.getTotalBits(segs, version);
      if (usedBits <= dataCapacityBits) {
        dataUsedBits = usedBits;
        break;
      }
      if (version >= maxVersion) throw new RangeError("Data too long");
    }

    // Increase the error correction level while the data still fits
    let actualEcl = ecl;
    if (boostEcl) {
      for (const newEcl of [Ecc.MEDIUM, Ecc.QUARTILE, Ecc.HIGH]) {
        if (dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8) {
          actualEcl = newEcl;
        }
      }
    }

    // Concatenate all segments to create the data bit string
    const bb: Array<byte> = []; // بافر بیتی (هر عنصر یک بیت ۰/۱)
    for (const seg of segs) {
      appendBits(seg.mode.modeBits, 4, bb);
      appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
      for (const b of seg.data) bb.push(b);
    }
    const dataCapBits: int = QrCode.getNumDataCodewords(version, actualEcl) * 8;
    if (bb.length > dataCapBits) throw new Error("Assertion error");
    // Add terminator, then pad to byte boundary
    appendBits(0, Math.min(4, dataCapBits - bb.length), bb);
    appendBits(0, (8 - (bb.length % 8)) % 8, bb);
    // Pad with alternating bytes until data capacity is reached
    for (let padByte = 0xec; bb.length < dataCapBits; padByte ^= 0xec ^ 0x11) {
      appendBits(padByte, 8, bb);
    }
    // Pack bits into bytes
    const dataCodewords: Array<byte> = [];
    while (bb.length > 0) {
      dataCodewords.push(bb.splice(0, 8).reduce((a, b) => ((a << 1) | b) & 0xff));
    }

    return new QrCode(version, actualEcl, dataCodewords, -1);
  }

  public getModule(x: int, y: int): boolean {
    return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
  }

  /* -- Private helper methods -- */

  private static getNumRawDataModules(ver: int): int {
    if (ver < QrCode.MIN_VERSION || ver > QrCode.MAX_VERSION) throw new RangeError("Version out of range");
    let result: int = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign: int = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  private static getNumDataCodewords(ver: int, ecl: Ecc): int {
    return (
      Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
      Ecc.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * Ecc.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
    );
  }

  private addEccAndInterleave(ver: int, ecl: Ecc, data: Readonly<Array<byte>>): Array<byte> {
    const numBlocks: int = Ecc.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    const blockEccLen: int = Ecc.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
    const rawCodewords: int = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
    const numShortBlocks: int = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen: int = Math.floor(rawCodewords / numBlocks);

    // Split data into blocks and add ECC to each block
    const blocks: Array<Array<byte>> = [];
    const rsDiv: Array<byte> = QrCode.reedSolomonComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat: Array<byte> = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc: Array<byte> = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0); // Padding byte; will be replaced by interleaving
      blocks.push(dat.concat(ecc));
    }

    // Interleave (concatenate) all blocks' data and error correction codewords together
    const result: Array<byte> = [];
    for (let i = 0; i < blocks[0].length; i++) {
      for (let j = 0; j < blocks.length; j++) {
        // Skip the padding byte in short blocks
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
          result.push(blocks[j][i]);
        }
      }
    }
    return result;
  }

  private static reedSolomonComputeDivisor(degree: int): Array<byte> {
    const result: Array<byte> = [];
    for (let i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    let root: int = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = QrCode.reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = QrCode.reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  private static reedSolomonComputeRemainder(data: Readonly<Array<byte>>, divisor: ReadonlyArray<byte>): Array<byte> {
    const result: Array<byte> = divisor.map(() => 0);
    for (const b of data) {
      const factor: int = b ^ (result.shift() as byte);
      result.push(0);
      divisor.forEach((coef, i) => (result[i] ^= QrCode.reedSolomonMultiply(coef, factor)));
    }
    return result;
  }

  private static reedSolomonMultiply(x: int, y: int): int {
    let z: int = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }

  private drawFunctionPatterns(): void {
    // Draw timing patterns
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }

    // Draw finder patterns
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // Draw alignment patterns
    const alignPatPos: Array<int> = this.getAlignmentPatternPositions();
    const numAlign: int = alignPatPos.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (!(i === 0 && j === 0 || i === 0 && j === numAlign - 1 || i === numAlign - 1 && j === 0)) {
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
        }
      }
    }

    // Draw reserve format bits (masked later)
    this.drawFormatBits(0);
    // Draw version
    this.drawVersion();
  }

  private drawFormatBits(mask: int): void {
    // Calculate error correction code and pack bits
    const data: int = this.errorCorrectionLevel.formatBits << 3 | mask;
    let rem: int = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits: int = (data << 10 | rem) ^ 0x5412; // uint13

    // Draw first copy
    for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));

    // Draw second copy
    for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true); // Always dark
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    // Calculate error correction code and pack bits
    let rem: int = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits: int = (this.version << 12) | rem; // uint18

    // Draw two copies
    for (let i = 0; i < 18; i++) {
      const color: boolean = getBit(bits, i);
      const a: int = this.size - 11 + (i % 3);
      const b: int = Math.floor(i / 3);
      this.setFunctionModule(a, b, color);
      this.setFunctionModule(b, a, color);
    }
  }

  private drawFinderPattern(x: int, y: int): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist: int = Math.max(Math.abs(dx), Math.abs(dy));
        const xx: int = x + dx;
        const yy: int = y + dy;
        if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size) {
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private drawAlignmentPattern(x: int, y: int): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  private setFunctionModule(x: int, y: int, isDark: boolean): void {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  private getAlignmentPatternPositions(): Array<int> {
    if (this.version === 1) return [];
    const numAlign: int = Math.floor(this.version / 7) + 2;
    const step: int = this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result: Array<int> = [6];
    for (let pos: int = this.size - 7; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos);
    }
    return result;
  }

  private drawCodewords(data: Readonly<Array<byte>>): void {
    if (data.length !== Math.floor(QrCode.getNumRawDataModules(this.version) / 8)) {
      throw new Error("Assertion error");
    }
    let i: int = 0; // Bit index into the data
    // Do the funny zigzag scan
    for (let right: int = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert: int = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x: int = right - j;
          const upward: boolean = ((right + 1) & 2) === 0;
          const y: int = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  private applyMask(msk: int): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (msk) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: throw new Error("Assertion error");
        }
        if (!this.isFunction[y][x] && invert) {
          this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
  }

  private getPenaltyScore(): int {
    let result: int = 0;

    // Adjacent modules in row having same color, and finder-like patterns
    for (let y = 0; y < this.size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory: Array<int> = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < this.size; x++) {
        if (this.modules[y][x] === runColor) {
          runX++;
          if (runX === 5) result += QrCode.PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runX, runHistory);
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runX = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PENALTY_N3;
    }
    // Same for columns
    for (let x = 0; x < this.size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory: Array<int> = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < this.size; y++) {
        if (this.modules[y][x] === runColor) {
          runY++;
          if (runY === 5) result += QrCode.PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          this.finderPenaltyAddHistory(runY, runHistory);
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
          runColor = this.modules[y][x];
          runY = 1;
        }
      }
      result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PENALTY_N3;
    }

    // 2x2 blocks having same color
    for (let y = 0; y < this.size - 1; y++) {
      for (let x = 0; x < this.size - 1; x++) {
        const color: boolean = this.modules[y][x];
        if (color === this.modules[y][x + 1] && color === this.modules[y + 1][x] && color === this.modules[y + 1][x + 1]) {
          result += QrCode.PENALTY_N2;
        }
      }
    }

    // Balance of dark and light modules
    let dark: int = 0;
    for (const row of this.modules) {
      for (const color of row) {
        if (color) dark++;
      }
    }
    const total: int = this.size * this.size;
    const k: int = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * QrCode.PENALTY_N4;
    return result;
  }

  private finderPenaltyCountPatterns(runHistory: ReadonlyArray<int>): int {
    const n: int = runHistory[1];
    const core: boolean =
      n > 0 && runHistory[2] === n && runHistory[4] === n && runHistory[5] === n && runHistory[3] === n * 3;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  }

  private finderPenaltyTerminateAndCount(currentRunColor: boolean, currentRunLength: int, runHistory: Array<int>): int {
    if (currentRunColor) {
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      currentRunLength = 0;
    }
    currentRunLength += this.size;
    this.finderPenaltyAddHistory(currentRunLength, runHistory);
    return this.finderPenaltyCountPatterns(runHistory);
  }

  private finderPenaltyAddHistory(currentRunLength: int, runHistory: Array<int>): void {
    if (runHistory[0] === 0) currentRunLength += this.size;
    runHistory.pop();
    runHistory.unshift(currentRunLength);
  }

  private static readonly PENALTY_N1: int = 3;
  private static readonly PENALTY_N2: int = 3;
  private static readonly PENALTY_N3: int = 40;
  private static readonly PENALTY_N4: int = 10;
}

/* ---- Utilities ---- */
function appendBits(val: int, len: int, bb: Array<byte>): void {
  if (len < 0 || len > 31 || val >>> len !== 0) throw new RangeError("Value out of range");
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}

function getBit(x: int, i: int): boolean {
  return ((x >>> i) & 1) !== 0;
}

function toUtf8(str: string): Array<byte> {
  const b: Array<byte> = [];
  for (const c of str) {
    const cp = c.codePointAt(0);
    if (cp === undefined) continue;
    if (cp < 0x80) b.push(cp);
    else if (cp < 0x800) b.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) b.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else b.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return b;
}

/* ---- API عمومی بهار ---- */

/** ساخت ماتریس QR (آرایه‌ای از ردیف‌های true=تیره) برای یک متن */
export function qrMatrix(text: string, ecl: QrEcc = "MEDIUM"): boolean[][] {
  const level =
    ecl === "LOW" ? Ecc.LOW : ecl === "QUARTILE" ? Ecc.QUARTILE : ecl === "HIGH" ? Ecc.HIGH : Ecc.MEDIUM;
  const qr = QrCode.encodeText(text, level);
  const matrix: boolean[][] = [];
  for (let y = 0; y < qr.size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < qr.size; x++) row.push(qr.getModule(x, y));
    matrix.push(row);
  }
  return matrix;
}

/** ساخت SVG استاندارد QR (تیره روی روشن) با حاشیه ۴ ماژول — آماده چاپ/برچسب */
export function qrSvg(
  text: string,
  opts: { ecl?: QrEcc; scale?: number; dark?: string; light?: string } = {},
): string {
  const { ecl = "MEDIUM", scale = 6, dark = "#000000", light = "#FFFFFF" } = opts;
  const m = qrMatrix(text, ecl);
  const n = m.length;
  const dim = (n + 8) * scale;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) path += `M${x + 4},${y + 4}h1v1h-1z`;
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${n + 8} ${n + 8}" width="${dim}" height="${dim}" shape-rendering="crispEdges">\n` +
    `  <rect width="${n + 8}" height="${n + 8}" fill="${light}"/>\n` +
    `  <path fill="${dark}" d="${path}"/>\n` +
    `</svg>\n`
  );
}


