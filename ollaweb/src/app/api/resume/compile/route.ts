import { writeFile, readFile, mkdir, rm, access } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

// Common MiKTeX install locations on Windows (user + system)
const MIKTEX_PATHS = [
  path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
  'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
  'C:\\Program Files (x86)\\MiKTeX\\miktex\\bin\\x64',
];

async function findPdflatex(): Promise<string> {
  // Try PATH first
  try {
    await execAsync(process.platform === 'win32' ? 'where pdflatex' : 'which pdflatex');
    return 'pdflatex'; // found on PATH
  } catch {}

  // On Windows, probe common MiKTeX install directories
  if (process.platform === 'win32') {
    for (const dir of MIKTEX_PATHS) {
      const candidate = path.join(dir, 'pdflatex.exe');
      try {
        await access(candidate); // check it exists
        return `"${candidate}"`;
      } catch {}
    }
  }

  throw new Error('pdflatex not found');
}

export async function POST(req: Request) {
  let tmpDir = '';

  try {
    const { latex } = await req.json();

    if (!latex) {
      return Response.json({ error: 'No LaTeX content provided' }, { status: 400 });
    }

    // Create temp directory
    tmpDir = path.join(os.tmpdir(), `ollaweb-latex-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    const texPath = path.join(tmpDir, 'resume.tex');
    const pdfPath = path.join(tmpDir, 'resume.pdf');

    await writeFile(texPath, latex, 'utf-8');

    // Find pdflatex binary
    let pdflatexCmd: string;
    try {
      pdflatexCmd = await findPdflatex();
    } catch {
      return Response.json(
        {
          error: 'pdflatex is not installed',
          action: 'Install a TeX distribution to enable PDF compilation. Use the [LIVE] preview mode instead — it works without any installation.',
        },
        { status: 500 }
      );
    }

    // Run pdflatex twice (for references/TOC)
    try {
      await execAsync(`${pdflatexCmd} -interaction=nonstopmode -output-directory="${tmpDir}" "${texPath}"`, {
        timeout: 30_000,
      });
      // Second pass for references
      await execAsync(`${pdflatexCmd} -interaction=nonstopmode -output-directory="${tmpDir}" "${texPath}"`, {
        timeout: 30_000,
      });
    } catch (error: any) {
      // pdflatex returns non-zero on warnings too, check if PDF was produced
      try {
        await readFile(pdfPath);
      } catch {
        // Read the log for error details
        try {
          const logPath = path.join(tmpDir, 'resume.log');
          const logContent = await readFile(logPath, 'utf-8');
          // Extract the actual error lines
          const errorLines = logContent
            .split('\n')
            .filter(l => l.startsWith('!') || l.includes('Error'))
            .slice(0, 5)
            .join('\n');
          return Response.json(
            {
              error: 'LaTeX compilation failed',
              details: errorLines || 'Check your LaTeX syntax',
              action: 'Fix the LaTeX errors and try again',
            },
            { status: 400 }
          );
        } catch {
          return Response.json(
            {
              error: 'pdflatex failed unexpectedly',
              action: 'Check your TeX installation or use [LIVE] preview mode',
            },
            { status: 500 }
          );
        }
      }
    }

    // Read the generated PDF
    const pdfBuffer = await readFile(pdfPath);

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resume.pdf"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';

    if (msg.includes('ENOENT') || msg.includes('not recognized') || msg.includes('not found')) {
      return Response.json(
        {
          error: 'pdflatex is not installed',
          action: 'Install TeX Live or MiKTeX to enable PDF compilation',
        },
        { status: 500 }
      );
    }

    return Response.json({ error: msg }, { status: 500 });
  } finally {
    // Clean up temp directory
    if (tmpDir) {
      rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
