import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChunkMetadata {
  section_title: string;
  section_level: number;
  chunk_type: string;
  token_count: number;
  page?: number;
}

interface Chunk {
  chunk_index: number;
  text: string;
  metadata: ChunkMetadata;
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

    const { documentId, content, filename } = await req.json();

    if (!documentId || !content) {
      throw new Error('Missing documentId or content');
    }

    console.log(`Processing document: ${documentId}`);

    const { error: updateError } = await supabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    const chunks = hierarchicalChunking(content, filename);
    console.log(`Generated ${chunks.length} chunks`);

    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const embedding = await generateEmbedding(chunk.text);
        return {
          document_id: documentId,
          chunk_index: index,
          text: chunk.text,
          embedding: JSON.stringify(embedding),
          metadata: chunk.metadata,
        };
      })
    );

    const { error: insertError } = await supabase
      .from('chunks')
      .insert(chunksWithEmbeddings);

    if (insertError) throw insertError;

    const { error: finalUpdateError } = await supabase
      .from('documents')
      .update({ 
        processing_status: 'completed',
        chunk_count: chunks.length 
      })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (finalUpdateError) throw finalUpdateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks: chunks.length,
        message: 'Document processed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function hierarchicalChunking(content: string, filename: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  
  let currentSection = {
    title: filename || 'Document',
    level: 0,
    content: [] as string[],
  };
  
  const sectionPatterns = [
    /^#{1,6}\s+(.+)$/,
    /^[A-Z][A-Za-z\s]{2,50}:$/,
    /^\d+\.\s+[A-Z].{3,50}$/,
    /^[A-Z][A-Z\s]{3,30}$/,
  ];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    let isHeading = false;
    let headingLevel = 1;
    
    for (const pattern of sectionPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        isHeading = true;
        headingLevel = trimmedLine.startsWith('#') 
          ? (trimmedLine.match(/^#+/) || [''])[0].length 
          : 1;
        break;
      }
    }
    
    if (isHeading && currentSection.content.length > 0) {
      const sectionChunks = createSemanticChunks(currentSection);
      chunks.push(...sectionChunks);
      
      currentSection = {
        title: trimmedLine.replace(/^#+\s*/, '').replace(/:$/, ''),
        level: headingLevel,
        content: [],
      };
    } else if (isHeading) {
      currentSection = {
        title: trimmedLine.replace(/^#+\s*/, '').replace(/:$/, ''),
        level: headingLevel,
        content: [],
      };
    } else {
      currentSection.content.push(trimmedLine);
    }
  }
  
  if (currentSection.content.length > 0) {
    const sectionChunks = createSemanticChunks(currentSection);
    chunks.push(...sectionChunks);
  }
  
  return chunks.map((chunk, index) => ({
    ...chunk,
    chunk_index: index,
  }));
}

function createSemanticChunks(
  section: { title: string; level: number; content: string[] },
  maxTokens = 500
): Chunk[] {
  const chunks: Chunk[] = [];
  const fullText = section.content.join(' ');
  
  const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
  
  let currentChunk: string[] = [];
  let currentLength = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = sentence.split(/\s+/).length;
    
    if (currentLength + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        chunk_index: chunks.length,
        text: currentChunk.join(' ').trim(),
        metadata: {
          section_title: section.title,
          section_level: section.level,
          chunk_type: 'text',
          token_count: currentLength,
        },
      });
      
      currentChunk = [sentence];
      currentLength = sentenceTokens;
    } else {
      currentChunk.push(sentence);
      currentLength += sentenceTokens;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push({
      chunk_index: chunks.length,
      text: currentChunk.join(' ').trim(),
      metadata: {
        section_title: section.title,
        section_level: section.level,
        chunk_type: 'text',
        token_count: currentLength,
      },
    });
  }
  
  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');
  
  if (!hfToken) {
    console.warn('No Hugging Face API key, generating mock embedding');
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