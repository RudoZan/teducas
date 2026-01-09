# 🧮 Juego Colaborativo de Multiplicación - Teducas

Un juego interactivo colaborativo en tiempo real donde múltiples usuarios trabajan juntos para completar una tabla de multiplicación usando Supabase Realtime.

## 🚀 Características

- **Tablero interactivo**: Tabla de multiplicación de 10x10 con 15 casillas vacías aleatorias
- **Juego colaborativo**: Múltiples usuarios pueden jugar simultáneamente
- **Sincronización en tiempo real**: Usa Supabase Realtime para sincronizar movimientos
- **Sistema de usuarios**: Cada usuario tiene un color único y contador de piezas colocadas
- **Drag & Drop**: Arrastra y suelta piezas en el tablero
- **Contador regresivo**: Countdown antes de comenzar cada juego
- **Validación en tiempo real**: Solo se permiten piezas correctas en las casillas correspondientes

## 📋 Requisitos Previos

1. Una cuenta de Supabase (ya tienes las credenciales configuradas)
2. Un servidor web local o de hosting

## 🛠️ Configuración de Supabase

**¡Excelente noticia!** Este juego usa **solo Supabase Realtime con broadcast**, por lo que **NO necesitas crear ninguna tabla** ni configurar base de datos. Solo necesitas las credenciales de Supabase que ya están configuradas en el código.

### Configuración mínima requerida:

1. **Credenciales de Supabase**: Ya están configuradas en `app.js`:
   ```javascript
   const SUPABASE_URL = 'https://junonydusnrcumbjjzqt.supabase.co';
   const SUPABASE_ANON_KEY = 'sb_publishable_vmnxlj3GbQPYqoXSjoK4IA_WN37wTR8';
   ```

2. **Habilitar Realtime**: Asegúrate de que Realtime esté habilitado en tu proyecto de Supabase (generalmente está habilitado por defecto en proyectos nuevos).

3. **Eso es todo**: ¡No necesitas nada más! El juego usa `broadcast` de Supabase Realtime para sincronizar mensajes en tiempo real sin necesidad de tablas.

### Configurar credenciales (si necesitas cambiarlas):

Si necesitas cambiar las credenciales de Supabase, edita el archivo `app.js`:

```javascript
const SUPABASE_URL = 'tu-url-aqui';
const SUPABASE_ANON_KEY = 'tu-key-aqui';
```

## 🎮 Uso

1. **Iniciar el juego**: Abre `index.html` en un navegador moderno o sirve los archivos con un servidor web local.

2. **Usando un servidor local**:
   ```bash
   # Con Python 3
   python -m http.server 8000
   
   # Con Node.js (si tienes http-server instalado)
   npx http-server -p 8000
   ```

3. **Ingresar nombre**: Al abrir la página, ingresa tu nombre de usuario.

4. **Comenzar juego**: Haz clic en "Comenzar Nuevo Juego" y espera el contador regresivo.

5. **Jugar**: Arrastra las piezas desde la parte inferior hacia las casillas vacías del tablero.

6. **Colaborar**: Otros usuarios pueden unirse en tiempo real y ver tus movimientos.

## 🎯 Cómo Jugar

1. **Objetivo**: Completa la tabla de multiplicación colocando las piezas correctas en las casillas vacías (marcadas con "?").

2. **Piezas**: 
   - Hay 30 piezas disponibles (15 correctas + 15 distractores)
   - Solo las piezas correctas se pueden colocar en sus casillas correspondientes
   - Las piezas usadas desaparecen del área de piezas

3. **Validación**:
   - Si intentas colocar una pieza incorrecta, volverá a su posición
   - Solo puedes colocar piezas en casillas vacías
   - Las piezas correctas quedan fijas en el tablero

4. **Puntuación**: 
   - Cada usuario tiene un contador de piezas colocadas correctamente
   - Se muestra en la lista lateral de usuarios

5. **Finalización**: 
   - Cuando se completan las 15 casillas, el juego termina
   - Se muestra un resumen con las puntuaciones de todos los usuarios

## 🛡️ Seguridad

**Nota importante**: Este juego usa Supabase Realtime Broadcast, que permite comunicación en tiempo real sin persistencia de datos. Para un entorno de producción, considera:

1. Implementar autenticación de usuarios si necesitas identificar usuarios autenticados
2. Validar y sanitizar todas las entradas en el cliente
3. Implementar rate limiting en Supabase si es necesario
4. Los datos no se persisten (se pierden al recargar la página)

## 🐛 Solución de Problemas

- **Los usuarios no aparecen en tiempo real**: 
  - Verifica que Realtime esté habilitado en tu proyecto de Supabase
  - Revisa la consola del navegador para errores de conexión
  - Asegúrate de que las credenciales de Supabase sean correctas

- **Las piezas no se sincronizan**: 
  - Revisa la consola del navegador para errores de conexión a Supabase
  - Verifica que el canal de Realtime esté suscrito correctamente
  - Asegúrate de que otros usuarios estén conectados al mismo canal

- **Error al conectarse**: 
  - Verifica que las credenciales de Supabase (URL y ANON_KEY) sean correctas
  - Asegúrate de que tu proyecto de Supabase tenga Realtime habilitado

## 📝 Notas Técnicas

- **Solo usa Supabase Realtime Broadcast**: No se usan tablas ni base de datos
- **Comunicación en tiempo real**: Los movimientos se transmiten en tiempo real usando `broadcast`
- **Sin persistencia**: Los datos no se guardan; se pierden al recargar la página
- **Canal único**: Todos los usuarios se conectan al mismo canal: `multiplication-game-room`
- **Eventos broadcast**: 
  - `user_joined`: Cuando un usuario se une al juego
  - `user_left`: Cuando un usuario abandona el juego
  - `request_users`: Solicitud para obtener lista de usuarios conectados
  - `game_started`: Cuando se inicia un nuevo juego
  - `piece_placed`: Cuando se coloca una pieza en el tablero
  - `score_updated`: Cuando se actualiza la puntuación de un usuario

**Ventajas de este enfoque**:
- ✅ No requiere configuración de base de datos
- ✅ Más rápido (sin escrituras en BD)
- ✅ Más simple de mantener
- ✅ Perfecto para datos temporales como juegos en curso

## 📄 Licencia

Este proyecto está desarrollado para uso educativo.
