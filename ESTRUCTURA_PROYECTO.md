# Estructura del Proyecto - Sistema RAG Avanzado

## Arquitectura General

```
Sistema RAG Avanzado
├── Frontend (React + TypeScript)
│   ├── Autenticación
│   ├── Carga de documentos
│   ├── Interface de chat
│   └── Dashboard de experimentos
│
├── Backend (Supabase Edge Functions)
│   ├── process-document: Chunking + Embeddings
│   └── query-rag: Recuperación híbrida + Generación
│
└── Base de Datos (PostgreSQL + pgvector)
    ├── documents: Documentos cargados
    ├── chunks: Fragmentos con embeddings
    ├── queries: Historial de preguntas/respuestas
    └── experiments: Métricas de experimentos
```

## Estructura de Directorios

```
proyecto_rag_experimental/
│
├── public/                          # Archivos estáticos
│   └── vite.svg
│
├── src/                            # Código fuente del frontend
│   ├── components/                 # Componentes React
│   │   ├── Auth.tsx               # Autenticación (login/signup)
│   │   ├── DocumentUpload.tsx     # Carga de documentos
│   │   ├── ChatInterface.tsx      # Interface de chat Q&A
│   │   └── ExperimentDashboard.tsx # Dashboard de métricas
│   │
│   ├── lib/                       # Librerías y utilidades
│   │   └── supabase.ts           # Cliente de Supabase
│   │
│   ├── types/                     # Definiciones de TypeScript
│   │   └── index.ts              # Tipos e interfaces
│   │
│   ├── App.tsx                    # Componente principal
│   ├── main.tsx                   # Punto de entrada
│   ├── index.css                  # Estilos globales (Tailwind)
│   └── vite-env.d.ts             # Tipos de Vite
│
├── supabase/
│   └── functions/                 # Edge Functions (Backend)
│       ├── process-document/
│       │   └── index.ts          # Procesamiento y chunking
│       └── query-rag/
│           └── index.ts          # Búsqueda híbrida + LLM
│
├── dist/                          # Build de producción (generado)
│
├── node_modules/                  # Dependencias (generado)
│
├── .env                          # Variables de entorno (crear)
├── .env.example                  # Ejemplo de variables
├── .gitignore                    # Archivos ignorados por Git
├── eslint.config.js             # Configuración de ESLint
├── index.html                    # HTML principal
├── package.json                  # Dependencias y scripts
├── package-lock.json            # Lock de dependencias
├── postcss.config.js            # Configuración de PostCSS
├── tailwind.config.js           # Configuración de Tailwind
├── tsconfig.json                # Configuración TypeScript (root)
├── tsconfig.app.json            # Configuración TypeScript (app)
├── tsconfig.node.json           # Configuración TypeScript (node)
├── vite.config.ts               # Configuración de Vite
│
├── README.md                     # Documentación completa
├── INICIO_RAPIDO.md             # Guía de inicio rápido
├── ESTRUCTURA_PROYECTO.md       # Este archivo
└── ejemplo_documento.txt        # Documento de prueba
```

## Flujo de Datos

### 1. Carga de Documento

```
Usuario selecciona archivo
        ↓
Frontend lee contenido (file.text())
        ↓
POST /api/documents (Supabase)
        ↓
Edge Function: process-document
        ↓
┌─────────────────────────────────┐
│  Chunking Jerárquico           │
│  - Detectar títulos             │
│  - Dividir por secciones        │
│  - Crear chunks semánticos      │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│  Generar Embeddings            │
│  - API Hugging Face             │
│  - Vector 384 dimensiones       │
└─────────────────────────────────┘
        ↓
INSERT INTO chunks (con embeddings)
        ↓
UPDATE document status → 'completed'
        ↓
Frontend actualiza UI
```

### 2. Consulta RAG

```
Usuario hace pregunta
        ↓
POST /functions/v1/query-rag
        ↓
Edge Function: query-rag
        ↓
┌─────────────────────────────────┐
│  Generar Embedding Pregunta    │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│  Recuperación Híbrida          │
│                                 │
│  ┌──────────┐  ┌──────────┐   │
│  │   BM25   │  │ Vectorial│   │
│  │  Léxico  │  │ Semántico│   │
│  └──────────┘  └──────────┘   │
│         │           │          │
│         └─────┬─────┘          │
│               ↓                │
│      Reciprocal Rank Fusion   │
│           (RRF k=60)          │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│  Generación de Respuesta       │
│  - Construir prompt             │
│  - Llamar LLM (OpenAI/Mock)    │
│  - Extraer citas                │
│  - Calcular faithfulness        │
└─────────────────────────────────┘
        ↓
INSERT INTO queries (con métricas)
        ↓
Retornar respuesta + chunks + métricas
        ↓
Frontend muestra resultado
```

