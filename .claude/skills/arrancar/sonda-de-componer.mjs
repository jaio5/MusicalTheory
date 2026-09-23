/**
 * La sonda de componer: mide **cómo reparte la pantalla** el banco de trabajo.
 *
 * `sonda-de-medidas.mjs` contesta «¿se puede llegar a esto?», que es un sí o un
 * no. Esta contesta «¿a qué le está dando sitio la aplicación?», que es lo que
 * hay que saber para arreglar una pantalla que se lee mal aunque todo esté
 * técnicamente alcanzable. Son preguntas distintas y por eso son dos ficheros.
 *
 * Mide cinco cosas, y cada una existe porque una impresión no basta para
 * defender un cambio de interfaz:
 *
 * 1. **El reparto**: cuánto alto se lleva el documento —la canción— frente a
 *    cada panel de ayuda. Es el número que decide si la pantalla trata la
 *    canción como lo principal o como una franja más.
 * 2. **Los duplicados**: mandos visibles a la vez con el mismo nombre
 *    accesible. Dos botones que hacen lo mismo en la misma pantalla obligan a
 *    elegir entre dos caminos idénticos, que es trabajo para nada.
 * 3. **La densidad**: cuántos mandos hay encima del documento antes de llegar a
 *    él.
 * 4. **El alcance**: lo que está tapado por otra cosa o fuera de la ventana.
 *    **Esto es lo que la otra sonda no ve**: ella mide recorte, y un botón
 *    entero debajo de un panel flotante no está recortado, está tapado. Es la
 *    medida más ruidosa de las cinco y **da candidatos, no veredictos**: una
 *    caja grande que se cruza con un hermano sale tapada sin estarlo. Se
 *    confirman mirando. Lo que sí es fiable son las otras cuatro.
 * 5. **Lo pequeño de pulsar**: mandos por debajo de 44 px. El test de
 *    coherencia lee las clases del fichero y **no ve el control que no lleva
 *    ninguna**: el chevron de plegar un área medía veinte por doce y pasaba la
 *    regla sin tener una sola clase de tamaño. Eso solo se ve midiendo.
 * 6. **El vacío**: qué parte de un área no tiene nada dentro. Una pantalla de
 *    mil por setecientos con un botón en medio se defiende sola en una captura
 *    y no se defiende con un porcentaje.
 *
 * Se pasa con `node auditar-componer.mjs` estando `pnpm dev` levantado.
 */

