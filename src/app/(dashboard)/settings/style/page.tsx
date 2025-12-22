// src/app/(dashboard)/settings/style/page.tsx
// UI for viewing and managing physician writing style profile with per-subspecialty support

'use client';

import { useState, useEffect, useRef } from 'react';
import type { Subspecialty } from '@prisma/client';
import type { StyleProfile } from '@/domains/style/style.types';
import type { SubspecialtyStyleProfile } from '@/domains/style/subspecialty-profile.types';
import {
  useStyleProfiles,
  formatSubspecialtyLabel,
  getAllSubspecialties,
  calculateProfileConfidence,
} from '@/hooks/useStyleProfiles';
import {
  SubspecialtyStyleCard,
  SeedLetterUpload,
  StyleModeSelector,
  StyleModeInfoBanner,
  StyleSummary,
  type StyleMode,
} from './components';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { StyleSeedLetter } from '@/domains/style/subspecialty-profile.types';

interface EditStatistics {
  totalEdits: number;
  editsLast7Days: number;
  editsLast30Days: number;
  lastEditDate: string | null;
}

interface SubspecialtyEditStats {
  subspecialty: Subspecialty;
  editCount: number;
  canAnalyze: boolean;
}

interface StyleData {
  profile: StyleProfile | null;
  statistics: EditStatistics;
  canAnalyze: boolean;
  subspecialtyProfiles?: SubspecialtyStyleProfile[];
  subspecialtyStats?: SubspecialtyEditStats[];
}

