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
   proprio quello che va tenuto.

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
  const percorso = i =>
    `assets/mattone/scuro/m_${String(i+1).padStart(3,'0')}.webp?v=${VER}`;

  const slot = [];   /* {el, seq, cv, da, a} */

  /* Velo del congedo: moltiplica l'opacità del mattone. A 1 (il
     default) non fa nulla. */
  let velo = 1;

  /* Una sola pelle, quella scura: dal 2026-09-24 la 02, la 03 e la
     piuma sono tutte chiare e il mattone chiaro-su-notte non compariva
     più da nessuna parte (verificato scorrendo tutta la pagina, desktop
     e telefono). La sequenza gemella e la dissolvenza fra le due sono
     state tolte il 2026-09-30. */
  function monta(el, da, a){
    if(!el || !window.FRAMESEQ) return;
    const cv = document.createElement('canvas');
    cv.className = 'mattone__pel';
    el.appendChild(cv);
    const s = { el, seq: FRAMESEQ(cv, {count:N, path:percorso}), cv, da, a };
    slot.push(s);
    return s;
  }

  function preload(filtro){
    slot.forEach(s=> s.seq.preload(filtro));
  }
  /* il fotogramma p (0…1) davanti a tutta la coda di caricamento */
  function anticipa(p){
    slot.forEach(s=> s.seq.anticipa(p));
  }

  /* p = progresso globale 0…1 dell'intero arco */
  function draw(p){
    slot.forEach((s, i)=>{
      const q = s.a > s.da ? (p - s.da) / (s.a - s.da) : 0;
      s.ultimo = Math.max(0, Math.min(1, q));
      s.seq.draw(s.ultimo);
      /* il velo del congedo vale solo per l'ultimo slot, quello della
         caduta: gli altri due stanno in capitoli che lì sono già passati */
      s.cv.style.opacity = i === slot.length - 1 ? velo : 1;
    });
  }

  /* Il congedo (js/scroll.js → initBrick): l'oggetto sbiadisce mentre il
     campo di filamenti si infittisce dove stava. Solo l'ultimo slot —
     quello della caduta — si congeda: gli altri due sono in capitoli che
     a quel punto sono già passati. */
  function opacita(v){
    velo = Math.max(0, Math.min(1, v));
    const s = slot[slot.length - 1];
    if(s) s.cv.style.opacity = velo;
  }

  /* al resize il canvas si ridimensiona e va ridisegnato: si ripete
     l'ultimo progresso, non si torna al primo fotogramma */
  function resize(){
    slot.forEach(s=>{
      const t = s.ultimo || 0;
      s.seq.draw(t, true);
    });
  }
  addEventListener('resize', resize);

  return {monta, preload, anticipa, draw, opacita, resize, get slot(){ return slot; }, N};

})();
