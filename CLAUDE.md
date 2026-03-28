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