/** Lo que se mide dentro del navegador. Se pasa a `page.evaluate`. */
export const MEDIDAS = () => {
  const visible = (el) =>
    el.checkVisibility?.({ contentVisibilityAuto: true, visibilityProperty: true }) ?? true;

  /**
   * El nombre accesible, aproximado.
   *
   * **Hay que quitar lo que va `aria-hidden`.** Las celdas de la rueda llevan
   * una «C» a la vista y un «C mayor» para quien no la ve: sumando los dos
   * textos sale «CC mayor», que no es el nombre de nada y rompe el recuento de
   * duplicados justo donde más falta hace.
   */
  const nombre = (el) => {
    const etiqueta = el.getAttribute('aria-label');
    if (etiqueta !== null && etiqueta.trim() !== '') return etiqueta.trim();
    const copia = el.cloneNode(true);
    for (const oculto of copia.querySelectorAll('[aria-hidden="true"]')) oculto.remove();
    return (copia.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 44);
  };

  const mandos = [
    ...document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="tab"]',
    ),
  ].filter((el) => {
    // El aviso de las herramientas de `next dev` vive en su propio elemento y no
    // es de la aplicación: contarlo es contar humo.
    if (el.closest('nextjs-portal') !== null) return false;
    if (el.closest('.sr-only') !== null) return false;
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  });

  const areas = [...document.querySelectorAll('section[aria-label]')].filter(visible).map((s) => {
    const r = s.getBoundingClientRect();
    return {
      nombre: s.getAttribute('aria-label'),
      alto: Math.round(r.height),
      ancho: Math.round(r.width),
      arriba: Math.round(r.top),
    };
  });

  // El documento es el área del espacio de trabajo: la canción, se llame como se
  // llame en cada uno de los tres.
  const DOCUMENTO = ['Arreglo', 'Tocando', 'Ensayo'];
  const documento = areas.find((a) => DOCUMENTO.includes(a.nombre)) ?? null;

  const porNombre = new Map();
  for (const el of mandos) {
    const n = nombre(el);
    if (n === '') continue;
    porNombre.set(n, (porNombre.get(n) ?? 0) + 1);
  }
  const duplicados = [...porNombre]
    .filter(([, veces]) => veces > 1)
    .map(([nombre, veces]) => ({ nombre, veces }))
    .sort((a, b) => b.veces - a.veces);

  /**
   * Los cinco puntos con los que se juzga si algo está tapado.
   *
   * **Con el centro solo no vale.** Las celdas de la rueda de quintas son
   * gajos de un círculo dentro de cajas rectangulares que se solapan: mirando
   * un punto, media rueda sale «tapada» por la otra media y no lo está. Se
   * dan por tapados los que no se alcanzan por **ninguno** de los cinco.
   */
  const puntos = (r) => [
    [r.left + r.width / 2, r.top + r.height / 2],
    [r.left + r.width * 0.25, r.top + r.height * 0.25],
    [r.left + r.width * 0.75, r.top + r.height * 0.25],
    [r.left + r.width * 0.25, r.top + r.height * 0.75],
    [r.left + r.width * 0.75, r.top + r.height * 0.75],
  ];

  /**
   * Lo que se pulsa y se queda corto.
   *
   * Cuarenta y cuatro es el mínimo de la casa. Se mide el rectángulo de verdad,
   * que es lo que el dedo encuentra, y no la clase que lo pide.
   */
  const pequenos = mandos
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { nombre: nombre(el), ancho: Math.round(r.width), alto: Math.round(r.height) };
    })
    .filter((m) => m.ancho < 44 || m.alto < 44);

  const alcance = [];
  for (const el of mandos) {
    const r = el.getBoundingClientRect();
    let dentro = 0;
    let propios = 0;
    let quienTapa = null;
    for (const [x, y] of puntos(r)) {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      dentro++;
      const encima = document.elementFromPoint(x, y);
      if (encima === null) continue;
      if (el.contains(encima) || encima.contains(el)) propios++;
      else if (quienTapa === null) quienTapa = nombre(encima) || encima.tagName;
    }
    if (dentro === 0) {
      alcance.push({ nombre: nombre(el), estado: 'fuera de la ventana' });
      continue;
    }
    if (propios > 0) continue;
    alcance.push({ nombre: nombre(el), estado: 'tapado', por: quienTapa });
  }

  const encimaDelDocumento =
    documento === null
      ? null
      : mandos.filter((el) => el.getBoundingClientRect().bottom <= documento.arriba + 1).length;

  /**
   * Si un punto tiene contenido.
   *
   * **Un color de fondo no es contenido.** Lo que se busca es si hay algo que
   * mirar —un texto, un dibujo, un mando—, no si el área está pintada: si no,
   * cualquier caja con fondo saldría llena estando vacía.
   */
  const pinta = (el) => {
    const t = el.tagName.toUpperCase();
    if (
      ['SVG', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYGON', 'G', 'IMG', 'CANVAS'].includes(t) ||
      ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(t)
    ) {
      return true;
    }
    if (el.closest('button, a[href], svg, input, canvas') !== null) return true;
    for (const hijo of el.childNodes) {
      if (hijo.nodeType === Node.TEXT_NODE && hijo.textContent.trim() !== '') return true;
    }
    return false;
  };

  const vacio = (() => {
    if (documento === null) return null;
    const seccion = [...document.querySelectorAll('section[aria-label]')].find(
      (s) => s.getAttribute('aria-label') === documento.nombre,
    );
    if (seccion === undefined) return null;
    const r = seccion.getBoundingClientRect();
    let con = 0;
    let total = 0;
    for (let i = 1; i < 40; i++) {
      for (let j = 1; j < 24; j++) {
        const x = r.left + (r.width * i) / 40;
        const y = r.top + (r.height * j) / 24;
        if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
        total++;
        const encima = document.elementFromPoint(x, y);
        if (encima !== null && seccion.contains(encima) && pinta(encima)) con++;
      }
    }
    return total === 0
      ? null
      : { puntos: total, conAlgo: con, vacioPct: Math.round(100 * (1 - con / total)) };
  })();

  const alto = window.innerHeight;
  const ayudas = areas.filter((a) => a !== documento && a.nombre !== 'Qué se ve abajo');

  return {
    ventana: { ancho: window.innerWidth, alto },
    documento,
    ayudas,
    /** Qué parte del alto de la ventana se lleva la canción. */
    documentoPct: documento === null ? null : Math.round((100 * documento.alto) / alto),
    /** El área de ayuda más alta. Si supera al documento, la pantalla está del revés. */
    ayudaMasAlta: ayudas.reduce((a, b) => (b.alto > (a?.alto ?? 0) ? b : a), null),
    mandosVisibles: mandos.length,
    encimaDelDocumento,
    duplicados,
    pequenos,
    alcance,
    vacio,
  };
};
