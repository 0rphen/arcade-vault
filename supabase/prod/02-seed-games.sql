-- Arcade Vault — seed del catálogo de juegos en producción
--
-- Ejecutar DESPUÉS de 01-schema.sql. Extraído del contenido real de la
-- tabla `games` en el proyecto de desarrollo. Solo se migra el catálogo
-- — scores, profiles y usuarios de auth son datos de prueba y se quedan
-- en dev (ver specs/18-migracion-produccion.md).
--
-- `on conflict do update` hace este script re-ejecutable: sirve también
-- para volver a sincronizar el catálogo de prod con dev en el futuro,
-- corriendo solo este archivo.

insert into games (id, title, short, long, cat, cover, color, plays) values
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.', 'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.', 'ARCADE', 'cover-glot', 'yellow', '27.2K'),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.', 'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.', 'SHOOTER', 'cover-invaders', 'green', '18.0K'),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.', 'SHOOTER', 'cover-rocas', 'yellow', '15.6K'),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.', 'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.', 'VERSUS', 'cover-duelo', 'cyan', '4.2K'),
  ('caida', 'TETRIS', 'Encaja las piezas de Tetris antes de que el techo te aplaste.', 'Piezas de Tetris descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.', 'PUZZLE', 'cover-tetro', 'magenta', '31.8K'),
  ('arkanoid', 'ARKANOID', 'Rebota la pelota y destruye muros de bloques.', 'Controla la paleta y rebota la pelota para destruir los bloques de cada nivel. 5 niveles con patrones distintos, la pelota gana velocidad en cada uno. 3 vidas — no dejes que la pelota caiga.', 'ARCADE', 'cover-bricks', 'cyan', '12.4K'),
  ('snake', 'SNAKE', 'Snake clásico: crece sin morder tu propia cola.', 'Snake, el clásico: una serpiente de luz recorre la grilla comiendo frutas. Cada fruta la alarga y acelera el ritmo. Un giro en falso contra el borde o contra tu propia cola termina la partida.', 'ARCADE', 'cover-snake', 'green', '9.1K'),
  ('frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.', 'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.', 'ARCADE', 'cover-frogger', 'green', '6.4K')
on conflict (id) do update set
  title = excluded.title,
  short = excluded.short,
  long = excluded.long,
  cat = excluded.cat,
  cover = excluded.cover,
  color = excluded.color,
  plays = excluded.plays;
