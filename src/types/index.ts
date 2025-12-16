export interface Document {
  id: string;
  user_id: string;
  filename: string;
  content: string;
  metadata: Record<string, any>;
  chunk_count: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  embedding: number[] | string;
  metadata: {
    section_title: string;
    section_level: number;
    chunk_type: string;
    token_count: number;
  };
  created_at: string;
}

export interface Query {
  id: string;
  user_id: string;
  document_id: string;
  question: string;
  answer: string;
  retrieved_chunks: Array<{
    id: string;
    score: number;
    rank: number;
  }>;
  prompt_type: 'basic' | 'advanced';
  citations: string[];
  faithfulness_score: number;
  created_at: string;
}

export interface Experiment {
  id: string;
  user_id: string;
  experiment_type: 'chunking' | 'retrieval' | 'generation' | 'full_pipeline';
  document_id?: string;
  metrics: Record<string, any>;
  created_at: string;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  section: string;
  score: number;
}

export interface RAGResponse {
  success: boolean;
  queryId: string;
  answer: string;
  citations: string[];
  faithfulnessScore: number;
  retrievedChunks: RetrievedChunk[];
}
