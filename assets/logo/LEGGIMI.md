# Marchio Costruzioni Salzillo

Originale di partenza: `../../../assets/caratteristiche/logo.jpeg` — foto dell'insegna,
bassa risoluzione, con l'indirizzo accanto al marchio.

## `marchio.svg` — usa questo

Vettoriale, geometria ricavata misurando a pixel l'insegna originale (le stesse misure
usate per la pianta del modello 3D in `../../../assets/3d/`):

- anello: raggio esterno 1, spessore 0,136
- tratto S: due archi tangenti verticalmente nel flesso (-0.155, 0) — R 0,95 / 62,3° e R 0,74 / 58,5°
- tratto C: arco di 187° aperto verso destra, centro (0.551, 0.017), raggio 0,534

Monocromatico via `currentColor`, con fallback al blu istituzionale `#4A6C93`:

```html
<!-- inline: il colore lo decide il CSS -->
<span style="color:#fff"><svg …>…</svg></span>

<!-- come <img>: esce blu #4A6C93 -->
<img src="assets/logo/marchio.svg" alt="Costruzioni Salzillo">
```

Nota: `currentColor` dentro un `<img>` non eredita il colore della pagina — se serve
un altro colore, va inlineato nell'HTML oppure usato come `mask-image`.

## `marchio-*.png` — generati con Gemini

Tre riletture pulite dell'insegna prodotte con `gemini-3-pro-image` a partire dalla foto
originale. Utili come moodboard o per usi rapidi, **non** come marchio ufficiale: sono
interpretazioni, non ricalchi. Scostamenti noti:

- `marchio-nero-su-bianco.png` — monogramma il più fedele dei tre, ma aggiunge un arco
  spurio sotto l'anello
- `marchio-blu-su-bianco.png` — raddoppia l'anello
- `marchio-bianco-su-blu.png` — anello corretto, intreccio S/C approssimato

Per rigenerarli serve `GEMINI_API_KEY` (sta nel `.env` di `progetti/tri-lab/`).
