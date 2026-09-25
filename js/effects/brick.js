/* ══════════════════════════════════════════════════════════════
   Il mattone — l'oggetto che attraversa i tre capitoli.

   Non è più un disegno procedurale su canvas (quello era il file
   scartato il 2026-07-29): è la sequenza renderizzata da
   assets/3d/render_brick.py, scrubbata con lo stesso pattern dei
   frame della torre — `window.FRAMESEQ`, estratto da SEQ apposta
   per non riscriverlo una seconda volta.

   Perché non dentro il registry window.FX, che pure esiste: FX
   guida UN effetto di sfondo alla volta su un canvas condiviso,
   con un loop rAF. Il mattone è un oggetto in primo piano, in tre
   slot diversi, mosso dallo scroll e non dal tempo — e soprattutto
   metterlo in FX avrebbe sfrattato il campo di filamenti, che è
   proprio quello che va tenuto. Il contratto che conta l'ha
   ereditato lo stesso: `onLight`, identico a quello di feather.js.

   Un solo movimento attraversa i tre capitoli: il mattone scende
   lungo la 4 e la 5 e si schianta nella 6. È l'arco della
   reference (img-19 → img-22), con un impatto al posto di un
   appoggio.
   ══════════════════════════════════════════════════════════════ */

window.BRICK = (function(){

  const N = 120;
  /* Come per le silhouette della torre: i fotogrammi sono già stati
     rifatti tenendo gli stessi nomi, e il browser serviva i vecchi
     dalla cache senza dare segno. Rifatto il bake, si alza il numero. */
  const VER = 2;
  const percorso = valore => i =>
    `assets/mattone/${valore}/m_${String(i+1).padStart(3,'0')}.webp?v=${VER}`;

  const slot = [];   /* {el, seqChiaro, seqScuro, da, a} */

  /* Velo del congedo: moltiplica l'opacità delle due pelli senza
     toccare la dissolvenza chiaro↔scuro, che resta guidata da `luce`.
     A 1 (il default) non fa nulla. */
  let velo = 1;

  /* Le due versioni di valore sono due sequenze gemelle: si
     dissolve dall'una all'altra invece di ritingere i pixel, così
     l'inversione è quella vera del bake — mattone bianco su notte,
     scuro su cemento. `onLight` fa da manopola, come nei filamenti. */
  function monta(el, da, a){
    if(!el || !window.FRAMESEQ) return;
    const chiaro = document.createElement('canvas');
    const scuro  = document.createElement('canvas');
    chiaro.className = 'mattone__pel mattone__pel--chiaro';
    scuro.className  = 'mattone__pel mattone__pel--scuro';
    el.appendChild(chiaro);
    el.appendChild(scuro);
    const s = {
      el,
      chiaro: FRAMESEQ(chiaro, {count:N, path:percorso('chiaro')}),
      scuro:  FRAMESEQ(scuro,  {count:N, path:percorso('scuro')}),
      cvChiaro: chiaro, cvScuro: scuro,
      da, a
    };
    slot.push(s);
    return s;
  }

  /* soloScuro: sul telefono le sezioni del mattone sono sempre chiare e
     la pelle chiara non si vede mai — inutile scaricarla (2026-09-25) */
  function preload(soloScuro, filtro){
    slot.forEach(s=>{ if(!soloScuro) s.chiaro.preload(filtro); s.scuro.preload(filtro); });
  }
  /* il fotogramma p (0…1) davanti a tutta la coda di caricamento */
  function anticipa(p, soloScuro){
    slot.forEach(s=>{ if(!soloScuro) s.chiaro.anticipa(p); s.scuro.anticipa(p); });
  }

  /* p = progresso globale 0…1 dell'intero arco; luce = 0 notte, 1 cemento */
  function draw(p, luce){
    slot.forEach((s, i)=>{
      const q = s.a > s.da ? (p - s.da) / (s.a - s.da) : 0;
      s.ultimo = Math.max(0, Math.min(1, q));
      s.ultimaLuce = luce;
      s.chiaro.draw(s.ultimo);
      s.scuro.draw(s.ultimo);
      /* il velo del congedo vale solo per l'ultimo slot, quello della
         caduta: gli altri due stanno in capitoli che lì sono già passati */
      const v = i === slot.length - 1 ? velo : 1;
      s.cvChiaro.style.opacity = (1 - luce) * v;
      s.cvScuro.style.opacity  = luce * v;
    });
  }

  /* Il congedo (js/scroll.js → initBrick): l'oggetto sbiadisce mentre il
     campo di filamenti si infittisce dove stava. Solo l'ultimo slot —
     quello della caduta — si congeda: gli altri due sono in capitoli che
     a quel punto sono già passati. */
  function opacita(v){
    velo = Math.max(0, Math.min(1, v));
    const s = slot[slot.length - 1];
    if(!s) return;
    const luce = s.ultimaLuce || 0;
    s.cvChiaro.style.opacity = (1 - luce) * velo;
    s.cvScuro.style.opacity  = luce * velo;
  }

  /* al resize il canvas si ridimensiona e va ridisegnato: si ripete
     l'ultimo progresso, non si torna al primo fotogramma */
  function resize(){
    slot.forEach(s=>{
      const t = s.ultimo || 0;
      s.chiaro.draw(t, true);
      s.scuro.draw(t, true);
    });
  }
  addEventListener('resize', resize);

  return {monta, preload, anticipa, draw, opacita, resize, get slot(){ return slot; }, N};

})();
