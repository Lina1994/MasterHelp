import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

/**
 * Estado interno de apertura del diálogo "Sobre MasterHelp".
 * Lo expone una función pública (`openAboutDialog`) para que cualquier parte
 * de la UI (botón en HomePage, item en TitleBar, atajo, etc.) pueda abrirlo
 * sin necesidad de pasar props ni de un context explícito.
 */
let externalOpenFn: (() => void) | null = null;

/**
 * Abre el diálogo "Sobre MasterHelp" desde cualquier punto de la aplicación.
 *
 * Es seguro llamarlo antes de que el componente esté montado: simplemente se
 * descarta la llamada. No-op si el diálogo nunca se renderizó.
 */
export const openAboutDialog = (): void => {
  if (externalOpenFn) externalOpenFn();
};

/**
 * Diálogo modal "Sobre MasterHelp".
 *
 * - Se monta una única vez en el árbol de React (en `main.tsx`).
 * - Su estado interno de apertura se publica vía el singleton `openAboutDialog`,
 *   de modo que la HomePage y la TitleBar reutilizan exactamente la misma
 *   instancia sin duplicar markup ni contextos adicionales.
 * - El contenido narrativo se mantiene intencionadamente en español: es la
 *   declaración personal de la autora de la aplicación y debe leerse tal cual
 *   independientemente del idioma de la UI.
 *
 * Bajo React.StrictMode el `useEffect` se ejecuta dos veces (mount → cleanup →
 * mount). El componente está montado a nivel raíz y nunca se desmonta durante
 * la vida de la app, así que la doble ejecución resulta inocua: el estado
 * final siempre termina con `externalOpenFn` correctamente asignado.
 */
