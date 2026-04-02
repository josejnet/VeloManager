# Instrucciones del Proyecto: Consistencia y Calidad

Como asistente de este repositorio, debes adherirte a las siguientes reglas de operación en cada tarea:

## 1. Vigilancia de Consistencia
- Antes de realizar cambios, analiza la estructura existente para asegurar que el nuevo código respeta los patrones de diseño y nomenclatura actuales.
- Garantiza la integridad referencial: si cambias una definición (ej. en una Ruta), verifica todos los Eventos o servicios que dependan de ella.

## 2. Protocolo de Errores y Registro
- **Ciclo de Aprendizaje:** Cada vez que un comando de test, linter o compilación falle tras un cambio tuyo, documenta internamente la causa raíz.
- **Prevención de Regresiones:** Una vez corregido un fallo, aplica esa misma lógica de corrección a cualquier otra parte del código que presente el mismo patrón para evitar que el error se repita.
- **Validación Obligatoria:** No des por finalizada una tarea sin ejecutar las pruebas pertinentes que aseguren la funcionalidad completa del cambio.

## 3. Calidad del Código
- Prioriza la legibilidad y el manejo de excepciones.
- Si encuentras código redundante o inconsistente mientras trabajas en una tarea, propón una refactorización breve para mantener la salud del proyecto.

## 4. Validación Pre-Deploy
- **Build script:** Antes de modificar `package.json` scripts (especialmente `build`), verifica cómo está configurada la base de datos en producción. Este proyecto usa `prisma db push` (no `prisma migrate`) porque la DB de producción fue inicializada con `db push`. Cambiar a `prisma migrate deploy` causa error `P3005` si la DB no tiene baseline de migraciones.
- **Variables de entorno:** Antes de cambiar configuración que dependa de env vars (origins, URLs, secrets), verifica si la variable existe en producción (Vercel) o solo en `.env.local`.
- **Compatibilidad con entorno Vercel:** Cambios en `next.config.js`, `vercel.json` o scripts de build deben validarse contra el entorno de producción (dominio real, región, Node version).
- **Schema Prisma vs DB de producción:** Antes de eliminar enums, columnas o modelos del schema, verificar si esos valores aún existen en la DB de producción. Si `prisma db push` reporta "data loss warning", significa que la DB tiene datos que el schema ya no contempla. La solución correcta es restaurar el campo en el schema con un comentario `// kept for DB compatibility`, no usar `--accept-data-loss`. Para eliminarlos definitivamente: primero migrar/limpiar los datos en producción, luego quitar del schema.
