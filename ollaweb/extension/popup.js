const OLLAWEB_URL = 'http://localhost:3000';
const POST_URL = `${OLLAWEB_URL}/api/extension/job`;
const OPEN_URL = `${OLLAWEB_URL}/resume?autoTailor=1`;

const statusEl = document.getElementById('status');
const button = document.getElementById('tailor');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#f87171' : '#7dd3fc';
}

function extractJobPosting() {
  const MIN_SELECTION_CHARS = 200;
  const MAX_POSTING_CHARS = 20000;
  const normalize = (text) => text.replace(/\s+/g, ' ').trim();

  const selection = window.getSelection ? window.getSelection().toString() : '';
  if (selection && selection.trim().length >= MIN_SELECTION_CHARS) {
    const text = normalize(selection).slice(0, MAX_POSTING_CHARS);
    return { text, title: document.title, url: location.href };
  }

  const selectors = [
    'main',
    'article',
    '#jobDescriptionText',
    '[data-test-id*="job"]',
    '[data-automation*="job"]',
    '.job-description',
    '.jobDescription',
    '.description',
    '[class*="jobDescription"]',
    '[id*="jobDescription"]',
    '[class*="job-description"]'
  ];

  const elements = [];
  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => elements.push(el));
  });

  if (!elements.length && document.body) {
    elements.push(document.body);
  }

  let bestText = '';
  elements.forEach((el) => {
    const text = normalize(el.innerText || '');
    if (text.length > bestText.length) bestText = text;
  });

  bestText = bestText.slice(0, MAX_POSTING_CHARS);
  return { text: bestText, title: document.title, url: location.href };
}

async function handleTailor() {
  button.disabled = true;
  setStatus('Reading page...');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || typeof tab.id !== 'number') {
      throw new Error('No active tab found.');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobPosting,
    });

    const result = results && results[0] ? results[0].result : null;
    const text = result && result.text ? result.text.trim() : '';

    if (!text || text.length < 200) {
      throw new Error('No job posting text found. Try selecting the description and retry.');
    }

    setStatus('Sending to Voltaire...');

    const payload = {
      jobPosting: text,
      sourceUrl: result.url || tab.url || '',
      title: result.title || tab.title || '',
    };

    const response = await fetch(POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = 'Failed to send job posting to Voltaire.';
      try {
        const err = await response.json();
        if (err && err.error) message = err.error;
      } catch {}
      throw new Error(message);
    }

    setStatus('Opening Voltaire...');
    await chrome.tabs.create({ url: OPEN_URL });
    setStatus('Done.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    setStatus(message, true);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener('click', handleTailor);
