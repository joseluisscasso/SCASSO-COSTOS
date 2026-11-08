/* SCASSO — Formato y lectura de números en formato argentino ($ 12.500,50). Solo se redondea para mostrar. */
(function (g) {
  'use strict';
  const D = g.SC.D;
  const group = (i) => i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  function fixed(d, dp) {
    const s = D.of(d).toFixed(dp);
    const neg = s[0] === '-';
    const [i, f] = s.replace('-', '').split('.');
    return (neg ? '-' : '') + group(i) + (f ? ',' + f : '');
  }
  const F = {
    fixed,
    money(d, dp) {
      if (d === null || d === undefined) return '—';
      d = D.of(d);
      if (dp === undefined) dp = d.abs().lt(1) && !d.isZero() ? 4 : 2;
      const s = fixed(d, dp);
      return s[0] === '-' ? '-$ ' + s.slice(1) : '$ ' + s;
    },
    num(d, maxDp) {
      if (d === null || d === undefined) return '—';
      maxDp = maxDp === undefined ? 3 : maxDp;
      let s = fixed(d, maxDp);
      if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
      return s;
    },
    pct(ratio, dp) {
      if (ratio === null || ratio === undefined) return '—';
      return fixed(D.of(ratio).mul(100), dp === undefined ? 2 : dp) + ' %';
    },
    // "12.500,50" / "7.5" / "1.500" → D ; null si no es válido
    parse(s) {
      if (s === null || s === undefined) return null;
      s = String(s).trim().replace(/[\s$%]/g, '');
      if (!s) return null;
      let c;
      if (s.includes(',')) c = s.replace(/\./g, '').replace(',', '.');
      else if (/^\d{1,3}(\.\d{3})+$/.test(s) && !/^0\./.test(s)) c = s.replace(/\./g, '');
      else c = s;
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(c)) return null;
      try { return D.of(c); } catch (e) { return null; }
    },
    // fecha local de hoy como AAAA-MM-DD (no UTC: en Argentina después de las 21 h UTC ya es "mañana")
    today() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); },
    date(iso) {
      if (!iso) return '—';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); // fecha sin hora: no convertir de zona horaria
      if (m) return m[3] + '/' + m[2] + '/' + m[1];
      const d = new Date(iso);
      if (isNaN(d)) return String(iso);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
  };
  g.SC.fmt = F;
})(typeof window !== 'undefined' ? window : globalThis);
