# Sistema RAG Avanzado

Prototipo funcional de sistema RAG (Retrieval Augmented Generation) con chunking jerárquico, recuperación híbrida y anti-alucinación.

## Características Principales

### 1. Chunking Jerárquico Semántico
- Detección automática de estructura de documentos (títulos, secciones, párrafos)
- División inteligente respetando límites semánticos
- Metadatos enriquecidos por chunk (título de sección, nivel, conteo de tokens)

### 2. Recuperación Híbrida (Hybrid Retrieval)
- **BM25**: Búsqueda léxica basada en frecuencia de términos
- **Embeddings Vectoriales**: Búsqueda semántica con similitud coseno
- **RRF (Reciprocal Rank Fusion)**: Fusión óptima de rankings

### 3. Generación con Anti-Alucinación
- Prompts avanzados que fuerzan citas explícitas
- Verificación de fuentes en respuestas
- Métricas de faithfulness (fidelidad al contexto)
- Dos modos: Básico y Avanzado con citas

### 4. Dashboard de Experimentos
- Validación de hipótesis en tiempo real
- Métricas de calidad: Faithfulness Score, Tasa de Alucinación, Citas
- Historial de consultas con análisis

## Tecnologías Utilizadas

### Backend
- **Supabase Edge Functions** (Deno runtime)
- **PostgreSQL + pgvector**: Almacenamiento de embeddings
- **Hugging Face API**: Generación de embeddings (sentence-transformers)
- **OpenAI API** (opcional): Generación de respuestas

### Frontend
- **React 18** + **TypeScript**
- **Vite**: Build tool
- **Tailwind CSS**: Estilos
- **Lucide React**: Iconos

## Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
VITE_SUPABASE_URL=tu_supabase_project_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 2. Base de Datos

La base de datos ya está configurada con:
- Extensión `pgvector` para embeddings
- Tablas: `documents`, `chunks`, `queries`, `experiments`
- Row Level Security (RLS) habilitada
- Índices optimizados para búsqueda vectorial

### 3. Edge Functions

Las siguientes funciones están desplegadas:

#### `process-document`
Procesa documentos de texto y genera chunks con embeddings.

**Request:**
```json
{
  "documentId": "uuid",
  "content": "texto del documento",
  "filename": "ejemplo.txt"
}
```

**Response:**
```json
{
  "success": true,
  "chunks": 25,
  "message": "Document processed successfully"
}
```

#### `query-rag`
Ejecuta consultas RAG con recuperación híbrida y generación de respuestas.

**Request:**
```json
{
  "documentId": "uuid",
  "question": "¿Cuál es el objetivo del sistema RAG?",
  "promptType": "advanced",
  "topK": 5
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Respuesta con citas...",
  "citations": ["1", "2"],
  "faithfulnessScore": 0.85,
  "retrievedChunks": [...]
}
```

### 4. APIs Externas (Opcionales)

Para funcionalidad completa, configura estas claves en Supabase Dashboard > Project Settings > Edge Functions > Secrets:

- `HUGGINGFACE_API_KEY`: Para embeddings reales (gratis en Hugging Face)
- `OPENAI_API_KEY`: Para generación de respuestas con GPT (opcional, usa mock si no está presente)

## Instalación y Uso

### Instalación
```bash
npm install
```

### Desarrollo
```bash
npm run dev
```

### Build de Producción
```bash
npm run build
```

### Vista Previa del Build
```bash
npm run preview
```

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Upload     │  │   Chat       │  │  Experiments │     │
│  │  Documents   │  │  Interface   │  │   Dashboard  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions                        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  process-document    │  │    query-rag         │        │
│  │  • Chunking          │  │  • Hybrid Search     │        │
│  │  • Embeddings        │  │  • BM25 + Vector     │        │
│  └──────────────────────┘  │  • RRF Fusion        │        │
│                             │  • LLM Generation    │        │
│                             └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           PostgreSQL + pgvector Database                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │documents │  │  chunks  │  │ queries  │  │experiments│  │
│  │          │  │ +vector  │  │          │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Trabajo

### 1. Carga de Documento
1. Usuario sube archivo de texto (.txt, .md)
2. Frontend lee contenido y crea registro en tabla `documents`
3. Edge Function `process-document` ejecuta:
   - Chunking jerárquico (detecta títulos, secciones)
   - Generación de embeddings vectoriales
   - Almacenamiento en tabla `chunks`

### 2. Consulta RAG
1. Usuario hace pregunta en Chat Interface
2. Edge Function `query-rag` ejecuta:
   - Genera embedding de la pregunta
   - Búsqueda BM25 (léxica)
   - Búsqueda vectorial (semántica)
   - Fusión de rankings con RRF
   - Generación de respuesta con LLM
   - Extracción de citas y cálculo de faithfulness
3. Respuesta mostrada con métricas y chunks recuperados

### 3. Análisis de Experimentos
- Dashboard muestra métricas agregadas
- Validación de hipótesis automática:
  - H1: Tasa de alucinación < 8%
  - H2: Citas explícitas en respuestas
  - H3: Recuperación híbrida efectiva

## Hipótesis Validadas

### H1: Chunking Jerárquico
**Hipótesis:** El chunking jerárquico mejora la recuperación vs chunking simple.
**Métrica:** NDCG@10, Recall@10
**Implementación:** Detección automática de estructura documental

### H2: Recuperación Híbrida
**Hipótesis:** BM25 + Vectorial supera métodos individuales.
**Métrica:** Recall@10, Precision@5
**Implementación:** RRF con k=60 para fusión de rankings

### H3: Anti-Alucinación
**Hipótesis:** Prompts avanzados reducen alucinaciones a < 8%.
**Métrica:** Faithfulness Score
**Implementación:** Citas obligatorias + verificación de fuentes

## Limitaciones Actuales

1. **Embeddings:** Si no hay API key de Hugging Face, usa embeddings aleatorios (mock)
2. **LLM:** Sin API key de OpenAI, genera respuestas simplificadas
3. **Formatos:** Solo acepta archivos de texto plano (.txt, .md)
4. **Idioma:** Optimizado para español e inglés

## Próximos Pasos

### Mejoras Técnicas
- [ ] Soporte para PDFs con OCR
- [ ] Re-ranking con modelos especializados
- [ ] Query expansion para mejorar recall
- [ ] Caché de embeddings para optimización

### Funcionalidades
- [ ] Comparación A/B de estrategias de chunking
- [ ] Export de experimentos a JSON/CSV
- [ ] Visualización de embeddings con t-SNE
- [ ] Sistema de feedback del usuario

### Evaluación
- [ ] Integración con RAGAS para métricas automáticas
- [ ] Conjunto de datos de evaluación
- [ ] Benchmarks contra sistemas baseline
