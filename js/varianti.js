/* ══════════════════════════════════════════════════════════════
   Varianti da far scegliere al committente, commutabili dal vivo
   con un parametro nell'indirizzo — niente pannello, niente stato
   salvato: il link è la variante.

     ?logo=a   solo marchio            ?logo=b   marchio + testo (default)
     ?copy=1   COSTRUITO / PER / RESTARE (default, tre blocchi)
     ?copy=2   SI COSTRUISCE / UNA VOLTA SOLA (due blocchi)
     ?copy=3   PRIMA / LE FONDAMENTA (due blocchi)
     ?luce=1|2|3   quanto è schiarito il fondo cinematico

   Perché il corpo cambia con la copy: la riga bassa è allineata a
   destra e sfora oltre il bordo di una quantità fissa, quindi è la
   sua larghezza a decidere quanto può essere grande il titolo senza
   che la riga esca anche a sinistra. Le due alternative "più corte"
   hanno in realtà la riga bassa più larga (14 caratteri contro 11),
   e costano ~20% di scala: è esattamente il compromesso su cui
   deve decidere il committente.
   ══════════════════════════════════════════════════════════════ */

(function(){

  /* Gli anni di attività si contano dall'anno di fondazione (1980,
     confermato dal cliente il 2026-09-24): il numero scritto nell'HTML
     è solo il valore di riserva, qui si tiene sempre aggiornato. */
  const FONDAZIONE = 1980;
  document.querySelectorAll('[data-anni]')
    .forEach(el => { el.textContent = new Date().getFullYear() - FONDAZIONE; });

  /* La copy 1 è in TRE blocchi (Costruito / per / restare): le altre due
     restano a due, quindi il terzo blocco esce di scena.
     Il corpo NON si scrive più da qui: uno stile inline su <html>
     batterebbe qualunque media query, e il titolo resterebbe minuscolo
     sul telefono. Qui si dichiara solo quale copy è attiva
     (data-copia), i corpi vivono in css/style.css accanto agli altri. */
  const COPY = {
    '1': {a:'Costruito',     b:'per',            c:'restare'},
    '2': {a:'Si costruisce', b:'una volta sola', c:null},
    '3': {a:'Prima',         b:'le fondamenta',  c:null}
  };

  const q = new URLSearchParams(location.search);

  const logo = (q.get('logo') || '').toLowerCase();
  if(logo === 'a' || logo === 'b'){
    document.querySelector('.hd__logo')?.setAttribute('data-logo', logo);
  }

  const quale = q.get('copy');
  const c = COPY[quale];
  if(c){
    /* Se la copy è già quella scritta nell'HTML non si riscrive nulla:
       `textContent` spianerebbe il markup interno, e con lui lo
       <span class="su"> che tiene intera la I di COSTRUITO. */
    const set = (k,v) => document.querySelectorAll(`[data-copy="${k}"]`)
                                 .forEach(el => { if(el.textContent !== v) el.textContent = v; });
    set('h1a', c.a);
    set('h1b', c.b);

    const display = document.getElementById('display');
    if(c.c){
      set('h1c', c.c);
      display?.setAttribute('data-blocchi', '3');
    }else{
      /* due blocchi: il terzo sparisce e il titolo torna all'alternato
         di prima — è così che il committente ha visto queste due copy */
      display?.setAttribute('data-blocchi', '2');
    }
    document.documentElement.dataset.copia = quale;
  }

  /* Gradazioni della luce del fondo, da far scegliere come le copy:
     ?luce=1 timida · ?luce=2 media (default in CSS) · ?luce=3 decisa.
     Il contrasto sale insieme alla luce: brightness da sola solleva i
     neri e lava la scena, il contrasto li riporta giù — ed è quello a
     salvare il «chiaro su fondo scuro» del match-cut. */
  const LUCE = {
    '1': {luce:'1.08', contrasto:'1.02', scrim:'.50'},
    '2': {luce:'1.20', contrasto:'.95',  scrim:'.42'},
    '3': {luce:'1.30', contrasto:'.92',  scrim:'.35'}
  };
  const l = LUCE[q.get('luce')];
  if(l){
    const r = document.documentElement.style;
    r.setProperty('--fondo-luce', l.luce);
    r.setProperty('--fondo-contrasto', l.contrasto);
    r.setProperty('--scrim-forza', l.scrim);
  }

})();
