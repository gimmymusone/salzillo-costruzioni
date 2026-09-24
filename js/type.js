/* ══════════════════════════════════════════════════════════════
   Tipografia in movimento — le tre primitive del sito.

   Regola che le governa tutte: **niente parte "da solo"**. Nella
   reference ogni movimento di testo è agganciato allo scroll con
   uno scrub, quindi torna indietro se torni indietro e si ferma a
   metà se ti fermi a metà. Il vecchio `toggleActions` faceva
   partire un'animazione a tempo proprio al superamento di una
   soglia: è esattamente la differenza che si vedeva.

   - revealLines(scope)  righe mascherate che salgono, in stagger
   - wipeReveal(scope)   la maschera orizzontale che scende sul
                         blocco: ciò che ha superato il fronte è
                         visibile e arancione, poi si raffredda
   - igniteLines(el)     il faretto che illumina una riga per volta,
                         col quadratino d'accento su colonna fissa
   - overshoot(el)       parallasse orizzontale sul display che
                         deborda oltre il bordo destro (la firma)
   ══════════════════════════════════════════════════════════════ */

window.TYPE = (function(){

  /* Nelle sezioni a pagina (data-pagina, js/pagine.js) lo schermo si
     ferma col top della sezione in cima: un elemento in basso non
     salirebbe mai al 18% o al 66% e resterebbe a metà comparsa. Lì la
     finestra è l'arrivo della SEZIONE, che dura quanto lo scorrimento
     animato fra una pagina e l'altra. */
  /* data-rivela="start|end" su una sezione (02 e 03, 2026-09-24): tutti i
     suoi testi compaiono in quella finestra, misurata sulla sezione. Serve
     a farli salire più lenti e insieme al passaggio del mattone
     (js/scroll.js → initBrick, CENTRI). */
  function finestra(el, start, end){
    const riv = el.closest('[data-rivela]');
    if(riv){
      const [s, e] = riv.dataset.rivela.split('|');
      return {trigger:riv, start:s, end:e};
    }
    const pag = el.closest('[data-pagina]');
    return pag ? {trigger:pag, start:'top 85%', end:'top 5%'}
               : {trigger:el, start, end};
  }

  /* ── 1. righe mascherate ─────────────────────────────────── */
  /* Un solo scrub per blocco di titolo, con le righe in stagger:
     la seconda riga insegue la prima invece di partire insieme. */
  function revealLines(scope){
    scope.querySelectorAll('.sec-display:not(.ignite)').forEach(block=>{
      const lines = block.querySelectorAll('.line__in');
      if(!lines.length) return;
      /* ease:'none' perché è scrubbato: su un movimento agganciato allo
         scroll una curva d'uscita fa scorrere il testo a velocità diversa
         dal dito, e all'indietro si sente ancora di più. Lo sfasamento
         fra le righe lo dà lo `stagger`, che resta. Le uniche curve vere
         del sito sono l'intro della hero e la caduta del mattone: quelle
         non sono scrubbate. */
      gsap.fromTo(lines, {yPercent:112}, {
        yPercent:0, ease:'none', stagger:.22,
        scrollTrigger:{
          /* stessa finestra del wipe: le righe salgono mentre il fronte
             scende, e lo stagger fa inseguire la seconda alla prima */
          ...finestra(block, 'top 92%', 'top 18%'),
          scrub:.5, invalidateOnRefresh:true
        }
      });
    });
  }

  /* ── 2. corpo e etichette ────────────────────────────────── */
  function fadeIns(scope){
    scope.querySelectorAll('.fade-in').forEach(el=>{
      gsap.fromTo(el, {autoAlpha:0, y:22}, {
        autoAlpha:1, y:0, ease:'none',
        scrollTrigger:{...finestra(el, 'top 94%', 'top 66%'), scrub:.5}
      });
    });
  }

  /* ── 3. il wipe: come compare ogni titolo ────────────────── */
  /* Il fronte è di *visibilità*, non di colore: in img-06 la parola
     in transito è arancione nella metà alta e semplicemente non c'è
     nella metà bassa. Quindi una maschera con stacco netto (due stop
     alla stessa posizione) che scende sul blocco, e il colore che si
     raffredda dall'arancio al colore di default una riga per volta,
     in ritardo sul fronte — a fronte al 40% del blocco, in img-06,
     non si è ancora raffreddato niente.
     Tutto in custom property registrate: durante lo scroll non si
     tocca il layout, si ridipinge soltanto. */
  function wipeReveal(scope){
    scope.querySelectorAll('.sec-display:not(.ignite)').forEach(block=>{
      const lines = block.querySelectorAll('.line__in');
      if(!lines.length) return;
      const tl = gsap.timeline({
        scrollTrigger:{
          /* ~800 px a viewport 1080 per un titolo intero. RIPIEGO
             dichiarato, non misura: la finestra del wipe nella
             reference non è stata misurata sul sito vivo. 700-900 px
             è però coerente col resto della sua grammatica, e i 518
             px di prima erano fuori scala rispetto a tutto il resto. */
          ...finestra(block, 'top 92%', 'top 18%'),
          scrub:.5, invalidateOnRefresh:true
        }
      })
      .fromTo(block, {'--wipe':0}, {'--wipe':1, ease:'none', duration:.60}, 0)
      /* Il raffreddamento parte a fronte arrivato in fondo: in img-06
         il blocco è ancora tutto arancione mentre l'ultima riga è
         tagliata a metà, quindi i due fronti non si sovrappongono.
         Una `set` al tempo 0 invece di uno `stagger` su `fromTo`: con
         lo stagger le righe che non hanno ancora iniziato restano al
         valore CSS (1, cioè già fredde) e si vedono raffreddarsi al
         contrario, dal basso verso l'alto. */
      .set(lines, {'--heat':0}, 0);
      lines.forEach((riga, i)=>{
        tl.to(riga, {'--heat':1, ease:'none', duration:.20}, .60 + i * .10);
      });
    });
  }

  /* ── 4. il faretto: una riga per volta ───────────────────── */
  /* In img-17 solo la riga in corso è scura: quelle già passate
     tornano chiare come quelle non ancora raggiunte. Non è un
     riempimento che si accumula, è un faretto che scorre. Il
     quadratino sta su una colonna fissa (CSS) e cambia solo la y,
     a scatti di riga: nella ref non si muove mai in orizzontale. */
  function igniteLines(el, opts){
    opts = opts || {};
    const lines = [...el.querySelectorAll('.line')];
    if(!lines.length) return;

    const dot = document.createElement('i');
    dot.className = 'ignite__dot';
    el.appendChild(dot);

    /* posizioni misurate una volta per refresh */
    let spots = [];
    const measure = ()=>{
      const b = el.getBoundingClientRect();
      spots = lines.map(l=>{
        const r = l.getBoundingClientRect();
        return r.top - b.top + r.height / 2;
      });
    };

    const setDot = gsap.quickSetter(dot, 'css');
    const setCur = lines.map(l=>gsap.quickSetter(l, '--cur'));
    const clamp  = gsap.utils.clamp(0, 1);
    const stato  = {t:0};

    const paint = ()=>{
      if(!spots.length) measure();
      const n = lines.length;
      const pos = stato.t * n;                     /* 0 → n, riga per riga */
      setCur.forEach((set, k)=> set(clamp(1 - Math.abs(pos - (k + .5)) * 1.6)));
      const i = Math.min(n - 1, Math.max(0, Math.floor(pos)));
      setDot({y:spots[i], opacity:stato.t > .02 && stato.t < .98 ? 1 : 0});
    };

    /* La corsa del faretto si può dichiarare nell'HTML
       (data-ignite-start / data-ignite-end). Serve al capitolo della
       caduta: lì il faretto non è libero di andare al suo passo, deve
       arrivare sull'ultima riga nell'istante in cui il mattone tocca
       il pavimento, e i due si tarano l'uno sull'altro.
       Lo scrub è più corto del solito per lo stesso motivo: mezzo
       secondo di ritardo, su un incontro cercato, si vede. */
    const d = el.dataset;
    /* Dove si ferma il faretto. `data-ignite-fine="ultima"` lo lascia
       sull'ultima riga invece di portarlo oltre: la riga resta accesa
       e il pallino resta lì fino alla fine della sezione, invece di
       scorrere via e spegnere tutto. Serve al capitolo della caduta,
       dove quella parola è il punto d'arrivo di tutta la scena. */
    const tFine = d.igniteFine === 'ultima'
      ? (lines.length - .5) / lines.length : 1;
    return gsap.to(stato, {
      t:tFine, ease:'none', onUpdate:paint,
      scrollTrigger:{
        trigger:opts.trigger || el.closest('section') || el,
        start: d.igniteStart || opts.start || 'top 72%',
        end:   d.igniteEnd   || opts.end   || 'bottom 68%',
        scrub:(d.igniteStart || d.igniteEnd) ? .2 : .5,
        invalidateOnRefresh:true, onRefresh:measure
      }
    });
  }

  /* ── 5. il display che deborda ───────────────────────────── */
  function overshoot(el, amount){
    gsap.fromTo(el, {x:0}, {
      x:amount || '-2.2vw', ease:'none',
      scrollTrigger:{
        trigger:el.closest('section') || el,
        start:'top bottom', end:'bottom top', scrub:true
      }
    });
  }

  /* ── avvio ───────────────────────────────────────────────── */
  /* A font caricato: le posizioni delle righe si misurano sul
     carattere vero, non sul fallback. */
  /* ── 3c. i paragrafi arrivano dopo il titolo ────────────── */
  /* Committente, 2026-09-24: il paragrafo non entra dal basso e non
     accompagna il titolo — resta nascosto finché il titolo della sua
     sezione non è uscito del tutto (fine della sua finestra), poi
     compare con una breve dissolvenza. Tornando su si nasconde di nuovo.
     (Per un giro c'è stato anche l'effetto HyperText di Magic UI: tolto.) */
  function dopoTitolo(scope){
    scope.querySelectorAll('.sec-body--dopo').forEach(el=>{
      const titolo = el.closest('section')?.querySelector('.sec-display') || el;
      gsap.set(el, {autoAlpha:0});
      const mostra = on => gsap.to(el, {autoAlpha: on ? 1 : 0, duration: on ? .5 : .2, overwrite:true});
      ScrollTrigger.create({
        ...finestra(titolo, 'top 92%', 'top 18%'),
        onLeave(){ mostra(true); },
        onEnterBack(){ mostra(false); },
        /* caricata già oltre (link diretto, ricarica a metà pagina) */
        onRefresh(self){ if(self.progress >= 1) gsap.set(el, {autoAlpha:1}); }
      });
    });
  }

  function init(scope){
    const run = ()=>{
      revealLines(scope);
      wipeReveal(scope);
      dopoTitolo(scope);
      fadeIns(scope);
      scope.querySelectorAll('.ignite').forEach(el=>igniteLines(el));
      scope.querySelectorAll('[data-overshoot]').forEach(el=>overshoot(el));
      if(window.ScrollTrigger) ScrollTrigger.refresh();
    };
    /* A font caricato, ma non all'infinito: se `fonts.ready` non si
       risolve — succede quando la pagina continua a chiedere glifi
       nuovi mentre le sezioni entrano — la tipografia resterebbe muta
       e il sito perderebbe TUTTE le rivelazioni senza un solo errore
       in console. Il timeout è la stessa rete che SEQ ha già per i
       frame: meglio misurare sul fallback che non partire. */
    let partito = false;
    const unaVolta = ()=>{ if(partito) return; partito = true; run(); };
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(unaVolta);
      setTimeout(unaVolta, 2500);
    } else unaVolta();
  }

  /* Stato finale senza animazione: serve a prefers-reduced-motion,
     dove il testo dev'essere tutto a posto e nel colore di default —
     mai fermo a metà wipe e mai arancione. */
  function settle(scope){
    gsap.set(scope.querySelectorAll('.line__in'), {yPercent:0, '--heat':1});
    gsap.set(scope.querySelectorAll('.sec-display'), {'--wipe':1});
    gsap.set(scope.querySelectorAll('.sec-body--dopo'), {autoAlpha:1});
    gsap.set(scope.querySelectorAll('.fade-in'),  {autoAlpha:1, y:0});
    gsap.set(scope.querySelectorAll('.ignite .line'), {'--cur':1});
  }

  return {init, settle, revealLines, wipeReveal, fadeIns, igniteLines, overshoot};

})();
