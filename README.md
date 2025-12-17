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