## Base de Datos - Schema

### Tabla: documents

| Columna            | Tipo       | Descripción                    |
|--------------------|------------|--------------------------------|
| id                 | uuid       | Primary key                    |
| user_id            | uuid       | FK a auth.users                |
| filename           | text       | Nombre del archivo             |
| content            | text       | Contenido completo             |
| metadata           | jsonb      | Metadatos adicionales          |
| chunk_count        | integer    | Número de chunks               |
| processing_status  | text       | pending/processing/completed   |
| created_at         | timestamptz| Timestamp de creación          |

**Índices:**
- `documents_user_id_idx` en `user_id`

**RLS Policies:**
- SELECT, INSERT, UPDATE, DELETE: Solo user_id = auth.uid()

### Tabla: chunks

| Columna      | Tipo       | Descripción                          |
|--------------|------------|--------------------------------------|
| id           | uuid       | Primary key                          |
| document_id  | uuid       | FK a documents                       |
| chunk_index  | integer    | Índice del chunk en el documento     |
| text         | text       | Contenido del chunk                  |
| embedding    | vector(384)| Embedding vectorial                  |
| metadata     | jsonb      | section_title, level, token_count    |
| created_at   | timestamptz| Timestamp                            |

**Índices:**
- `chunks_embedding_idx` (IVFFLAT) para búsqueda vectorial
- `chunks_document_id_idx` en `document_id`

**RLS Policies:**
- Acceso solo a chunks de documentos propios

### Tabla: queries

| Columna           | Tipo       | Descripción                     |
|-------------------|------------|---------------------------------|
| id                | uuid       | Primary key                     |
| user_id           | uuid       | FK a auth.users                 |
| document_id       | uuid       | FK a documents                  |
| question          | text       | Pregunta del usuario            |
| answer            | text       | Respuesta generada              |
| retrieved_chunks  | jsonb      | Array de chunks con scores      |
| prompt_type       | text       | basic/advanced                  |
| citations         | jsonb      | Array de IDs de citas           |
| faithfulness_score| float      | Score de fidelidad (0-1)        |
| created_at        | timestamptz| Timestamp                       |

**Índices:**
- `queries_user_id_idx` en `user_id`
- `queries_document_id_idx` en `document_id`

**RLS Policies:**
- SELECT, INSERT, DELETE: Solo user_id = auth.uid()

### Tabla: experiments

| Columna        | Tipo       | Descripción                        |
|----------------|------------|------------------------------------|
| id             | uuid       | Primary key                        |
| user_id        | uuid       | FK a auth.users                    |
| experiment_type| text       | chunking/retrieval/generation      |
| document_id    | uuid       | FK a documents (opcional)          |
| metrics        | jsonb      | Métricas del experimento           |
| created_at     | timestamptz| Timestamp                          |

**RLS Policies:**
- SELECT, INSERT, DELETE: Solo user_id = auth.uid()

## Componentes React

### Auth.tsx
**Propósito:** Manejo de autenticación
**Props:**
- `onAuth: () => void` - Callback al autenticarse

**Estado:**
- `email`, `password`: Credenciales
- `isSignUp`: Modo registro vs login
- `loading`, `error`: Estados de UI

**Funciones:**
- `handleSubmit()`: Login o signup con Supabase Auth

### DocumentUpload.tsx
**Propósito:** Carga y procesamiento de documentos
**Props:**
- `onDocumentProcessed: (doc: Document) => void`

**Estado:**
- `uploading`: Proceso en curso
- `progress`: Mensaje de estado
- `error`: Errores

**Flujo:**
1. Usuario selecciona archivo
2. Lee contenido con FileReader
3. Crea documento en DB
4. Llama Edge Function para procesamiento
5. Muestra progreso en tiempo real

### ChatInterface.tsx
**Propósito:** Interface de preguntas y respuestas
**Props:**
- `document: Document` - Documento activo

**Estado:**
- `messages`: Historial de chat
- `question`: Pregunta actual
- `promptType`: basic/advanced

