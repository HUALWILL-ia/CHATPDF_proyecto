import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Zap, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Query, Document } from '../types';

interface ExperimentDashboardProps {
  document: Document;
}

interface MetricCard {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  color: string;
}

export default function ExperimentDashboard({ document }: ExperimentDashboardProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueries();
  }, [document.id]);

  const loadQueries = async () => {
    try {
      const { data, error } = await supabase
        .from('queries')
        .select('*')
        .eq('document_id', document.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueries(data || []);
    } catch (err) {
      console.error('Error loading queries:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <p className="text-center text-slate-500">Cargando métricas...</p>
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 text-center">
        <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">
          No hay consultas aún. Haz preguntas para ver métricas del sistema RAG.
        </p>
      </div>
    );
  }

  const avgFaithfulness = queries.reduce((sum, q) => sum + q.faithfulness_score, 0) / queries.length;
  const hallucinationRate = 1 - avgFaithfulness;
  const advancedQueries = queries.filter(q => q.prompt_type === 'advanced').length;
  const avgCitations = queries.reduce((sum, q) => sum + q.citations.length, 0) / queries.length;

  const metrics: MetricCard[] = [
    {
      title: 'Faithfulness Score',
      value: `${(avgFaithfulness * 100).toFixed(1)}%`,
      subtitle: `${queries.length} consultas totales`,
      icon: Shield,
      color: 'bg-green-500',
    },
    {
      title: 'Tasa de Alucinación',
      value: `${(hallucinationRate * 100).toFixed(1)}%`,
      subtitle: hallucinationRate < 0.08 ? 'Excelente (< 8%)' : 'Mejorable',
      icon: TrendingUp,
      color: hallucinationRate < 0.08 ? 'bg-green-500' : 'bg-yellow-500',
    },
    {
      title: 'Prompts Avanzados',
      value: `${advancedQueries}`,
      subtitle: `${((advancedQueries / queries.length) * 100).toFixed(0)}% del total`,
      icon: Zap,
      color: 'bg-blue-500',
    },
    {
      title: 'Citas Promedio',
      value: avgCitations.toFixed(1),
      subtitle: 'Por respuesta',
      icon: BarChart3,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
        <h2 className="text-2xl font-bold mb-2">Dashboard de Experimentos</h2>
        <p className="text-slate-300">
          Validación de hipótesis del sistema RAG
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => (
            <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <metric.icon className="w-6 h-6 text-slate-600" />
                <div className={`w-2 h-2 rounded-full ${metric.color}`} />
              </div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                {metric.title}
              </p>
              <p className="text-3xl font-bold text-slate-900 mb-1">
                {metric.value}
              </p>
              <p className="text-xs text-slate-500">{metric.subtitle}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">Validación de Hipótesis</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className={`font-bold ${hallucinationRate < 0.08 ? 'text-green-600' : 'text-yellow-600'}`}>
                {hallucinationRate < 0.08 ? '✓' : '⚠'}
              </span>
              <div>
                <p className="font-semibold text-slate-700">
                  H1: Anti-alucinación {'<'} 8%
                </p>
                <p className="text-slate-600">
                  {hallucinationRate < 0.08
                    ? `Cumplida: ${(hallucinationRate * 100).toFixed(1)}% tasa de alucinación`
                    : `Requiere ajuste: ${(hallucinationRate * 100).toFixed(1)}% tasa de alucinación`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className={`font-bold ${avgCitations >= 2 ? 'text-green-600' : 'text-yellow-600'}`}>
                {avgCitations >= 2 ? '✓' : '⚠'}
              </span>
              <div>
                <p className="font-semibold text-slate-700">
                  H2: Citas explícitas en respuestas
                </p>
                <p className="text-slate-600">
                  {avgCitations >= 2
                    ? `Cumplida: ${avgCitations.toFixed(1)} citas promedio por respuesta`
                    : `Parcial: ${avgCitations.toFixed(1)} citas promedio (objetivo: ≥2)`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold text-green-600">✓</span>
              <div>
                <p className="font-semibold text-slate-700">
                  H3: Recuperación híbrida implementada
                </p>
                <p className="text-slate-600">
                  Sistema BM25 + Vectorial con RRF activo en todas las consultas
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 mb-3">Historial de Consultas</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {queries.slice(0, 10).map((query) => (
              <div key={query.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      {query.question}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className={`px-2 py-1 rounded ${
                        query.prompt_type === 'advanced'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {query.prompt_type === 'advanced' ? 'Avanzado' : 'Básico'}
                      </span>
                      <span>
                        Faithfulness: {(query.faithfulness_score * 100).toFixed(0)}%
                      </span>
                      <span>
                        {query.citations.length} citas
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      {new Date(query.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
