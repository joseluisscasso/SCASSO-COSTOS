/* SCASSO — Aritmética decimal exacta (BigInt, 30 decimales). Sin floats en ningún cálculo. */
(function (g) {
  'use strict';
  const S = 30;
  const ONE = 10n ** 30n;
  g.SC = g.SC || {};

  function divRound(n, d) {
    if (d === 0n) throw new Error('División por cero');
    const neg = (n < 0n) !== (d < 0n);
    const a = n < 0n ? -n : n, b = d < 0n ? -d : d;
    let q = a / b;
    if ((a % b) * 2n >= b) q += 1n;
    return neg ? -q : q;
  }

  class D {
    constructor(v) { this.v = v; }
    static parse(str) {
      let s = String(str).trim();
      const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
      if (!m || ((m[2] || '') === '' && (m[3] || '') === '')) throw new Error('Número inválido: ' + s);
      const int = m[2] || '', frac = m[3] || '', exp = m[4] ? parseInt(m[4], 10) : 0;
      const digits = int + frac;
      const point = int.length + exp;
      let ip, fp;
      if (point <= 0) { ip = '0'; fp = '0'.repeat(-point) + digits; }
      else if (point >= digits.length) { ip = digits + '0'.repeat(point - digits.length); fp = ''; }
      else { ip = digits.slice(0, point); fp = digits.slice(point); }
      let v = BigInt(ip || '0') * ONE + BigInt((fp + '0'.repeat(S)).slice(0, S));
      if (m[1] === '-') v = -v;
      return new D(v);
    }
    static of(x) {
      if (x instanceof D) return x;
      if (typeof x === 'bigint') return new D(x * ONE);
      if (typeof x === 'number') { if (!Number.isFinite(x)) throw new Error('Número inválido'); return D.parse(String(x)); }
      return D.parse(x);
    }
    add(o) { return new D(this.v + D.of(o).v); }
    sub(o) { return new D(this.v - D.of(o).v); }
    mul(o) { return new D(divRound(this.v * D.of(o).v, ONE)); }
    div(o) {
      o = D.of(o);
      if (o.v === 0n) throw new Error('División por cero');
      return new D(divRound(this.v * ONE, o.v));
    }
    neg() { return new D(-this.v); }
    abs() { return new D(this.v < 0n ? -this.v : this.v); }
    cmp(o) { o = D.of(o); return this.v < o.v ? -1 : this.v > o.v ? 1 : 0; }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    lte(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; }
    gte(o) { return this.cmp(o) >= 0; }
    isZero() { return this.v === 0n; }
    isNeg() { return this.v < 0n; }
    isPos() { return this.v > 0n; }
    floor() { let q = this.v / ONE; if (this.v < 0n && this.v % ONE !== 0n) q -= 1n; return new D(q * ONE); }
    ceil() { let q = this.v / ONE; if (this.v > 0n && this.v % ONE !== 0n) q += 1n; return new D(q * ONE); }
    round(dp) { const f = 10n ** BigInt(S - dp); return new D(divRound(this.v, f) * f); }
    toFixed(dp) {
      const r = divRound(this.v, 10n ** BigInt(S - dp));
      const neg = r < 0n; const a = neg ? -r : r;
      const s = a.toString().padStart(dp + 1, '0');
      const out = dp === 0 ? s : s.slice(0, s.length - dp) + '.' + s.slice(s.length - dp);
      return (neg && a !== 0n ? '-' : '') + out;
    }
    toString() {
      let v = this.v; const neg = v < 0n; if (neg) v = -v;
      const s = v.toString().padStart(S + 1, '0');
      const f = s.slice(-S).replace(/0+$/, '');
      return (neg ? '-' : '') + s.slice(0, -S) + (f ? '.' + f : '');
    }
    toNumber() { return Number(this.toString()); }
    toJSON() { return this.toString(); }
    static sum(arr) { return arr.reduce((a, b) => a.add(b), new D(0n)); }
    static min(a, b) { return a.lt(b) ? a : b; }
    static max(a, b) { return a.gt(b) ? a : b; }
  }
  g.SC.D = D;
})(typeof window !== 'undefined' ? window : globalThis);
