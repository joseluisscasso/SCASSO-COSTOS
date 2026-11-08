/* SCASSO — Unidades y conversiones. Solo se convierte dentro de la misma magnitud; lo demás se bloquea. */
(function (g) {
  'use strict';
  const D = g.SC.D;
  const UNITS = {
    kg: { l: 'kg', long: 'Kilogramos', dim: 'masa', f: '1000' },
    g: { l: 'g', long: 'Gramos', dim: 'masa', f: '1' },
    l: { l: 'l', long: 'Litros', dim: 'vol', f: '1000' },
    ml: { l: 'ml', long: 'Mililitros', dim: 'vol', f: '1' },
    un: { l: 'un', long: 'Unidades', dim: 'cant', f: '1' },
    docena: { l: 'docena', long: 'Docenas', dim: 'cant', f: '12' },
    paquete: { l: 'paquete', long: 'Paquetes', dim: 'paquete', f: '1' },
    caja: { l: 'caja', long: 'Cajas', dim: 'caja', f: '1' },
    h: { l: 'h', long: 'Horas', dim: 'tiempo', f: '60' },
    min: { l: 'min', long: 'Minutos', dim: 'tiempo', f: '1' },
    porc: { l: 'porción', long: 'Porciones', dim: 'porcion', f: '1' },
  };
  // Unidad de visualización de cada magnitud y factor respecto de la unidad base (g, ml, un...)
  const DIMS = {
    masa: { base: 'g', disp: 'kg', label: 'peso' },
    vol: { base: 'ml', disp: 'l', label: 'volumen' },
    cant: { base: 'un', disp: 'un', label: 'cantidad' },
    paquete: { base: 'paquete', disp: 'paquete', label: 'paquetes' },
    caja: { base: 'caja', disp: 'caja', label: 'cajas' },
    tiempo: { base: 'min', disp: 'h', label: 'tiempo' },
    porcion: { base: 'porc', disp: 'porc', label: 'porciones' },
  };
  const PURCHASE_UNITS = ['kg', 'g', 'l', 'ml', 'un', 'docena', 'paquete', 'caja'];
  const INDIRECT_UNITS = ['kg', 'g', 'l', 'ml', 'un', 'docena', 'paquete', 'caja', 'h', 'min'];
  const YIELD_UNITS = ['kg', 'g', 'l', 'ml', 'un'];

  function unit(u) { const x = UNITS[u]; if (!x) throw new Error('Unidad desconocida: ' + u); return x; }
  const U = {
    UNITS, DIMS, PURCHASE_UNITS, INDIRECT_UNITS, YIELD_UNITS,
    dim: (u) => unit(u).dim,
    label: (u) => unit(u).l,
    factor: (u) => D.of(unit(u).f),
    toBase: (q, u) => D.of(q).mul(D.of(unit(u).f)),
    fromBase: (q, u) => D.of(q).div(D.of(unit(u).f)),
    convert(q, from, to) {
      if (unit(from).dim !== unit(to).dim) throw new Error('No se puede convertir ' + unit(from).l + ' a ' + unit(to).l + ' (magnitudes distintas)');
      return U.fromBase(U.toBase(q, from), to);
    },
    dispUnit: (dim) => DIMS[dim].disp,
    baseUnit: (dim) => DIMS[dim].base,
    dispFactor: (dim) => D.of(UNITS[DIMS[dim].disp].f),
    unitsOfDim: (dim) => Object.keys(UNITS).filter((k) => UNITS[k].dim === dim),
  };
  g.SC.units = U;
})(typeof window !== 'undefined' ? window : globalThis);
