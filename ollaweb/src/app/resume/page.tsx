"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LaTeXEditor } from '../components/latex-editor';
import { PDFPreview } from '../components/pdf-preview';
import { JobInput } from '../components/job-input';
import { DiffViewer } from '../components/diff-viewer';
import { ResumeHistory } from '../components/resume-history';
import { AppNav } from '../components/app-nav';
import type { UserProfile, ResumeVersion } from '../../lib/resume-types';
import { listVersions, saveVersion, deleteVersion, generateVersionTitle } from '../../lib/resume-storage';
import { AlertCircle } from 'lucide-react';

const REQUIRED_MODELS = ['gemma4:e4b'];

function ResumePageContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const autoTailorEnabled = searchParams?.get('autoTailor') === '1';

  // Model check state
  const [modelCheck, setModelCheck] = useState<{
    checking: boolean;
    missing: string[];
    error: string | null;
  }>({ checking: true, missing: [], error: null });

  // Editor state
  const [latex, setLatex] = useState('');
  const model = 'gemma4:e4b';
  const [saved, setSaved] = useState(false);

  // Job tailoring
  const [jobPosting, setJobPosting] = useState('');
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [autoTailorStatus, setAutoTailorStatus] = useState('');
  const autoTailorFetchedRef = useRef(false);
  const autoTailorTriggeredRef = useRef(false);

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
          } catch { }
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
      .catch(() => { });
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

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('model', 'gemma4:e4b');

    try {
      const response = await fetch('/api/resume/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        setExtractStatus(`Error: ${err.error}`);
        return;
      }

      setExtractStatus('Converting to LaTeX...');

      const reader = response.body?.getReader();
      if (!reader) {
        setExtractStatus('Error: Failed to read extraction response stream');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullLatex = '';
      let streamError = '';
      let streamDone = false;

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
            }
            if (data.error) {
              streamError = data.error + (data.action ? ` - ${data.action}` : '');
            }
            if (data.done) {
              streamDone = true;
            }
          } catch { }
        }
      }
      // Flush remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.text) {
            fullLatex += data.text;
          }
          if (data.error) {
            streamError = data.error + (data.action ? ` - ${data.action}` : '');
          }
          if (data.done) {
            streamDone = true;
          }
        } catch { }
      }

      if (streamError) {
        setExtractStatus(`Error: ${streamError}`);
        return;
      }

      // Auto-compile after extraction
      if (fullLatex.trim()) {
        setLatex(fullLatex);
        setExtractStatus('');
        await compileLatex(fullLatex);
      } else {
        setExtractStatus(streamDone ? 'Error: No LaTeX content was returned' : 'Error: Extraction stream ended unexpectedly');
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
    setTailorError(null);
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
        setTailorError(err.error || 'Failed to start tailoring');
        setOriginalLatex(null);
        setIsTailoring(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setTailorError('Failed to read response stream');
        setOriginalLatex(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let newLatex = '';
      let streamError = '';

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
            }
            if (data.error) {
              streamError = data.error + (data.action ? ` — ${data.action}` : '');
            }
          } catch { }
        }
      }

      // Flush buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.text) {
            newLatex += data.text;
          }
          if (data.error) {
            streamError = data.error + (data.action ? ` — ${data.action}` : '');
          }
        } catch { }
      }

      if (streamError) {
        setTailorError(streamError);
        setOriginalLatex(null);
        return; // Don't compile or review if there was an error
      }

      // Enter diff review mode (or auto-accept if no changes)
      if (newLatex.trim()) {
        setLatex(newLatex);
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
      setTailorError(err instanceof Error ? err.message : 'Unknown tailoring error');
      setOriginalLatex(null);
    } finally {
      setIsTailoring(false);
    }
  }, [latex, jobPosting, model, compileLatex]);

  // Auto-tailor: fetch job posting from extension
  useEffect(() => {
    if (!autoTailorEnabled || autoTailorFetchedRef.current) return;
    autoTailorFetchedRef.current = true;
    setAutoTailorStatus('Fetching job posting from extension...');

    fetch('/api/extension/job?consume=1', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) {
            throw new Error('No job posting found from extension.');
          }
          const err = await r.json().catch(() => null);
          throw new Error(err?.error || 'Failed to read job posting.');
        }
        return r.json();
      })
      .then((data) => {
        if (data?.jobPosting) {
          setJobPosting(data.jobPosting);
          setAutoTailorStatus('Job posting loaded.');
        } else {
          setAutoTailorStatus('No job posting found from extension.');
        }
      })
      .catch((err) => {
        setAutoTailorStatus(
          `Extension handoff failed: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      });
  }, [autoTailorEnabled]);

  // Auto-tailor: trigger once when resume and job posting are ready
  useEffect(() => {
    if (!autoTailorEnabled) return;
    if (autoTailorTriggeredRef.current) return;
    if (!jobPosting.trim()) return;

    if (!latex.trim()) {
      setAutoTailorStatus('Resume is empty. Load or paste your resume, then click Tailor.');
      return;
    }

    autoTailorTriggeredRef.current = true;
    setAutoTailorStatus('Auto tailoring from extension...');

    // First compile the existing PDF, then start tailoring
    compileLatex(latex).then(() => {
      handleTailor();
    });
  }, [autoTailorEnabled, jobPosting, latex, handleTailor, compileLatex]);

  useEffect(() => {
    if (!isTailoring) return;
    if (autoTailorStatus) setAutoTailorStatus('');
  }, [isTailoring, autoTailorStatus]);



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
        /[Cc]ompany\s*[:ï¼š]\s*([A-Za-z0-9&. ]+?)(?:\s*[,.\n])/,
        /^([A-Z][A-Za-z0-9&. ]+?)(?:\s*[-â€“|])/m,
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
        /(?:title|role|position)\s*[:ï¼š]\s*([^\n,]+)/i,
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
    <div className="flex h-screen bg-[#0a0a0a] text-foreground font-sans selection:bg-white/10 overflow-hidden relative">
      {/* Sidebar - Tools & History */}
      <aside className="w-[320px] bg-[#171717] flex flex-col border-r border-[#333] z-20">
        <div className="p-4 border-b border-[#333] flex items-center gap-3">
          <Link href="/" className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-lg hover:scale-105 transition-transform shrink-0">V</Link>
          <AppNav current="resume" />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8">
          {/* Job Input Section */}
          <section className="flex flex-col gap-4">
            <JobInput
              jobPosting={jobPosting}
              onJobPostingChange={setJobPosting}
              onTailor={handleTailor}
              isTailoring={isTailoring}
              disabled={!latex.trim() || isReviewMode}
              tailorError={tailorError}
            />
          </section>

          <hr className="border-[#333]" />

          {/* History Section */}
          <section className="flex flex-col gap-4">
            <div className="px-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Version History</span>
            </div>
            <ResumeHistory
              versions={savedVersions}
              currentVersionId={currentVersionId}
              isOpen={true} // Always open in sidebar
              onToggle={() => { }}
              onSelect={handleSelectVersion}
              onDelete={handleDeleteVersion}
            />
          </section>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#333] bg-[#171717]/80 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleSave}
            disabled={!latex.trim()}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm ${saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-[#2f2f2f] text-white border border-[#444] hover:bg-[#3f3f3f]'
              }`}
          >
            {saved ? 'Changes Saved' : 'Save Resume'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative z-10">
        {/* Top Action Bar */}
        <header className="h-14 border-b border-[#333] flex items-center justify-between px-6 bg-[#0a0a0a]/50 backdrop-blur-md z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {isReviewMode ? 'Diff Review' : 'LaTeX Editor'}
            </h2>
            {autoTailorStatus && (
              <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                {autoTailorStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleUploadPDF}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting || isReviewMode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#333] hover:bg-[#212121] transition-colors disabled:opacity-30"
            >
              {isExtracting ? 'Extracting...' : 'Upload PDF'}
            </button>
            <button
              onClick={handleCompile}
              disabled={isCompiling || !latex.trim() || isReviewMode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-30 flex items-center gap-2 shadow-sm shadow-blue-900/20"
            >
              {isCompiling ? (
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : null}
              {isCompiling ? 'Compiling...' : 'Compile'}
            </button>
            {pdfUrl && (
              <button
                onClick={handleDownload}
                disabled={isReviewMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#333] hover:bg-[#212121] transition-colors disabled:opacity-30 text-orange-400"
              >
                Download PDF
              </button>
            )}
          </div>
        </header>

        {/* Editor / Preview Work Area */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Editor Side */}
          <div className="flex-1 flex flex-col min-w-0">
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

          {/* Preview Side */}
          <div className="w-[500px] xl:w-[650px] shrink-0 h-full">
            <PDFPreview
              pdfUrl={pdfUrl}
              isCompiling={isCompiling}
              error={compileError}
            />
          </div>
        </div>

        {/* Model Check Overlay */}
        {(modelCheck.checking || modelCheck.missing.length > 0 || modelCheck.error) && (
          <div className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-[#171717] border border-[#333] rounded-2xl shadow-2xl p-8 text-center space-y-6">
              {modelCheck.checking ? (
                <div className="space-y-4 py-8">
                  <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold">Checking requirements</h3>
                    <p className="text-sm text-muted-foreground mt-1">Establishing connection to local AI models...</p>
                  </div>
                </div>
              ) : modelCheck.error ? (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <AlertCircle size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 text-uppercase">Ollama Connection Failed</h3>
                    <p className="text-sm text-muted-foreground mt-2">{modelCheck.error}</p>
                    <div className="mt-6 p-3 bg-black/40 rounded-lg text-xs font-mono text-left border border-[#333]">
                      $ ollama serve
                    </div>
                  </div>
                  <button
                    onClick={() => checkModels()}
                    className="w-full bg-white text-black py-2.5 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Missing Required Models</h3>
                  <p className="text-sm text-muted-foreground">The following models are needed for resume analysis and tailoring:</p>

                  <div className="space-y-3 mt-4">
                    {modelCheck.missing.map((m) => {
                      const progress = pullProgress[m];
                      return (
                        <div key={m} className="bg-[#212121] border border-[#333] rounded-xl p-4 text-left">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{m}</span>
                            {!progress?.pulling && !progress?.done && (
                              <button
                                onClick={() => handlePullModel(m)}
                                className="text-xs text-blue-400 font-bold hover:underline"
                              >
                                Download
                              </button>
                            )}
                          </div>
                          {progress?.pulling && (
                            <div className="space-y-2">
                              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                              </div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{progress.status} — {progress.percent}%</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => modelCheck.missing.forEach((m) => { if (!pullProgress[m]?.pulling && !pullProgress[m]?.done) handlePullModel(m); })}
                    className="w-full bg-white text-black py-2.5 rounded-xl font-semibold hover:bg-neutral-200 transition-colors mt-4"
                  >
                    Download All
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ResumePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-foreground">Loading resume workspace...</div>}>
      <ResumePageContent />
    </Suspense>
  );
}