export default function StyleSettingsPage() {
  // Global style data
  const [styleData, setStyleData] = useState<StyleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-subspecialty state
  const {
    profiles: subspecialtyProfiles,
    loading: profilesLoading,
    error: profilesError,
    fetchProfiles,
    triggerAnalysis,
    deleteProfile,
    adjustLearningStrength,
    uploadSeedLetter,
    listSeedLetters,
    deleteSeedLetter,
  } = useStyleProfiles();

  // Style mode preference (persisted in localStorage)
  const [styleMode, setStyleMode] = useState<StyleMode>('global');

  // Per-subspecialty analysis state
  const [analyzingSubspecialty, setAnalyzingSubspecialty] = useState<Subspecialty | null>(null);
  const [subspecialtyStats, setSubspecialtyStats] = useState<Map<Subspecialty, SubspecialtyEditStats>>(new Map());

  // Seed letters for display in SeedLetterUpload
  const [existingSeedLetters, setExistingSeedLetters] = useState<StyleSeedLetter[]>([]);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded sections
  const [showGlobalProfile, setShowGlobalProfile] = useState(false);

  // Load style mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('dictatemed-style-mode');
    if (savedMode === 'global' || savedMode === 'subspecialty') {
      setStyleMode(savedMode);
    }
  }, []);

  // Save style mode to localStorage
  const handleModeChange = (mode: StyleMode) => {
    setStyleMode(mode);
    localStorage.setItem('dictatemed-style-mode', mode);
  };

  // Fetch current style profile and statistics
  useEffect(() => {
    fetchStyleData();
  }, []);

  // Fetch all seed letters for the SeedLetterUpload component
  const fetchSeedLetters = async () => {
    try {
      const letters = await listSeedLetters();
      setExistingSeedLetters(letters);
    } catch {
      // Non-critical, just log and continue
      console.error('Failed to fetch seed letters');
    }
  };

  // Fetch subspecialty-specific stats and seed letters
  useEffect(() => {
    fetchSubspecialtyStats();
    fetchSeedLetters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subspecialtyProfiles]);

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

  const fetchSubspecialtyStats = async () => {
    const allSubspecialties = getAllSubspecialties();

    // Fetch all subspecialty stats in parallel for better performance
    const results = await Promise.allSettled(
      allSubspecialties.map(async (sub) => {
        const response = await fetch(`/api/style/profiles/${sub}/analyze`);
        if (!response.ok) return null;
        const data = await response.json();
        return {
          subspecialty: sub,
          editCount: data.editStats?.totalEdits ?? 0,
          canAnalyze: data.canAnalyze ?? false,
        } as SubspecialtyEditStats;
      })
    );

    const stats = new Map<Subspecialty, SubspecialtyEditStats>();
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        stats.set(result.value.subspecialty, result.value);
      }
    });

    setSubspecialtyStats(stats);
  };

  const triggerGlobalAnalysis = async () => {
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

  const handleSubspecialtyAnalyze = async (subspecialty: Subspecialty) => {
    setAnalyzingSubspecialty(subspecialty);
    setError(null);
    try {
      const success = await triggerAnalysis(subspecialty, false);
      if (!success) {
        setError(`Failed to analyze ${formatSubspecialtyLabel(subspecialty)} style profile. Please try again.`);
      }
      await fetchSubspecialtyStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Analysis failed for ${formatSubspecialtyLabel(subspecialty)}`);
    } finally {
      setAnalyzingSubspecialty(null);
    }
  };

  const handleSubspecialtyReset = async (subspecialty: Subspecialty) => {
    await deleteProfile(subspecialty);
    await fetchSubspecialtyStats();
  };

  const handleStrengthChange = async (subspecialty: Subspecialty, strength: number) => {
    await adjustLearningStrength(subspecialty, strength);
  };

  const handleSeedLetterUpload = async (subspecialty: Subspecialty, letterText: string) => {
    const result = await uploadSeedLetter({
      subspecialty,
      letterText,
      triggerAnalysis: true,
    });

    if (result) {
      // Refresh profiles, stats, and seed letters list
      await fetchProfiles();
      await fetchSubspecialtyStats();
      await fetchSeedLetters();
    }

    return result;
  };

  const handleSeedLetterDelete = async (seedLetterId: string) => {
    const success = await deleteSeedLetter(seedLetterId);
    if (success) {
      // Refresh seed letters list after deletion
      await fetchSeedLetters();
    }
    return success;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
        errors.push(`${file.name}: Unsupported file type`);
        continue;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      setUploadError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles].slice(0, 10));
      setUploadError(null);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove a file from the list
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload and analyze historical letters
  const uploadAndAnalyze = async () => {
    if (uploadedFiles.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/style/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Upload failed');
      }

      setUploadSuccess(`Successfully analyzed ${data.lettersProcessed} letters. Your style profile has been updated.`);
      setUploadedFiles([]);

      // Refresh style data
      await fetchStyleData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload letters');
    } finally {
      setUploading(false);
    }
  };

  // Get user's subspecialties (would come from user profile in real app)
  const userSubspecialties = getAllSubspecialties();

  if (loading || profilesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-sm text-muted-foreground">Loading style settings...</p>
        </div>
      </div>
    );
  }

  const globalProfile = styleData?.profile;
  const stats = styleData?.statistics;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Writing Style Profile</h1>
        <p className="text-gray-600">
          DictateMED learns your writing style from the edits you make to AI-generated letters.
          You can use one global style or separate styles for each subspecialty.
        </p>
      </div>

      {/* Info Banner - StyleModeInfoBanner has its own dismiss state */}
      <StyleModeInfoBanner />

      {/* Style Mode Selector */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Style Mode</h2>
        <StyleModeSelector
          currentMode={styleMode}
          globalProfileExists={!!globalProfile}
          subspecialtyProfiles={subspecialtyProfiles}
          userSubspecialties={userSubspecialties}
          onModeChange={handleModeChange}
          onViewSubspecialtyProfiles={() => setStyleMode('subspecialty')}
        />
      </section>

      <Separator />

      {/* Main Content - Tabbed for mode */}
      <Tabs value={styleMode} onValueChange={(v: string) => handleModeChange(v as StyleMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="global">Global Style</TabsTrigger>
          <TabsTrigger value="subspecialty">Per-Subspecialty</TabsTrigger>
        </TabsList>

        {/* Error Display */}
        {(error || profilesError) && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error || profilesError}</span>
          </div>
        )}

        {/* Global Style Tab */}
        <TabsContent value="global" className="space-y-6">
          <StyleSummary
            mode="global"
            globalProfileExists={!!globalProfile}
            subspecialtyProfiles={subspecialtyProfiles}
          />

          {/* Historical Letter Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Upload Historical Letters</CardTitle>
              <CardDescription>
                Upload your past medical letters (PDF, DOC, DOCX, or TXT) to quickly build your global style profile.
                This is optional - your profile will also learn from edits you make to AI-generated letters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Upload area */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">Click to upload letters</p>
                <p className="text-sm text-gray-500 mt-1">PDF, DOC, DOCX, or TXT (max 10MB each, up to 10 files)</p>
              </button>

              {/* Selected files list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{uploadedFiles.length} file(s) selected:</p>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <Button
                    onClick={uploadAndAnalyze}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Analyze {uploadedFiles.length} Letter{uploadedFiles.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Upload success message */}
              {uploadSuccess && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  <CheckCircle className="h-5 w-5" />
                  <p className="text-sm">{uploadSuccess}</p>
                </div>
              )}

              {/* Upload error message */}
              {uploadError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Learn from Your Edits</CardTitle>
              <CardDescription>
                As you edit AI-generated letters, DictateMED learns your preferences automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-md font-medium text-gray-700">Edit Statistics</h3>
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

              <div className="flex items-center gap-4 pt-4">
                <Button
                  onClick={triggerGlobalAnalysis}
                  disabled={!styleData?.canAnalyze || analyzing}
                  variant={styleData?.canAnalyze && !analyzing ? 'default' : 'secondary'}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Run Style Analysis'
                  )}
                </Button>
                {!styleData?.canAnalyze && (
                  <p className="text-sm text-gray-600">
                    You need at least 5 edits before style analysis can run.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Global Style Profile Display */}
          {globalProfile && (
            <Card>
              <CardHeader>
                <button
                  type="button"
                  onClick={() => setShowGlobalProfile(!showGlobalProfile)}
                  className="w-full flex items-center justify-between"
                >
                  <div>
                    <CardTitle className="text-xl text-left">Detected Style Profile</CardTitle>
                    <CardDescription className="text-left">
                      Based on {globalProfile.totalEditsAnalyzed} analyzed edits
                    </CardDescription>
                  </div>
                  {showGlobalProfile ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              {showGlobalProfile && (
                <CardContent className="space-y-6">
                  {/* Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Total Edits Analyzed</span>
                      <p className="font-semibold">{globalProfile.totalEditsAnalyzed}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Last Analyzed</span>
                      <p className="font-semibold">
                        {globalProfile.lastAnalyzedAt
                          ? new Date(globalProfile.lastAnalyzedAt).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Overall Confidence</span>
                      <p className="font-semibold">{calculateAverageConfidence(globalProfile.confidence)}%</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Style Preferences */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Detected Preferences</h3>
                    <div className="grid gap-3">
                      <PreferenceRow
                        label="Greeting Style"
                        value={globalProfile.greetingStyle}
                        confidence={globalProfile.confidence.greetingStyle}
                        examples={globalProfile.greetingExamples}
                      />
                      <PreferenceRow
                        label="Closing Style"
                        value={globalProfile.closingStyle}
                        confidence={globalProfile.confidence.closingStyle}
                        examples={globalProfile.closingExamples}
                      />
                      <PreferenceRow
                        label="Paragraph Structure"
                        value={globalProfile.paragraphStructure}
                        confidence={globalProfile.confidence.paragraphStructure}
                      />
                      <PreferenceRow
                        label="Medication Format"
                        value={globalProfile.medicationFormat}
                        confidence={globalProfile.confidence.medicationFormat}
                      />
                      <PreferenceRow
                        label="Clinical Value Format"
                        value={globalProfile.clinicalValueFormat}
                        confidence={globalProfile.confidence.clinicalValueFormat}
                      />
                      <PreferenceRow
                        label="Formality Level"
                        value={globalProfile.formalityLevel}
                        confidence={globalProfile.confidence.formalityLevel}
                      />
                      <PreferenceRow
                        label="Sentence Complexity"
                        value={globalProfile.sentenceComplexity}
                        confidence={globalProfile.confidence.sentenceComplexity}
                      />
                    </div>
                  </div>

                  {/* Vocabulary Preferences */}
                  {globalProfile.vocabularyPreferences && Object.keys(globalProfile.vocabularyPreferences).length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="font-medium">Vocabulary Preferences</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(globalProfile.vocabularyPreferences).map(([from, to]) => (
                            <div key={from} className="flex items-center space-x-2 text-sm">
                              <span className="text-red-600 line-through">{from}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 font-medium">{to}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Section Order */}
                  {globalProfile.sectionOrder && globalProfile.sectionOrder.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="font-medium">Preferred Section Order</h3>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          {globalProfile.sectionOrder.map((section, idx) => (
                            <li key={idx} className="text-gray-700">{section}</li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* No Profile State */}
          {!globalProfile && (
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="py-8 text-center">
                <Settings2 className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">No style profile available yet.</p>
                <p className="text-sm text-gray-500">
                  Edit some AI-generated letters, then run style analysis to build your profile.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Per-Subspecialty Tab */}
        <TabsContent value="subspecialty" className="space-y-6">
          <StyleSummary
            mode="subspecialty"
            globalProfileExists={!!globalProfile}
            subspecialtyProfiles={subspecialtyProfiles}
          />

          {/* Seed Letter Upload for Subspecialties */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Seed Your Style Profiles</CardTitle>
              <CardDescription>
                Upload sample letters to quickly bootstrap your subspecialty-specific style profiles.
                Each letter should be a complete example of your typical writing for that subspecialty.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SeedLetterUpload
                onUpload={handleSeedLetterUpload}
                onDelete={handleSeedLetterDelete}
                existingSeedLetters={existingSeedLetters}
              />
            </CardContent>
          </Card>

          {/* Subspecialty Profile Cards Grid */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Your Subspecialty Profiles</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userSubspecialties.map((subspecialty) => {
                const profile = subspecialtyProfiles.find((p) => p.subspecialty === subspecialty) ?? null;
                const stat = subspecialtyStats.get(subspecialty);

                return (
                  <SubspecialtyStyleCard
                    key={subspecialty}
                    subspecialty={subspecialty}
                    profile={profile}
                    editCount={stat?.editCount ?? 0}
                    isAnalyzing={analyzingSubspecialty === subspecialty}
                    canAnalyze={stat?.canAnalyze ?? false}
                    onAnalyze={handleSubspecialtyAnalyze}
                    onReset={handleSubspecialtyReset}
                    onStrengthChange={handleStrengthChange}
                  />
                );
              })}
            </div>
          </section>

          {/* How It Works */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <h3 className="font-medium text-blue-900 mb-2">How Per-Subspecialty Learning Works</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Each subspecialty learns independently from your edits within that specialty</li>
                <li>At least 5 edits per subspecialty are needed before analysis runs</li>
                <li>Profiles automatically improve as you make more edits</li>
                <li>Use the adaptation slider to control how strongly your style is applied</li>
                <li>Reset a profile at any time to start fresh with neutral defaults</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
