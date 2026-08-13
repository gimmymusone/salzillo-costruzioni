/* ══════════════════════════════════════════════════════════════
   Varianti da far scegliere al committente, commutabili dal vivo
   con un parametro nell'indirizzo — niente pannello, niente stato
   salvato: il link è la variante.

     ?logo=a   solo marchio            ?logo=b   marchio + testo (default)
     ?copy=1   COSTRUITO / PER RESTARE (default)
     ?copy=2   SI COSTRUISCE / UNA VOLTA SOLA
     ?copy=3   PRIMA / LE FONDAMENTA

   Perché il corpo cambia con la copy: la riga bassa è allineata a
   destra e sfora oltre il bordo di una quantità fissa, quindi è la
   sua larghezza a decidere quanto può essere grande il titolo senza
   che la riga esca anche a sinistra. Le due alternative "più corte"
   hanno in realtà la riga bassa più larga (14 caratteri contro 11),
   e costano ~20% di scala: è esattamente il compromesso su cui
   deve decidere il committente.
   ══════════════════════════════════════════════════════════════ */

(function(){

  const COPY = {
    /* corpo: stessa forma di --display-size in css/style.css —
       ancorato all'altezza, con tetto in larghezza */
    '1': {a:'Costruito',     b:'per restare',     size:'min(26.7vh, 15.1cqw)'},
    '2': {a:'Si costruisce', b:'una volta sola',  size:'min(21.3vh, 12.0cqw)'},
    '3': {a:'Prima',         b:'le fondamenta',   size:'min(21.5vh, 12.1cqw)'}
  };

  const q = new URLSearchParams(location.search);

  const logo = (q.get('logo') || '').toLowerCase();
  if(logo === 'a' || logo === 'b'){
    document.querySelector('.hd__logo')?.setAttribute('data-logo', logo);
  }

  const c = COPY[q.get('copy')];
  if(c){
    const set = (k,v) => document.querySelectorAll(`[data-copy="${k}"]`)
                                 .forEach(el => el.textContent = v);
    set('h1a', c.a);
    set('h1b', c.b);
    document.documentElement.style.setProperty('--display-size', c.size);
  }

})();
