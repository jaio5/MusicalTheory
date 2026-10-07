/**
 * La sonda, en un solo sitio para que el auditor de rutas y el de estados midan
 * lo mismo.
 *
 * Lo que busca es **contenido al que no se puede llegar**, que es lo único que
 * importa: da igual que algo se salga de su caja si algún ancestro se desplaza
 * hasta ello. Por eso no mira `scrollHeight` a secas —Chromium suma ahí desbordes
 * que ya recorta otro— sino la geometría contra la caja que de verdad recorta.
 */
export const SONDA = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const problemas = [];
  const doc = document.documentElement;

  if (doc.scrollWidth > doc.clientWidth + 1) {
    problemas.push({
      tipo: 'scroll-horizontal',
      el: 'documento',
      detalle: `${doc.scrollWidth} > ${doc.clientWidth}`,
    });
  }

  const recorta = (el) => {
    const cs = getComputedStyle(el);
    return cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
  };
  const desplaza = (el) =>
    el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;

  const camino = (el) => {
    const t = [];
    let n = el;
    while (n && n !== document.body && t.length < 6) {
      const al = n.getAttribute('aria-label');
      const cl =
        typeof n.className === 'string' ? n.className.split(/\s+/).slice(0, 2).join('.') : '';
      t.unshift(n.tagName.toLowerCase() + (al ? `[${al}]` : '') + (cl ? '.' + cl : ''));
      n = n.parentElement;
    }
    return t.join(' > ');
  };

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // **Lo que no se está dibujando no se mide.** Un `<details>` cerrado esconde
    // lo suyo con `content-visibility`, y ahí Chrome sigue devolviendo tamaños
    // de lo que hay dentro: sin esto, la rueda plegada se contaba como contenido
    // recortado y fuera de alcance. `checkVisibility` es quien lo sabe.
    if (typeof el.checkVisibility === 'function') {
      if (!el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) continue;
    } else if (el.closest('details:not([open])') !== null) {
      continue;
    }
    if (el.closest('.sr-only') !== null) continue;
    const texto = el.textContent.trim();
    if (texto.length === 0 && el.tagName !== 'SVG' && el.tagName !== 'IMG') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    // Lo que está fuera **porque alguien lo ha apartado a propósito** no cuenta:
    // el «Saltar al contenido» vive en -translate-y-20 hasta que se le da el
    // foco, y eso es la técnica, no un descuido. Se reconoce porque sin la
    // transformación caería dentro.
    let transformado = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      // `translate` aparte de `transform`: Tailwind v4 usa la propiedad suelta,
      // así que mirar solo `transform` no ve el «Saltar al contenido».
      if (c.transform !== 'none' || (c.translate !== 'none' && c.translate !== '')) {
        transformado = true;
        break;
      }
    }
    if (transformado) continue;

    // La caja que de verdad recorta esto: el primer ancestro que no deja salir.
    let caja = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (recorta(p)) {
        caja = p;
        break;
      }
    }
    const limite =
      caja === null ? { top: 0, left: 0, right: vw, bottom: vh } : caja.getBoundingClientRect();

    const fuera =
      r.bottom > limite.bottom + 2
        ? 'abajo'
        : r.top < limite.top - 2
          ? 'arriba'
          : r.right > limite.right + 2
            ? 'derecha'
            : r.left < limite.left - 2
              ? 'izquierda'
              : null;
    if (fuera === null) continue;

    // ¿Puede algún ancestro desplazarse hasta ello?
    //
    // Cuando no hay ninguna caja que recorte, quien manda es el documento: una
    // página normal que se desplaza —la portada— no tiene nada fuera de alcance
    // por mucho que sobresalga de la ventana.
    let alcanzable =
      caja === null &&
      (doc.scrollHeight > doc.clientHeight + 1 || doc.scrollWidth > doc.clientWidth + 1);
    for (let p = el.parentElement; p && p !== document.body && !alcanzable; p = p.parentElement) {
      const c = getComputedStyle(p);
      const auto =
        c.overflowY === 'auto' ||
        c.overflowY === 'scroll' ||
        c.overflowX === 'auto' ||
        c.overflowX === 'scroll';
      if (auto && desplaza(p)) {
        alcanzable = true;
        break;
      }
      if (p === caja) break; // más allá del que recorta ya no sirve de nada
    }
    if (alcanzable) continue;

    problemas.push({
      tipo: 'fuera-de-alcance',
      el:
        el.tagName.toLowerCase() +
        (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''),
      hacia: fuera,
      camino: camino(el),
      texto: texto.slice(0, 55),
      caja: caja === null ? 'la ventana' : camino(caja),
    });
  }
  return problemas;
};