**Funciones:**
- `handleAsk()`: Envía pregunta a Edge Function
- Muestra respuesta con métricas y chunks

**Características:**
- Switch entre prompt básico y avanzado
- Visualización de faithfulness score
- Lista de chunks recuperados
- Historial persistente en sesión

### ExperimentDashboard.tsx
**Propósito:** Métricas y validación de hipótesis
**Props:**
- `document: Document`

**Métricas mostradas:**
- Faithfulness Score promedio
- Tasa de alucinación
- Número de prompts avanzados
- Citas promedio por respuesta

**Validación de hipótesis:**
- H1: Tasa de alucinación < 8%
- H2: Citas explícitas (≥2 por respuesta)
- H3: Recuperación híbrida activa

## Edge Functions

### process-document/index.ts

**Entrada:**
```typescript
{
  documentId: string,
  content: string,
  filename: string
}
```

**Funciones principales:**
- `hierarchicalChunking()`: Divide documento respetando estructura
- `createSemanticChunks()`: Crea chunks de tamaño óptimo
- `generateEmbedding()`: Llama API Hugging Face

**Salida:**
```typescript
{
  success: true,
  chunks: number,
  message: string
}
```

### query-rag/index.ts

**Entrada:**
```typescript
{
  documentId: string,
  question: string,
  promptType: 'basic' | 'advanced',
  topK: number
}
```

**Funciones principales:**
- `hybridRetrieval()`: Combina BM25 + vectorial
- `calculateBM25()`: Scoring léxico
- `calculateVectorSimilarity()`: Similitud coseno
- `generateAnswer()`: Llama LLM con prompt
- `extractCitations()`: Regex para detectar citas
- `calculateFaithfulness()`: Métrica de fidelidad

**Salida:**
```typescript
{
  answer: string,
  citations: string[],
  faithfulnessScore: number,
  retrievedChunks: Array<{...}>
}
```

## Configuración de Dependencias

### package.json (principales)

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.57.4",
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
```

### Librerías Edge Functions

- `@supabase/supabase-js`: Cliente de Supabase
- APIs externas: Hugging Face (embeddings), OpenAI (LLM)

## Scripts npm

```bash
npm run dev        # Servidor de desarrollo (puerto 5173)
npm run build      # Build de producción
npm run preview    # Vista previa del build
npm run lint       # Linter ESLint
npm run typecheck  # Verificación de tipos TypeScript
```

## Variables de Entorno Requeridas

### Frontend (.env)
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Edge Functions (Supabase Secrets)
```bash
HUGGINGFACE_API_KEY=hf_xxx...     # Opcional
OPENAI_API_KEY=sk-xxx...           # Opcional
SUPABASE_URL=xxx                   # Auto-configurado
SUPABASE_SERVICE_ROLE_KEY=xxx      # Auto-configurado
```

## Flujo de Desarrollo

1. **Modificar componentes React**: `src/components/*.tsx`
2. **Hot reload automático**: Vite detecta cambios
3. **Modificar Edge Functions**: `supabase/functions/*/index.ts`
4. **Re-deploy función**: Supabase CLI o Dashboard
5. **Modificar schema DB**: Crear nueva migración en Dashboard

## Testing del Sistema

### Test funcional básico:
```bash
1. npm run dev
2. Abrir http://localhost:5173
3. Crear cuenta test@test.com / test123
4. Cargar ejemplo_documento.txt
5. Esperar procesamiento
6. Hacer pregunta: "¿Qué es RAG?"
7. Verificar respuesta con citas
8. Revisar dashboard → Métricas
```

### Verificar logs:
- **Frontend**: Consola del navegador
- **Edge Functions**: Supabase Dashboard → Edge Functions → Logs
- **Database**: Supabase Dashboard → Database → Logs

## Extensiones Futuras

### Corto plazo:
- [ ] Soporte para múltiples documentos en una conversación
- [ ] Export de experimentos a CSV
- [ ] Comparación A/B de estrategias

### Mediano plazo:
- [ ] PDF parsing con OCR
- [ ] Re-ranking con cross-encoders
- [ ] Query expansion
- [ ] Caché de embeddings

### Largo plazo:
- [ ] Fine-tuning de embeddings
- [ ] Multi-hop reasoning
- [ ] Integración con bases vectoriales especializadas
- [ ] Sistema de feedback del usuario

---

Esta estructura modular permite fácil extensión y mantenimiento. Cada componente tiene responsabilidades claras y bien definidas.