export const AboutDialog: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    externalOpenFn = () => setOpen(true);
    return () => {
      externalOpenFn = null;
    };
  }, []);

  const handleClose = () => setOpen(false);

  // No renderizar dentro de las ventanas de proyección (mapa / skyline):
  // no tiene sentido abrir "Sobre MasterHelp" en una vista de jugadores.
  if (typeof window !== 'undefined' && window.location.hash?.startsWith('#/projection')) {
    return null;
  }

  /**
   * Tipografía de sección: subtítulo-1 en negrita con margin bottom generoso.
   * Se aplica a cada bloque temático dentro del dialog.
   */
  const sectionTitleSx = {
    fontWeight: 700,
    color: theme.palette.primary.main,
    mt: 2.5,
    mb: 1,
    letterSpacing: 0.2,
  } as const;

  const bodySx = {
    color: theme.palette.text.primary,
    lineHeight: 1.65,
    fontSize: '0.95rem',
    mb: 1.5,
  } as const;

  const bullets: ReadonlyArray<{ key: string; text: string }> = [
    { key: 'b1', text: 'Llevar la batuta de la partida' },
    { key: 'b2', text: 'Ser DJ en YouTube, cambiando la música manualmente' },
    { key: 'b3', text: 'Cambiar la imagen del mapa en una app de imágenes del ordenador' },
    { key: 'b4', text: 'Consultar los PDFs de los jugadores' },
    { key: 'b5', text: 'Buscar información de hechizos o del bestiario en internet' },
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="about-dialog-title"
    >
      <DialogTitle
        id="about-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2.5,
          px: { xs: 2, sm: 3 },
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <InfoIcon color="primary" />
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          Sobre MasterHelp
        </Typography>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          px: { xs: 2.5, sm: 4 },
          py: { xs: 2.5, sm: 3.5 },
          bgcolor: theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : theme.palette.background.paper,
        }}
      >
        {/* ── 1. La IA no vive dentro de la app ─────────────────── */}
        <Typography variant="subtitle1" sx={sectionTitleSx}>
          La IA no vive dentro de la app
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Quiero dejar esto muy claro desde el principio, porque es importante para mí: MasterHelp no utiliza Inteligencia Artificial para funcionar. No hay modelos de lenguaje en la nube, no hay APIs de IA procesando tus datos, no hay &quot;magia artificial&quot; intentando adivinar tus decisiones durante la partida ni generando contenido sobre la marcha. Todo el motor de la aplicación es determinista, local y funciona exactamente como tú lo configuras. Cuando cambias de mapa, cambia el mapa porque tú lo has decidido. Cuando suena una canción, suena porque tú la asociaste previamente. No hay una IA tomando decisiones.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Ahora bien, prácticamente el 99,999% del código que la compone ha sido generado por Inteligencia Artificial mediante vibe coding.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Mi perfil técnico no llegaría ni al de programadora junior. Hace años hice un bootcamp de unos meses donde aprendí Vue, React, HTML, CSS y JavaScript. Hice un e-commerce como proyecto final y una Pokédex usando una API como hobby. Nunca trabajé de ello y hasta la llegada de la IA, nunca me había animado con un proyecto de esta envergadura. La IA fue la herramienta que me permitió convertir una idea ambiciosa en realidad, pero la visión, la filosofía de diseño y cada decisión sobre qué debería hacer la aplicación son mías.
        </Typography>

        <Divider sx={{ my: 2.5 }} />

        {/* ── 2. El origen de la aplicación ─────────────────────── */}
        <Typography variant="subtitle1" sx={sectionTitleSx}>
          El origen de la aplicación
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          La idea de MasterHelp nació de una experiencia personal muy concreta. La tercera vez que hice de máster para mis amigos, quise suplir mis carencias con tecnología. No soy buena interpretando, no hago voces ni acentos, y tiendo a ir demasiado al grano. Pensé que si preparaba todo muy bien, la partida sería mejor.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Así que antes de empezar la campaña preparé mapas, imágenes de personajes, canciones, un Excel con automatizaciones para gestionar combates, varias páginas para consultar datos. En un principio pensé en usar imágenes de personajes de videojuegos, donde cada zona del mundo usaría personajes de un videojuego o serie y así aunque no se me diese bien la interpretación mis jugadores serían capaces de identificar si el personaje que les presento es de un sitio u otro… Todo estaba listo. Pero cuando llegó el momento de mastear, me di cuenta de que tenía que estar pendiente de demasiadas cosas a la vez:
        </Typography>

        <List
          dense
          sx={{
            pl: { xs: 1, sm: 2 },
            mb: 2,
            '& .MuiListItem-root': { py: 0.25 },
          }}
        >
          {bullets.map((b) => (
            <ListItem key={b.key} disableGutters sx={{ alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ minWidth: 22, mt: '6px', color: 'primary.main' }}>
                <FiberManualRecordIcon sx={{ fontSize: 8 }} />
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={{ variant: 'body1', sx: { lineHeight: 1.6 } }}
                primary={b.text}
              />
            </ListItem>
          ))}
        </List>

        <Typography variant="body1" sx={bodySx}>
          El resultado fue que el ritmo de la partida se interrumpía constantemente. Muchas de las cosas que había preparado con tanto cariño se quedaron sin usar. Incluso la música se quedaba sonando la misma canción de fondo, y solo cuando tenía un pequeño respiro me daba cuenta de que llevábamos media hora con una melodía tranquila en mitad de un combate intenso. Al final acabé simplificando drásticamente lo que tenía en mente para poder hacerlo &quot;gestionable&quot;.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Por otro lado mis notas sobre la campaña eran escuetas, pero suficientes en aquel momento. Mientras jugábamos semanalmente, sabía exactamente dónde lo habíamos dejado. Pero entonces pausamos la campaña, pasaron unos años y cuando se planteó retomarla, no sabía por dónde empezar. Había perdido el hilo.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Al ver el avance de la IA, pensé: &quot;¿Y si pudiera hacer una app que me ayudase a dirigir la partida, que me permitiese usar toda esa preparación previa sin dejarme nada atrás, y que me librase de la carga de estar cambiando constantemente de aplicación?&quot;.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Las notas escuetas ahora podrían ser automáticas, registrando lo ocurrido sin que se me pasara nada por alto. Y aunque la tarea de hacer unas buenas notas no desaparece, ahora soy mucho más consciente de su importancia. Por eso elaboré un apartado que permite tener notas más ricas que un simple Word, con enlaces automáticos, búsqueda y estructura.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          MasterHelp nació de esa necesidad: ser la herramienta que ojalá hubiera tenido cuando empecé.
        </Typography>

        <Divider sx={{ my: 2.5 }} />

        {/* ── 3. Estado actual: Beta y Código Abierto ───────────── */}
        <Typography variant="subtitle1" sx={sectionTitleSx}>
          Estado actual: Beta y Código Abierto
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Actualmente, MasterHelp se encuentra en estado Beta. Esto significa que el núcleo de la aplicación es funcional y está diseñado para acompañarte en tus partidas presenciales, pero sigue en desarrollo activo. Encontrarás errores, y cosas rotas, pero la interfaz irá evolucionando y sigo trabajando constantemente en optimizaciones, pequeñas mejoras y nuevas funcionalidades.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Creo firmemente en que esta herramienta debe ser accesible para todos los Másteres. Por ello, MasterHelp es completamente gratuita y puedes descargarla desde mi repositorio de GitHub:{' '}
          <Link
            href="https://github.com/Lina1994/MasterHelp"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontWeight: 600 }}
          >
            👉 github.com/Lina1994/MasterHelp
          </Link>
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Quiero ser transparente: no tengo la experiencia ni el conocimiento para revisar e integrar modificaciones de terceros en el repositorio. Este proyecto es mi hobby, mi forma de aprender y de aportar a la comunidad rolera, pero no puedo gestionar contribuciones externas. Dicho esto, siéntete libre de descargar la aplicación, usarla y adaptarla a tus necesidades.
        </Typography>

        <Divider sx={{ my: 2.5 }} />

        {/* ── 4. Contenido, Licencias y Apoyo al Hobby ──────────── */}
        <Typography variant="subtitle1" sx={sectionTitleSx}>
          Contenido, Licencias y Apoyo al Hobby
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Para facilitar tu vida como Director de Juego, MasterHelp incluye en su base de datos contenido oficial de reglas (como el SRD de D&amp;D 5e) proporcionado bajo la Open Gaming License (OGL) y otras licencias de contenido abierto.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          Mi intención es seguir actualizando y expandiendo la biblioteca de la aplicación con el tiempo. Sin embargo, esto se hará siempre dentro del marco legal, respetando escrupulosamente los derechos de autor de las editoriales y creadores.
        </Typography>
        <Typography variant="body1" sx={bodySx}>
          MasterHelp es una herramienta para gestionar tu mesa, no un sustituto de tu biblioteca. Las reglas son solo el esqueleto; el alma del juego está en el arte, el lore y el esfuerzo de quienes crean estos mundos. Por ello, te animo encarecidamente a apoyar este maravilloso hobby comprando los manuales originales, los módulos de aventuras y los suplementos directamente de los creadores y tus tiendas locales.
        </Typography>

        <Divider sx={{ my: 2.5 }} />

        {/* ── 5. Mensaje final ──────────────────────────────────── */}
        <Box sx={{ mt: 3, mb: 1 }}>
          <Typography variant="body1" sx={{ ...bodySx, fontStyle: 'italic' }}>
            MasterHelp nació de la frustración de una máster que quería hacer las cosas bien pero se veía desbordada por la tecnología. Gracias por descargar la aplicación, por probarla, por perdonar los bugs de la Beta y por formar parte de este proyecto.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              ...bodySx,
              fontWeight: 600,
              color: theme.palette.primary.main,
              mt: 2,
              textAlign: 'center',
            }}
          >
            Que saquéis muchos críticos!
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Button onClick={handleClose} variant="contained" color="primary">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutDialog;
