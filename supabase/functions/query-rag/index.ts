import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RetrievedChunk {
  id: string;
  text: string;
  metadata: any;
  score: number;
  rank: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { documentId, question, promptType = 'advanced', topK = 5 } = await req.json();

    if (!documentId || !question) {
      throw new Error('Missing documentId or question');
    }

    console.log(`Processing query for document ${documentId}: ${question}`);

    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('*')
      .eq('document_id', documentId);

    if (chunksError || !chunks || chunks.length === 0) {
      throw new Error('No chunks found for document');
    }

    console.log(`Found ${chunks.length} chunks`);

    const questionEmbedding = await generateEmbedding(question);

    const retrievedChunks = hybridRetrieval(chunks, question, questionEmbedding, topK);
    console.log(`Retrieved ${retrievedChunks.length} relevant chunks`);

    const answer = await generateAnswer(question, retrievedChunks, promptType);

    const citations = extractCitations(answer);
    const faithfulnessScore = calculateFaithfulness(answer, citations, retrievedChunks);

    const { data: queryRecord, error: insertError } = await supabase
      .from('queries')
      .insert({
        user_id: user.id,
        document_id: documentId,
        question,
        answer,
        retrieved_chunks: retrievedChunks.map(c => ({
          id: c.id,
          score: c.score,
          rank: c.rank,
        })),
        prompt_type: promptType,
        citations,
        faithfulness_score: faithfulnessScore,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        queryId: queryRecord.id,
        answer,
        citations,
        faithfulnessScore,
        retrievedChunks: retrievedChunks.map(c => ({
          id: c.id,
          text: c.text.slice(0, 200) + '...',
          section: c.metadata?.section_title || 'Unknown',
          score: c.score,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing query:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function hybridRetrieval(
  chunks: any[],
  query: string,
  queryEmbedding: number[],
  topK: number
): RetrievedChunk[] {
  const bm25Scores = calculateBM25(chunks, query);
  const vectorScores = calculateVectorSimilarity(chunks, queryEmbedding);

  const bm25Ranks = bm25Scores
    .map((score, idx) => ({ idx, score }))
    .sort((a, b) => b.score - a.score)
    .map((item, rank) => ({ idx: item.idx, rank }));

  const vectorRanks = vectorScores
    .map((score, idx) => ({ idx, score }))
    .sort((a, b) => b.score - a.score)
    .map((item, rank) => ({ idx: item.idx, rank }));

  const fusedScores = chunks.map((_, idx) => {
    const bm25Rank = bm25Ranks.find(r => r.idx === idx)?.rank ?? chunks.length;
    const vectorRank = vectorRanks.find(r => r.idx === idx)?.rank ?? chunks.length;
    
    const k = 60;
    const rrfScore = (1 / (k + bm25Rank + 1)) + (1 / (k + vectorRank + 1));
    
    return { idx, score: rrfScore };
  });

  const topChunks = fusedScores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item, rank) => ({
      id: chunks[item.idx].id,
      text: chunks[item.idx].text,
      metadata: chunks[item.idx].metadata,
      score: item.score,
      rank: rank + 1,
    }));

  return topChunks;
}

function calculateBM25(chunks: any[], query: string): number[] {
  const k1 = 1.5;
  const b = 0.75;
  
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docs = chunks.map(c => c.text.toLowerCase().split(/\s+/));
  const avgDocLen = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length;
  
  const df: Record<string, number> = {};
  docs.forEach(doc => {
    const uniqueTerms = new Set(doc);
    uniqueTerms.forEach(term => {
      df[term] = (df[term] || 0) + 1;
    });
  });
  
  const N = docs.length;
  
  return docs.map(doc => {
    let score = 0;
    const docLen = doc.length;
    
    queryTerms.forEach(term => {
      const tf = doc.filter(t => t === term).length;
      const idf = Math.log((N - (df[term] || 0) + 0.5) / ((df[term] || 0) + 0.5) + 1);
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen))));
    });
    
    return score;
  });
}

function calculateVectorSimilarity(chunks: any[], queryEmbedding: number[]): number[] {
  return chunks.map(chunk => {
    const chunkEmbedding = typeof chunk.embedding === 'string' 
      ? JSON.parse(chunk.embedding)
      : chunk.embedding;
    
    if (!chunkEmbedding || !Array.isArray(chunkEmbedding)) {
      return 0;
    }
    
    return cosineSimilarity(queryEmbedding, chunkEmbedding);
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

async function generateAnswer(
  question: string,
  context: RetrievedChunk[],
  promptType: string
): Promise<string> {
  const contextText = context
    .map((chunk, i) => 
      `[FUENTE ${i + 1}: ${chunk.id.slice(0, 8)} | ${chunk.metadata?.section_title || 'Sección'}]:\n${chunk.text}`
    )
    .join('\n\n');

  let prompt = '';
  
  if (promptType === 'advanced') {
    prompt = `Eres un asistente académico especializado. Analiza el contexto y responde la pregunta.\n\nCONTEXTO:\n${contextText}\n\nINSTRUCCIONES ESTRICTAS:\n1. Usa SOLO información del contexto proporcionado.\n2. Incluye citas explícitas [FUENTE N] después de cada afirmación.\n3. Si la información es insuficiente, indica "La información proporcionada no es suficiente para responder".\n4. Sé preciso y conciso.\n\nPREGUNTA: ${question}\n\nRESPUESTA CON CITAS:`;
  } else {
    prompt = `Contexto:\n${contextText}\n\nPregunta: ${question}\n\nBasándote en el contexto, responde la pregunta:\nRespuesta:`;
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    console.warn('No OpenAI API key, generating mock answer');
    return generateMockAnswer(question, context, promptType);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Eres un asistente académico experto.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No se pudo generar una respuesta.';
  } catch (error) {
    console.error('Error generating answer:', error);
    return generateMockAnswer(question, context, promptType);
  }
}

function generateMockAnswer(
  question: string,
  context: RetrievedChunk[],
  promptType: string
): string {
  const mainChunk = context[0];
  const excerpt = mainChunk.text.slice(0, 150);
  
  if (promptType === 'advanced') {
    return `Según el contexto proporcionado, ${excerpt}... [FUENTE 1: ${mainChunk.id.slice(0, 8)}]. Esta información se encuentra en la sección "${mainChunk.metadata?.section_title || 'documento'}" [FUENTE 1].`;
  } else {
    return `Basándome en el contexto: ${excerpt}...`;
  }
}

function extractCitations(answer: string): string[] {
  const citationPattern = /\[FUENTE\s+(\d+)(?::\s*[^\]]+)?\]/gi;
  const matches = answer.matchAll(citationPattern);
  const citations = new Set<string>();
  
  for (const match of matches) {
    citations.add(match[1]);
  }
  
  return Array.from(citations);
}

function calculateFaithfulness(
  answer: string,
  citations: string[],
  context: RetrievedChunk[]
): number {
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length === 0) return 0;
  
  let sentencesWithCitations = 0;
  sentences.forEach(sentence => {
    if (/\[FUENTE\s+\d+/.test(sentence)) {
      sentencesWithCitations++;
    }
  });
  
  return sentencesWithCitations / sentences.length;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');
  
  if (!hfToken) {
    return Array(384).fill(0).map(() => Math.random() * 2 - 1);
  }
  
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text.slice(0, 500) }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`HF API error: ${response.status}`);
    }
    
    const embedding = await response.json();
    return Array.isArray(embedding) ? embedding : Array(384).fill(0).map(() => Math.random() * 2 - 1);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return Array(384).fill(0).map(() => Math.random() * 2 - 1);
  }
}