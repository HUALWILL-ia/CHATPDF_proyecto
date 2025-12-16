# Inicio Rápido - Sistema RAG Avanzado

Guía para empezar a usar el prototipo en menos de 5 minutos.

## Paso 1: Configurar Variables de Entorno

1. Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Abre `.env` y completa las variables de Supabase:
```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_aqui
```

**Dónde encontrar estas credenciales:**
- Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
- Navega a **Settings** → **API**
- Copia `Project URL` y `anon/public key`

## Paso 2: Iniciar la Aplicación

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:5173`

## Paso 3: Crear Cuenta

1. Abre la aplicación en tu navegador
2. Haz clic en "¿No tienes cuenta? Regístrate"
3. Ingresa email y contraseña (mínimo 6 caracteres)
4. Haz clic en "Crear Cuenta"
5. Vuelve a hacer clic en "¿Ya tienes cuenta? Inicia sesión"
6. Ingresa tus credenciales

## Paso 4: Cargar Documento de Prueba

1. En la pestaña **"Cargar Documento"**, haz clic en "Seleccionar Archivo"
2. Elige el archivo `ejemplo_documento.txt` incluido en el proyecto
3. Espera a que el procesamiento se complete (verás progreso en tiempo real)
4. El documento aparecerá en la lista de la izquierda con estado "completed"

**¿Qué está pasando durante el procesamiento?**
- El sistema divide el documento en chunks jerárquicos
- Genera embeddings vectoriales para cada chunk
- Almacena todo en la base de datos PostgreSQL con pgvector

## Paso 5: Hacer Preguntas (Chat RAG)

1. Cambia a la pestaña **"Chat RAG"**
2. Selecciona el tipo de prompt:
   - **Prompt Básico**: Generación simple sin citas
   - **Prompt Avanzado + Citas**: Anti-alucinación con referencias explícitas

3. Prueba estas preguntas de ejemplo:

```
¿Qué es un sistema RAG?

¿Cuál es la diferencia entre BM25 y búsqueda vectorial?

¿Qué estrategias existen para reducir alucinaciones en LLMs?

¿Cómo funciona el chunking jerárquico?

¿Qué métricas se usan para evaluar sistemas RAG?
```

4. Observa los resultados:
   - Respuesta generada con citas (si usas prompt avanzado)
   - **Faithfulness Score**: Porcentaje de fidelidad al contexto
   - **Citas Encontradas**: Número de referencias explícitas
   - **Chunks Recuperados**: Fragmentos usados para generar la respuesta

## Paso 6: Analizar Experimentos

1. Cambia a la pestaña **"Experimentos"**
2. Observa las métricas del dashboard:
   - **Faithfulness Score**: Promedio de todas las consultas
   - **Tasa de Alucinación**: 1 - Faithfulness (objetivo: <8%)
   - **Prompts Avanzados**: Cuántas consultas usaron anti-alucinación
   - **Citas Promedio**: Referencias por respuesta

3. Revisa la **Validación de Hipótesis**:
   - H1: Anti-alucinación < 8% ✓/⚠
   - H2: Citas explícitas en respuestas ✓/⚠
   - H3: Recuperación híbrida implementada ✓

4. Explora el **Historial de Consultas** para ver todas tus preguntas y métricas

## Características Avanzadas (Opcional)

### Usar APIs Reales para Mejor Calidad

Por defecto, el sistema usa embeddings y respuestas simuladas (mock). Para calidad óptima, configura estas APIs:

#### 1. Hugging Face (Embeddings reales - GRATIS)

1. Crea cuenta en [Hugging Face](https://huggingface.co)
2. Ve a **Settings** → **Access Tokens** → **New token**
3. En Supabase Dashboard:
   - **Project Settings** → **Edge Functions** → **Secrets**
   - Añade: `HUGGINGFACE_API_KEY = tu_token_aqui`

#### 2. OpenAI (Respuestas con GPT - PAGO)

1. Crea cuenta en [OpenAI Platform](https://platform.openai.com)
2. Ve a **API Keys** → **Create new secret key**
3. En Supabase Dashboard:
   - **Project Settings** → **Edge Functions** → **Secrets**
   - Añade: `OPENAI_API_KEY = sk-...`

**Nota:** Sin estas API keys, el sistema funcionará con simulaciones realistas pero no reales.

## Solución de Problemas

### Error: "Missing Supabase environment variables"
**Solución:** Verifica que `.env` existe y contiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### Error al procesar documento
**Solución:** Asegúrate de que el archivo es texto plano (.txt o .md). Los PDFs no están soportados directamente.

### Las citas no aparecen
**Solución:** Usa el modo "Prompt Avanzado + Citas" en lugar de "Prompt Básico"

### Faithfulness Score muy bajo
**Causas comunes:**
- Estás usando Prompt Básico (no genera citas)
- La pregunta no tiene respuesta en el documento
- El sistema está usando embeddings mock (configura Hugging Face API)

### El documento está en "processing" permanentemente
**Solución:**
1. Ve a Supabase Dashboard → **Edge Functions** → **Logs**
2. Busca errores en `process-document`
3. Común: Límite de rate en APIs gratuitas, espera 1 minuto y vuelve a intentar

## Ejemplo de Flujo Completo

```
1. Login → test@example.com / password123
2. Cargar → ejemplo_documento.txt
3. Esperar → "Completado: 15 chunks generados"
4. Chat RAG → Modo "Avanzado + Citas"
5. Pregunta → "¿Qué es recuperación híbrida?"
6. Respuesta → Con citas [FUENTE 1], [FUENTE 2]
7. Métricas → Faithfulness 85%, 3 citas
8. Experimentos → Ver dashboard con validación de hipótesis
```

## Próximos Pasos

Una vez que domines el uso básico:

1. **Carga tus propios documentos**: Cualquier archivo .txt o .md
2. **Experimenta con tipos de preguntas**: Simples vs complejas
3. **Compara prompts**: Básico vs Avanzado
4. **Analiza métricas**: Identifica qué preguntas tienen mejor faithfulness
5. **Itera**: Ajusta tu documento o preguntas según resultados

## Recursos Adicionales

- **README.md**: Documentación técnica completa
- **Arquitectura del sistema**: Diagramas y explicaciones
- **Edge Functions**: Código fuente en `supabase/functions/`
- **Componentes React**: Código frontend en `src/components/`

## Preguntas Frecuentes

**Q: ¿Puedo usar PDFs?**
A: No directamente. Convierte PDFs a texto primero usando herramientas como `pdftotext` o servicios online.

**Q: ¿Cuántos documentos puedo cargar?**
A: Ilimitados (sujeto a límites de Supabase free tier)

**Q: ¿Funciona en español?**
A: Sí, tanto en español como en inglés.

**Q: ¿Necesito GPU?**
A: No, todo corre en la nube de Supabase.

**Q: ¿Los datos son privados?**
A: Sí, gracias a Row Level Security (RLS). Solo ves tus documentos.

---

**¡Listo!** Ya puedes explorar el sistema RAG avanzado. Si encuentras problemas, revisa los logs en Supabase Dashboard o consulta el README completo.
