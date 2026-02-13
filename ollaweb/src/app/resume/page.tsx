"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { LaTeXEditor } from '../components/latex-editor';
import { PDFPreview } from '../components/pdf-preview';
import { JobInput } from '../components/job-input';
import { DiffViewer } from '../components/diff-viewer';
import { ResumeHistory } from '../components/resume-history';
import type { UserProfile, ResumeVersion } from '../../lib/resume-types';
import { listVersions, saveVersion, deleteVersion, generateVersionTitle } from '../../lib/resume-storage';

const REQUIRED_MODELS = ['gpt-oss:20b'];

export default function ResumePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model check state
  const [modelCheck, setModelCheck] = useState<{
    checking: boolean;
    missing: string[];
    error: string | null;
  }>({ checking: true, missing: [], error: null });

  // Editor state
  const [latex, setLatex] = useState('');
  const model = 'gpt-oss:20b';
  const [saved, setSaved] = useState(false);

  // Job tailoring
  const [jobPosting, setJobPosting] = useState('');
  const [isTailoring, setIsTailoring] = useState(false);

  // Compile/preview state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Diff review state
  const [originalLatex, setOriginalLatex] = useState<string | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Upload/extract state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');

  // Version history state
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [savedVersions, setSavedVersions] = useState<ResumeVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Model pull state
  const [pullProgress, setPullProgress] = useState<Record<string, { status: string; percent: number; pulling: boolean; done: boolean; error: string | null }>>({});

  // Check required models
  const checkModels = useCallback(async () => {
    setModelCheck({ checking: true, missing: [], error: null });
    try {
      const res = await fetch('/api/models/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: REQUIRED_MODELS }),
      });

      if (!res.ok) {
        const err = await res.json();
        setModelCheck({ checking: false, missing: [], error: err.error || 'Failed to check models' });
        return;
      }

      const { results } = await res.json() as { results: Record<string, boolean> };
      const missing = REQUIRED_MODELS.filter((m) => !results[m]);
      setModelCheck({ checking: false, missing, error: null });
    } catch (err) {
      setModelCheck({
        checking: false,
        missing: [],
        error: err instanceof Error ? err.message : 'Cannot connect to Ollama. Is it running?',
      });
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkModels();
  }, [checkModels]);

  // Pull a missing model
  const handlePullModel = useCallback(async (modelName: string) => {
    setPullProgress((prev) => ({
      ...prev,
      [modelName]: { status: 'Starting download...', percent: 0, pulling: true, done: false, error: null },
    }));

    try {
      const res = await fetch('/api/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
      });

      if (!res.ok || !res.body) {
        setPullProgress((prev) => ({
          ...prev,
          [modelName]: { status: '', percent: 0, pulling: false, done: false, error: 'Failed to start download' },
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setPullProgress((prev) => ({
                ...prev,
                [modelName]: { status: 'Complete!', percent: 100, pulling: false, done: true, error: null },
              }));
              // Re-check models after successful pull
              await checkModels();
              return;
            }
            if (data.error) {
              setPullProgress((prev) => ({
                ...prev,
                [modelName]: { status: '', percent: 0, pulling: false, done: false, error: data.error },
              }));
              return;
            }
            const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            setPullProgress((prev) => ({
              ...prev,
              [modelName]: { status: data.status || 'Downloading...', percent, pulling: true, done: false, error: null },
            }));
          } catch {}
        }
      }
    } catch (err) {
      setPullProgress((prev) => ({
        ...prev,
        [modelName]: { status: '', percent: 0, pulling: false, done: false, error: err instanceof Error ? err.message : 'Download failed' },
      }));
    }
  }, [checkModels]);

  // Load saved resume on mount
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data: UserProfile) => {
        if (data.latex) setLatex(data.latex);
      })
      .catch(() => {});
    setSavedVersions(listVersions());
  }, []);

  // Save resume
  const handleSave = useCallback(async () => {
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex }),
      });
      // Save version to history
      const versionId = Date.now().toString();
      const version: ResumeVersion = {
        id: versionId,
        title: generateVersionTitle('Saved'),
        latex,
        createdAt: Date.now(),
      };
      saveVersion(version);
      setCurrentVersionId(versionId);
      setSavedVersions(listVersions());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }, [latex]);

  // Compile LaTeX to PDF — show in preview
  const compileLatex = useCallback(async (latexSource: string) => {
    if (!latexSource.trim()) return;

    setIsCompiling(true);
    setCompileError(null);

    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);

    try {
      const response = await fetch('/api/resume/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: latexSource }),
      });

      if (!response.ok) {
        const err = await response.json();
        setCompileError(err.error + (err.action ? ` — ${err.action}` : '') + (err.details ? `\n${err.details}` : ''));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : 'Compilation failed');
    } finally {
      setIsCompiling(false);
    }
  }, [pdfUrl]);

  const handleCompile = useCallback(() => {
    compileLatex(latex);
  }, [latex, compileLatex]);

  // Upload PDF and extract to LaTeX
  const handleUploadPDF = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractStatus('Extracting text from PDF...');
    setLatex('');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('model', 'gpt-oss:20b');

    try {
      const response = await fetch('/api/resume/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        setExtractStatus(`Error: ${err.error}`);
        setIsExtracting(false);
        return;
      }

      setExtractStatus('Converting to LaTeX...');

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullLatex = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullLatex += data.text;
              setLatex(fullLatex);
            }
            if (data.error) {
              setExtractStatus(`Error: ${data.error}${data.action ? ` — ${data.action}` : ''}`);
            }
            if (data.done) {
              setExtractStatus('');
            }
          } catch {}
        }
      }
      // Flush remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.text) {
            fullLatex += data.text;
            setLatex(fullLatex);
          }
          if (data.error) {
            setExtractStatus(`Error: ${data.error}${data.action ? ` — ${data.action}` : ''}`);
          }
          if (data.done) {
            setExtractStatus('');
          }
        } catch {}
      }
      // Auto-compile after extraction
      if (fullLatex.trim()) {
        await compileLatex(fullLatex);
      }
    } catch (err) {
      setExtractStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [model, compileLatex]);

  // Tailor resume for job posting
  const handleTailor = useCallback(async () => {
    if (!latex || !jobPosting.trim()) return;

    setIsTailoring(true);
    setOriginalLatex(latex); // Snapshot for diff review

    try {
      const response = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, jobPosting, model }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Tailor error:', err);
        setOriginalLatex(null);
        setIsTailoring(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setOriginalLatex(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let newLatex = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              newLatex += data.text;
              setLatex(newLatex);
            }
          } catch {}
        }
      }
      // Enter diff review mode (or auto-accept if no changes)
      if (newLatex.trim()) {
        if (newLatex.trim() === latex.trim()) {
          // No changes — auto-accept
          setOriginalLatex(null);
          await compileLatex(newLatex);
        } else {
          setIsReviewMode(true);
        }
      }
    } catch (err) {
      console.error('Tailor error:', err);
      setOriginalLatex(null);
    } finally {
      setIsTailoring(false);
    }
  }, [latex, jobPosting, model, compileLatex]);

  // Accept tailored changes
  const handleAcceptTailored = useCallback(() => {
    setIsReviewMode(false);
    setOriginalLatex(null);
    compileLatex(latex);
    // Save tailored version to history
    const versionId = Date.now().toString();
    const version: ResumeVersion = {
      id: versionId,
      title: generateVersionTitle('Tailored'),
      latex,
      createdAt: Date.now(),
    };
    saveVersion(version);
    setCurrentVersionId(versionId);
    setSavedVersions(listVersions());
  }, [latex, compileLatex]);

  // Reject tailored changes — revert to original
  const handleRejectTailored = useCallback(() => {
    if (originalLatex !== null) {
      setLatex(originalLatex);
      compileLatex(originalLatex);
    }
    setIsReviewMode(false);
    setOriginalLatex(null);
  }, [originalLatex, compileLatex]);

  // Build a smart filename from the LaTeX (name) and job posting (company + role)
  const buildFilename = useCallback(() => {
    // Extract name from LaTeX — look for common patterns like \name{...}, \textbf{Name}, or first {\Huge ...} / {\LARGE ...}
    let firstName = '';
    let lastName = '';
    const namePatterns = [
      /\\name\{([^}]+)\}/i,
      /\\begin\{center\}\s*(?:\\[A-Za-z]+\{)*\s*\{?\\(?:Huge|LARGE|Large|huge)\s+([^}\\]+)/i,
      /\{\\(?:Huge|LARGE|Large|huge)\s*\\textbf\{([^}]+)\}/i,
      /\{\\(?:Huge|LARGE|Large|huge)\s+([^}\\]+)\}/i,
      /\\textbf\{\\(?:Huge|LARGE|Large|huge)\s+([^}]+)\}/i,
      /\\centerline\{.*?\\(?:Huge|LARGE|Large|huge)\s+([^}\\]+)\}/i,
    ];

    for (const pat of namePatterns) {
      const m = latex.match(pat);
      if (m) {
        const parts = m[1].trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts[parts.length - 1];
        } else if (parts.length === 1) {
          firstName = parts[0];
        }
        break;
      }
    }

    // Fallback: grab the very first non-command text line that looks like a name (2-3 capitalized words)
    if (!firstName) {
      const lines = latex.split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/\\[a-zA-Z]+\{?/g, '').replace(/[{}\\%]/g, '').trim();
        if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(cleaned)) {
          const parts = cleaned.split(/\s+/);
          firstName = parts[0];
          lastName = parts[parts.length - 1];
          break;
        }
      }
    }

    // Extract company and role from job posting
    let company = '';
    let role = '';

    if (jobPosting.trim()) {
      // Company: look for "at <Company>", "Company:", or "company name" patterns
      const companyPatterns = [
        /(?:at|@)\s+([A-Z][A-Za-z0-9&. ]+?)(?:\s*[,.\n-])/,
        /[Cc]ompany\s*[:：]\s*([A-Za-z0-9&. ]+?)(?:\s*[,.\n])/,
        /^([A-Z][A-Za-z0-9&. ]+?)(?:\s*[-–|])/m,
      ];
      for (const pat of companyPatterns) {
        const m = jobPosting.match(pat);
        if (m) {
          company = m[1].trim().split(/\s+/).slice(0, 3).join('');
          break;
        }
      }

      // Role: look for job title patterns
      const rolePatterns = [
        /(?:title|role|position)\s*[:：]\s*([^\n,]+)/i,
        /(?:seeking|hiring|looking for)\s+(?:a |an )?([^\n,.]+)/i,
        /^([A-Z][A-Za-z ]+(?:Engineer|Developer|Designer|Manager|Analyst|Scientist|Architect|Intern|Lead|Director|Consultant|Specialist|Coordinator))/im,
        /([A-Za-z ]+(?:Engineer|Developer|Designer|Manager|Analyst|Scientist|Architect|Intern|Lead|Director|Consultant|Specialist|Coordinator))/i,
      ];
      for (const pat of rolePatterns) {
        const m = jobPosting.match(pat);
        if (m) {
          // Shorten to key words, e.g. "Senior UX Designer" -> "Sr_UX_Designer" or just take main words
          role = m[1].trim().split(/\s+/).slice(0, 3).join('_');
          break;
        }
      }
    }

    // Sanitize all parts
    const sanitize = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');

    const parts = [
      sanitize(firstName),
      sanitize(lastName),
      sanitize(company),
      sanitize(role),
    ].filter(Boolean);

    return parts.length > 0 ? `${parts.join('_')}.pdf` : 'resume.pdf';
  }, [latex, jobPosting]);

  // Download the compiled PDF
  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = buildFilename();
    a.click();
  }, [pdfUrl, buildFilename]);

  // Version history handlers
  const handleSelectVersion = useCallback((id: string) => {
    const version = savedVersions.find(v => v.id === id);
    if (version) {
      setLatex(version.latex);
      setCurrentVersionId(id);
      setHistoryOpen(false);
    }
  }, [savedVersions]);

  const handleDeleteVersion = useCallback((id: string) => {
    deleteVersion(id);
    setSavedVersions(listVersions());
    if (currentVersionId === id) {
      setCurrentVersionId(null);
    }
  }, [currentVersionId]);

  return (
    <div className="flex flex-col h-screen bg-retro-bg text-retro-text">
      {/* Header */}
      <header className="sticky top-0 bg-retro-surface retro-raised z-10 shrink-0">
        <div className="retro-titlebar flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-retro-green text-lg tracking-wider">[OllaWeb v2.0]</h1>
            <nav className="flex gap-1">
              <Link
                href="/"
                className="retro-raised bg-retro-surface px-2 py-0.5 text-retro-text text-sm no-underline hover:bg-retro-panel hover:text-retro-text-bright"
              >
                Chat
              </Link>
              <span className="retro-sunken bg-retro-panel px-2 py-0.5 text-retro-green text-sm">
                Resume
              </span>
              <Link
                href="/finance"
                className="retro-raised bg-retro-surface px-2 py-0.5 text-retro-text text-sm no-underline hover:bg-retro-panel hover:text-retro-text-bright"
              >
                Finance
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-retro-text text-sm">
            <ResumeHistory
              versions={savedVersions}
              currentVersionId={currentVersionId}
              isOpen={historyOpen}
              onToggle={() => setHistoryOpen(h => !h)}
              onSelect={handleSelectVersion}
              onDelete={handleDeleteVersion}
            />
            <span className="retro-raised bg-retro-surface px-1 cursor-default">_</span>
            <span className="retro-raised bg-retro-surface px-1 cursor-default">[]</span>
            <span className="retro-raised bg-retro-surface px-1 cursor-default">X</span>
          </div>
        </div>
      </header>

      {/* Model check overlay */}
      {(modelCheck.checking || modelCheck.missing.length > 0 || modelCheck.error) && (
        <div className="flex-1 flex items-center justify-center">
          <div className="retro-raised bg-retro-surface p-6 max-w-lg text-center">
            {modelCheck.checking ? (
              <>
                <p className="text-retro-cyan retro-blink text-lg mb-2">Checking required models...</p>
                <p className="text-retro-border-light text-sm">Connecting to Ollama</p>
              </>
            ) : modelCheck.error ? (
              <>
                <p className="text-retro-red text-lg mb-2">[ERROR]</p>
                <p className="text-retro-text mb-4">{modelCheck.error}</p>
                <p className="text-retro-border-light text-sm">Make sure Ollama is running: <span className="text-retro-cyan">ollama serve</span></p>
              </>
            ) : (
              <>
                <p className="text-retro-amber text-lg mb-3">[MISSING MODELS]</p>
                <p className="text-retro-text mb-4">The following models are required but not installed:</p>
                <div className="space-y-3 mb-4">
                  {modelCheck.missing.map((m) => {
                    const progress = pullProgress[m];
                    const isPulling = progress?.pulling;
                    const isDone = progress?.done;
                    const hasError = progress?.error;

                    return (
                      <div key={m} className="retro-sunken bg-retro-bg px-3 py-2 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className={isDone ? 'text-retro-green' : 'text-retro-red'}>{isDone ? '✓' : '✗'}</span>{' '}
                            <span className="text-retro-text-bright">{m}</span>
                          </div>
                          {!isPulling && !isDone && (
                            <button
                              type="button"
                              onClick={() => handlePullModel(m)}
                              className="retro-raised bg-retro-panel text-retro-cyan px-2 py-0.5 text-xs hover:bg-retro-blue hover:text-retro-text-bright"
                            >
                              [DOWNLOAD]
                            </button>
                          )}
                        </div>
                        {isPulling && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 retro-sunken bg-retro-bg h-3 overflow-hidden">
                                <div
                                  className="h-full bg-retro-cyan transition-all duration-300"
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>
                              <span className="text-retro-cyan text-xs w-10 text-right">{progress.percent}%</span>
                            </div>
                            <p className="text-retro-border-light text-xs">{progress.status}</p>
                          </div>
                        )}
                        {isDone && (
                          <p className="text-retro-green text-xs">Downloaded successfully!</p>
                        )}
                        {hasError && (
                          <p className="text-retro-red text-xs">Error: {progress.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {modelCheck.missing.some((m) => !pullProgress[m]?.pulling && !pullProgress[m]?.done) && (
                  <button
                    type="button"
                    onClick={() => modelCheck.missing.forEach((m) => { if (!pullProgress[m]?.pulling && !pullProgress[m]?.done) handlePullModel(m); })}
                    className="retro-raised bg-retro-panel text-retro-green px-4 py-1.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright mb-2"
                  >
                    [DOWNLOAD ALL]
                  </button>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => checkModels()}
                    className="retro-raised bg-retro-panel text-retro-text px-4 py-1.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright"
                  >
                    [RETRY]
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content — 3 columns */}
      {!modelCheck.checking && modelCheck.missing.length === 0 && !modelCheck.error && (
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel: Save + Job */}
        <div className="w-72 shrink-0 bg-retro-surface retro-raised flex flex-col overflow-y-auto">
          {/* Save resume */}
          <div className="p-3 border-b border-retro-border">
            <button
              type="button"
              onClick={handleSave}
              disabled={!latex.trim()}
              className="retro-raised bg-retro-panel text-retro-green px-3 py-1 text-sm w-full hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
            >
              {saved ? '[SAVED!]' : '[SAVE RESUME]'}
            </button>
          </div>

          {/* Job Input section */}
          <div className="p-3 flex-1">
            <JobInput
              jobPosting={jobPosting}
              onJobPostingChange={setJobPosting}
              onTailor={handleTailor}
              isTailoring={isTailoring}
              disabled={!latex.trim() || isReviewMode}
            />
          </div>
        </div>

        {/* Center panel: LaTeX Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor toolbar */}
          <div className="bg-retro-surface retro-raised px-3 py-1.5 flex items-center gap-2 shrink-0">
            <span className="text-retro-amber text-sm">
              {isReviewMode ? '[DIFF REVIEW]' : '[LATEX EDITOR]'}
            </span>
            <div className="flex-1" />

            <input
              type="file"
              accept=".pdf"
              onChange={handleUploadPDF}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting || isReviewMode}
              className="retro-raised bg-retro-panel text-retro-cyan px-2 py-0.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
            >
              {isExtracting ? '[EXTRACTING...]' : '[UPLOAD PDF]'}
            </button>

            <button
              type="button"
              onClick={handleCompile}
              disabled={isCompiling || !latex.trim() || isReviewMode}
              className="retro-raised bg-retro-panel text-retro-green px-2 py-0.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
            >
              {isCompiling ? '[COMPILING...]' : '[COMPILE]'}
            </button>

            {pdfUrl && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isReviewMode}
                className="retro-raised bg-retro-panel text-retro-amber px-2 py-0.5 text-sm hover:bg-retro-blue hover:text-retro-text-bright disabled:opacity-40"
              >
                [DOWNLOAD]
              </button>
            )}
          </div>

          {/* Status bar */}
          {(extractStatus || isTailoring || isReviewMode) && (
            <div className="bg-retro-bg px-3 py-1 text-sm shrink-0">
              {extractStatus && <span className="text-retro-cyan">{extractStatus}</span>}
              {isTailoring && <span className="text-retro-amber retro-blink">Tailoring resume for job posting...</span>}
              {isReviewMode && !isTailoring && (
                <span className="text-retro-cyan">Review changes below. [ACCEPT] to keep tailored version, [REJECT] to revert.</span>
              )}
            </div>
          )}

          {/* Editor or Diff Review */}
          <div className="flex-1 overflow-hidden">
            {isReviewMode && originalLatex !== null ? (
              <DiffViewer
                originalText={originalLatex}
                modifiedText={latex}
                onAccept={handleAcceptTailored}
                onReject={handleRejectTailored}
              />
            ) : (
              <LaTeXEditor
                value={latex}
                onChange={setLatex}
                readOnly={isExtracting || isTailoring}
              />
            )}
          </div>
        </div>

        {/* Right panel: PDF Preview */}
        <div className="w-[750px] shrink-0 flex flex-col">
          <div className="flex-1">
            <PDFPreview
              pdfUrl={pdfUrl}
              isCompiling={isCompiling}
              error={compileError}
            />
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
