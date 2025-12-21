// src/app/(dashboard)/settings/style/page.tsx
// UI for viewing and managing physician writing style profile

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { StyleProfile } from '@/domains/style/style.types';

interface EditStatistics {
  totalEdits: number;
  editsLast7Days: number;
  editsLast30Days: number;
  lastEditDate: string | null;
}

interface StyleData {
  profile: StyleProfile | null;
  statistics: EditStatistics;
  canAnalyze: boolean;
}

export default function StyleSettingsPage() {
  const router = useRouter();
  const [styleData, setStyleData] = useState<StyleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current style profile and statistics
  useEffect(() => {
    fetchStyleData();
  }, []);

  const fetchStyleData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/style/analyze');
      if (!response.ok) {
        throw new Error('Failed to fetch style data');
      }

      const data = await response.json();
      setStyleData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load style data');
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError(null);

      const response = await fetch('/api/style/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minEdits: 5, maxEdits: 50 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }

      const data = await response.json();
      setStyleData({
        profile: data.profile,
        statistics: data.statistics,
        canAnalyze: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const profile = styleData?.profile;
  const stats = styleData?.statistics;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Writing Style Profile</h1>
        <p className="text-gray-600">
          DictateMED learns your writing style from the edits you make to AI-generated letters.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Statistics Card */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <h2 className="text-xl font-semibold mb-4">Edit Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats?.totalEdits ?? 0}</div>
            <div className="text-sm text-gray-600">Total Edits</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats?.editsLast7Days ?? 0}</div>
            <div className="text-sm text-gray-600">Last 7 Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{stats?.editsLast30Days ?? 0}</div>
            <div className="text-sm text-gray-600">Last 30 Days</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {stats?.lastEditDate
                ? new Date(stats.lastEditDate).toLocaleDateString()
                : 'Never'}
            </div>
            <div className="text-sm text-gray-600">Last Edit</div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={triggerAnalysis}
            disabled={!styleData?.canAnalyze || analyzing}
            className={`px-4 py-2 rounded font-medium ${
              styleData?.canAnalyze && !analyzing
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {analyzing ? 'Analyzing...' : 'Run Style Analysis'}
          </button>
          {!styleData?.canAnalyze && (
            <p className="mt-2 text-sm text-gray-600">
              You need at least 5 edits before style analysis can run.
            </p>
          )}
        </div>
      </div>

      {/* Style Profile */}
      {profile ? (
        <>
          {/* Overview Card */}
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Overview</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total Edits Analyzed:</span>
                <span className="font-semibold">{profile.totalEditsAnalyzed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Last Analyzed:</span>
                <span className="font-semibold">
                  {profile.lastAnalyzedAt
                    ? new Date(profile.lastAnalyzedAt).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Overall Confidence:</span>
                <span className="font-semibold">
                  {calculateAverageConfidence(profile.confidence)}%
                </span>
              </div>
            </div>
          </div>

          {/* Style Preferences */}
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Detected Preferences</h2>
            <div className="space-y-4">
              <PreferenceRow
                label="Greeting Style"
                value={profile.greetingStyle}
                confidence={profile.confidence.greetingStyle}
                examples={profile.greetingExamples}
              />
              <PreferenceRow
                label="Closing Style"
                value={profile.closingStyle}
                confidence={profile.confidence.closingStyle}
                examples={profile.closingExamples}
              />
              <PreferenceRow
                label="Paragraph Structure"
                value={profile.paragraphStructure}
                confidence={profile.confidence.paragraphStructure}
              />
              <PreferenceRow
                label="Medication Format"
                value={profile.medicationFormat}
                confidence={profile.confidence.medicationFormat}
              />
              <PreferenceRow
                label="Clinical Value Format"
                value={profile.clinicalValueFormat}
                confidence={profile.confidence.clinicalValueFormat}
              />
              <PreferenceRow
                label="Formality Level"
                value={profile.formalityLevel}
                confidence={profile.confidence.formalityLevel}
              />
              <PreferenceRow
                label="Sentence Complexity"
                value={profile.sentenceComplexity}
                confidence={profile.confidence.sentenceComplexity}
              />
            </div>
          </div>

          {/* Vocabulary Preferences */}
          {profile.vocabularyPreferences && Object.keys(profile.vocabularyPreferences).length > 0 && (
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold mb-4">Vocabulary Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(profile.vocabularyPreferences).map(([from, to]) => (
                  <div key={from} className="flex items-center space-x-2 text-sm">
                    <span className="text-red-600 line-through">{from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600 font-medium">{to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Order */}
          {profile.sectionOrder && profile.sectionOrder.length > 0 && (
            <div className="bg-white rounded-lg shadow mb-6 p-6">
              <h2 className="text-xl font-semibold mb-4">Preferred Section Order</h2>
              <ol className="list-decimal list-inside space-y-2">
                {profile.sectionOrder.map((section, idx) => (
                  <li key={idx} className="text-gray-700">
                    {section}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">No style profile available yet.</p>
          <p className="text-sm text-gray-500">
            Edit some AI-generated letters, then run style analysis to build your profile.
          </p>
        </div>
      )}
    </div>
  );
}

// Helper component for displaying a preference row
function PreferenceRow({
  label,
  value,
  confidence,
  examples,
}: {
  label: string;
  value: string | null | undefined;
  confidence: number;
  examples?: string[];
}) {
  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor =
    confidence >= 0.7 ? 'bg-green-500' :
    confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="border-b border-gray-200 pb-3 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{label}</span>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-700 capitalize">
            {value ?? 'Not detected'}
          </span>
          <div className="flex items-center space-x-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${confidenceColor}`}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-10 text-right">
              {confidencePercent}%
            </span>
          </div>
        </div>
      </div>
      {examples && examples.length > 0 && (
        <div className="mt-2 space-y-1">
          {examples.slice(0, 2).map((example, idx) => (
            <div key={idx} className="text-sm text-gray-600 italic">
              &quot;{example}&quot;
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Calculate average confidence across all preferences
function calculateAverageConfidence(confidence: StyleProfile['confidence']): number {
  const values = Object.values(confidence);
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.round(avg * 100);
}
