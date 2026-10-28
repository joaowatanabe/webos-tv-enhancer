# 003 — Fundo com pôsteres de séries/filmes ou vídeos do YouTube

**Status:** spec · não iniciado · risco médio

## Objetivo
Novas opções no seletor de plano de fundo: arte de séries e filmes em alta (estático, com Ken Burns lento) ou vídeos do YouTube.

## Opção A — Pôsteres/backdrops (TMDB)
- API do TMDB (chave grátis): `trending/all/week` → `backdrop_path` em 1280 px.
- Slideshow com crossfade a cada 20 s e zoom lento (transform, barato). Legenda discreta: título + onde assistir (`watch/providers`, região BR).
- Config: `tmdbKey` no `config.js`. Cache da lista em `localStorage` por 12 h.
- OLED: imagens trocam e se movem, então não há risco de marcar a tela.

## Opção B — Vídeos do YouTube
- O `<video>` não toca YouTube direto; o caminho é o iframe do player embutido, que no webOS 6 é pesado e traz a interface do YouTube.
- Alternativa: trailers do TMDB (também hospedados no YouTube): mesmo problema.
- **Recomendação:** ficar só com a opção A. A B fica pra depois, se o iframe se mostrar leve na TV.

## Plano (opção A)
1. `WALLPAPERS` ganha `{ key: 'posteres', name: 'Séries e filmes em alta' }`, visível só com `tmdbKey`.
2. Camada `<div class="poster">` atrás do `.bg::after`, com duas `<img>` alternando (crossfade); pausa o `<video>`.
3. Busca + cache; provedores BR na legenda.
4. Testar na TV o custo do crossfade de imagens 1280 px.

## Critério de pronto
Escolher "Séries e filmes em alta" e ver backdrops trocando suavemente, sem travar a navegação.
