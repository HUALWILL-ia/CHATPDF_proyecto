/*
  # RAG System Database Schema
  
  1. New Extensions
    - `pgvector` for storing and querying embeddings
  
  2. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `filename` (text)
      - `content` (text, full document content)
      - `metadata` (jsonb, document metadata)
      - `chunk_count` (integer)
      - `processing_status` (text: pending, processing, completed, failed)
      - `created_at` (timestamptz)
    
    - `chunks`
      - `id` (uuid, primary key)
      - `document_id` (uuid, references documents)
      - `chunk_index` (integer)
      - `text` (text, chunk content)
      - `embedding` (vector(384), for bge-small-en-v1.5 model)
      - `metadata` (jsonb, section title, level, token count, etc.)
      - `created_at` (timestamptz)
    
    - `queries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `document_id` (uuid, references documents)
      - `question` (text)
      - `answer` (text)
      - `retrieved_chunks` (jsonb, array of chunk IDs with scores)
      - `prompt_type` (text: basic, advanced)
      - `citations` (jsonb, extracted citations)
      - `faithfulness_score` (float)
      - `created_at` (timestamptz)
    
    - `experiments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `experiment_type` (text: chunking, retrieval, generation, full_pipeline)
      - `document_id` (uuid, references documents)
      - `metrics` (jsonb, experiment results and metrics)
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Authenticated users required for all operations
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  chunk_count integer DEFAULT 0,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Chunks table with embeddings
CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  embedding vector(384),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks from own documents"
  ON chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = chunks.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chunks to own documents"
  ON chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = chunks.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chunks from own documents"
  ON chunks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = chunks.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for document lookup
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

-- Queries table
CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  retrieved_chunks jsonb DEFAULT '[]'::jsonb,
  prompt_type text DEFAULT 'basic' CHECK (prompt_type IN ('basic', 'advanced')),
  citations jsonb DEFAULT '[]'::jsonb,
  faithfulness_score float DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries"
  ON queries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
  ON queries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own queries"
  ON queries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_type text NOT NULL CHECK (experiment_type IN ('chunking', 'retrieval', 'generation', 'full_pipeline')),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own experiments"
  ON experiments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own experiments"
  ON experiments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own experiments"
  ON experiments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS queries_user_id_idx ON queries(user_id);
CREATE INDEX IF NOT EXISTS queries_document_id_idx ON queries(document_id);
CREATE INDEX IF NOT EXISTS experiments_user_id_idx ON experiments(user_id);
CREATE INDEX IF NOT EXISTS experiments_document_id_idx ON experiments(document_id);