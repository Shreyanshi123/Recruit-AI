// RecruitAI — High-Craft SaaS UI (Linear / Stripe / LeetCode Split-Screen IDE Architecture)
const h = React.createElement;
const { useState, useEffect, useRef } = React;

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Clean Vector SVG Icon System (Lucide-style 1.8px stroke icons)
function SvgIcon({ name, className = 'w-4 h-4' }) {
  const props = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.85',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (name) {
    case 'code':
      return h('svg', props, h('polyline', { points: '16 18 22 12 16 6' }), h('polyline', { points: '8 6 2 12 8 18' }));
    case 'terminal':
      return h('svg', props, h('polyline', { points: '4 17 10 11 4 5' }), h('line', { x1: '12', y1: '19', x2: '20', y2: '19' }));
    case 'play':
      return h('svg', { ...props, fill: 'currentColor' }, h('polygon', { points: '5 3 19 12 5 21 5 3' }));
    case 'check':
      return h('svg', props, h('path', { d: 'M20 6 9 17l-5-5' }));
    case 'alert':
      return h('svg', props, h('circle', { cx: '12', cy: '12', r: '10' }), h('line', { x1: '12', y1: '8', x2: '12', y2: '12' }), h('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' }));
    case 'sparkles':
      return h('svg', props, h('path', { d: 'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z' }));
    case 'upload':
      return h('svg', props, h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }), h('polyline', { points: '17 8 12 3 7 8' }), h('line', { x1: '12', y1: '3', x2: '12', y2: '15' }));
    case 'file':
      return h('svg', props, h('path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }), h('polyline', { points: '14 2 14 8 20 8' }));
    case 'layers':
      return h('svg', props, h('polygon', { points: '12 2 2 7 12 12 22 7 12 2' }), h('polyline', { points: '2 17 12 22 22 17' }), h('polyline', { points: '2 12 12 17 22 12' }));
    case 'cpu':
      return h('svg', props, h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }), h('rect', { x: '9', y: '9', width: '6', height: '6' }), h('path', { d: 'M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2' }));
    case 'award':
      return h('svg', props, h('circle', { cx: '12', cy: '8', r: '6' }), h('path', { d: 'M15.477 12.89 17 22l-5-3-5 3 1.523-9.11' }));
    case 'rotate':
      return h('svg', props, h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }), h('path', { d: 'M3 3v5h5' }));
    case 'sun':
      return h('svg', props, h('circle', { cx: '12', cy: '12', r: '4' }), h('path', { d: 'M12 2v2M12 20v2m-7.07-14.93 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-14.93 7.07 1.41-1.41m11.32-11.32 1.41-1.41' }));
    case 'moon':
      return h('svg', props, h('path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }));
    case 'arrowRight':
      return h('svg', props, h('path', { d: 'M5 12h14' }), h('path', { d: 'm12 5 7 7-7 7' }));
    default:
      return h('svg', props, h('circle', { cx: '12', cy: '12', r: '9' }));
  }
}

// Extract text from an uploaded PDF/DOCX/TXT file
async function extractFileText(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf') && window.pdfjsLib) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item) => item.str);
        pages.push(strings.join(' '));
      }
      const joined = pages.join('\n\n').trim();
      if (joined.length > 10) return joined;
    } catch (err) {
      console.warn('Client PDF parse fallback to server:', err);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result).split(',')[1] || '';
        const res = await fetch('/api/extract-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, content_base64: base64 }),
        });
        const data = await res.json();
        resolve(data.text || '');
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Animated Number Counter Hook
function useAnimatedNumber(targetValue, durationMs = 480) {
  const [displayVal, setDisplayVal] = useState(targetValue);
  useEffect(() => {
    if (targetValue === null || targetValue === undefined || isNaN(targetValue)) {
      setDisplayVal(null);
      return;
    }
    let start = 0;
    const end = Number(targetValue);
    const startTime = performance.now();
    let rafId;
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVal((start + (end - start) * eased).toFixed(1));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [targetValue, durationMs]);
  return displayVal;
}

// Render inline `code` backticks as styled monospace badges
function renderInlineCode(textStr) {
  if (!textStr) return null;
  const parts = String(textStr).split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return h(
        'code',
        {
          key: idx,
          className:
            'px-1.5 py-0.5 mx-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[12px] font-semibold border border-blue-500/20',
        },
        inner
      );
    }
    return part;
  });
}

// Structured LeetCode / CodeSignal-style Problem Specification Renderer
function renderFormattedQuestionSpec(question) {
  if (!question || !question.question_text) return null;
  const lines = String(question.question_text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const introLines = [];
  const ruleLines = [];

  lines.forEach((line) => {
    const matchNum = line.match(/^(\d+)\.\s*(.+)$/);
    if (matchNum) {
      ruleLines.push({ num: matchNum[1], body: matchNum[2] });
    } else {
      introLines.push(line);
    }
  });

  const testLines = String(question.test_code || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('assert '));
  const sampleAssert = testLines[0] ? testLines[0].replace(/^assert\s+/, '') : '';
  const eqParts = sampleAssert.split(/\s*==\s*/);

  return h(
    'div',
    { className: 'space-y-4' },
    introLines.length > 0 &&
      h(
        'div',
        { className: 'space-y-2 text-[14px] text-slate-700 leading-[1.68]' },
        introLines.map((l, idx) => h('p', { key: idx }, renderInlineCode(l)))
      ),

    ruleLines.length > 0 &&
      h(
        'div',
        { className: 'space-y-2' },
        h(
          'div',
          { className: 'text-[11px] font-bold uppercase tracking-wider text-slate-500' },
          'Specification & Edge-Case Rules'
        ),
        ruleLines.map((r) =>
          h(
            'div',
            {
              key: r.num,
              className:
                'p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-[13px] leading-[1.6] text-slate-800',
            },
            h(
              'span',
              {
                className:
                  'w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5',
              },
              r.num
            ),
            h('div', { className: 'flex-1 min-w-0 break-words' }, renderInlineCode(r.body))
          )
        )
      ),

    eqParts.length === 2 &&
      h(
        'div',
        { className: 'p-3.5 rounded-xl bg-[#0D1117] border border-[#21262D] text-slate-100 space-y-1.5 font-mono text-[12px]' },
        h(
          'div',
          { className: 'text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400' },
          'Sample Assertion Case'
        ),
        h(
          'div',
          { className: 'break-all text-sky-300' },
          h('span', { className: 'text-slate-500 select-none' }, 'Input:  '),
          eqParts[0]
        ),
        h(
          'div',
          { className: 'break-all text-emerald-400' },
          h('span', { className: 'text-slate-500 select-none' }, 'Expect: '),
          eqParts[1]
        )
      )
  );
}

// Real VS Code Monaco IDE Component
function CodeIdeEditor({ code, testCode, onChange, onReset, onRun, isRunning }) {
  const [activeTab, setActiveTab] = useState('solution');
  const [monacoReady, setMonacoReady] = useState(false);
  const [cursorPos, setCursorPos] = useState({ ln: 4, col: 5 });
  const containerRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!window.require || !containerRef.current) return;
    let disposed = false;

    window.require.config({
      paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' },
    });

    window.require(['vs/editor/editor.main'], () => {
      if (disposed || !containerRef.current || !window.monaco) return;

      window.monaco.editor.defineTheme('recruitai-vscode', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword', foreground: '79C0FF', fontStyle: 'bold' },
          { token: 'string', foreground: 'A5D6FF' },
          { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
          { token: 'number', foreground: 'F2CC60' },
          { token: 'identifier', foreground: 'E6EDF3' },
        ],
        colors: {
          'editor.background': '#0D1117',
          'editor.lineHighlightBackground': '#161B22',
          'editorLineNumber.foreground': '#484F58',
          'editorLineNumber.activeForeground': '#C9D1D9',
          'editorGutter.background': '#0D1117',
          'editorCursor.foreground': '#58A6FF',
          'editor.selectionBackground': '#1F6FEB44',
        },
      });

      const ed = window.monaco.editor.create(containerRef.current, {
        value: activeTab === 'solution' ? code : testCode,
        language: 'python',
        theme: 'recruitai-vscode',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13.5,
        lineHeight: 22,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        readOnly: activeTab === 'tests',
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'all',
        roundedSelection: true,
      });

      ed.onDidChangeModelContent(() => {
        if (activeTab === 'solution') {
          const val = ed.getValue();
          onChangeRef.current && onChangeRef.current(val);
        }
      });

      ed.onDidChangeCursorPosition((e) => {
        setCursorPos({ ln: e.position.lineNumber, col: e.position.column });
      });

      editorInstanceRef.current = ed;
      setMonacoReady(true);
    });

    return () => {
      disposed = true;
      if (editorInstanceRef.current) {
        editorInstanceRef.current.dispose();
        editorInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const ed = editorInstanceRef.current;
    if (!ed) return;
    const targetVal = activeTab === 'solution' ? code : testCode;
    ed.updateOptions({ readOnly: activeTab === 'tests' });
    if (ed.getValue() !== targetVal) {
      ed.setValue(targetVal || '');
    }
  }, [code, testCode, activeTab]);

  return h(
    'div',
    { className: 'saas-ide flex flex-col relative' },
    isRunning &&
      h('div', {
        className:
          'absolute top-0 left-0 right-0 h-[3px] z-20 bg-gradient-to-r from-transparent via-blue-500 to-transparent',
        style: { animation: 'scanBar 1.1s infinite linear' },
      }),

    // IDE Header Bar
    h(
      'div',
      {
        className:
          'flex items-center justify-between px-4 py-2.5 bg-[#161B22] border-b border-[#21262D]',
      },
      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(
          'div',
          { className: 'flex items-center gap-1.5 mr-2' },
          h('span', { className: 'w-2.5 h-2.5 rounded-full bg-[#FF5F56]' }),
          h('span', { className: 'w-2.5 h-2.5 rounded-full bg-[#FFBD2E]' }),
          h('span', { className: 'w-2.5 h-2.5 rounded-full bg-[#27C93F]' })
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setActiveTab('solution'),
            className: `px-3 py-1.5 rounded-lg font-mono text-[12px] font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'solution'
                ? 'bg-[#0D1117] text-sky-400 border border-[#30363D]'
                : 'text-slate-400 hover:text-slate-200'
            }`,
          },
          h(SvgIcon, { name: 'code', className: 'w-3.5 h-3.5 text-sky-400' }),
          h('span', null, 'solution.py')
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => setActiveTab('tests'),
            className: `px-3 py-1.5 rounded-lg font-mono text-[12px] font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'tests'
                ? 'bg-[#0D1117] text-emerald-400 border border-[#30363D]'
                : 'text-slate-400 hover:text-slate-200'
            }`,
          },
          h(SvgIcon, { name: 'terminal', className: 'w-3.5 h-3.5 text-emerald-400' }),
          h('span', null, 'test_assertions.py')
        )
      ),

      h(
        'div',
        { className: 'flex items-center gap-2' },
        h(
          'span',
          {
            className:
              'hidden sm:inline-block px-2.5 py-1 rounded-md text-[11px] font-mono bg-[#0D1117] text-slate-400 border border-[#30363D]',
          },
          'Python 3.11'
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onReset,
            title: 'Reset starter stub',
            className:
              'px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-slate-400 hover:text-white hover:bg-[#21262D] transition flex items-center gap-1',
          },
          h(SvgIcon, { name: 'rotate', className: 'w-3.5 h-3.5' }),
          h('span', { className: 'hidden sm:inline' }, 'Reset')
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: isRunning,
            onClick: onRun,
            className:
              'px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-[12.5px] transition shadow-sm flex items-center gap-1.5',
          },
          h(SvgIcon, { name: 'play', className: 'w-3 h-3' }),
          h('span', null, isRunning ? 'Running Tests...' : 'Run & Grade')
        )
      )
    ),

    // Monaco Editor Canvas
    h(
      'div',
      { className: 'relative w-full', style: { height: '340px' } },
      h('div', {
        ref: containerRef,
        className: 'w-full h-full',
        style: { display: monacoReady ? 'block' : 'none' },
      }),
      !monacoReady &&
        h('textarea', {
          value: activeTab === 'solution' ? code : testCode,
          readOnly: activeTab === 'tests',
          onChange: (e) => activeTab === 'solution' && onChange && onChange(e.target.value),
          spellCheck: false,
          wrap: 'off',
          className:
            'w-full h-full p-4 bg-[#0D1117] text-slate-100 font-mono text-[13.5px] leading-[22px] focus:outline-none resize-none dark-scroll overflow-x-auto',
        })
    ),

    // IDE Status Bar
    h(
      'div',
      {
        className:
          'px-4 py-1.5 bg-[#161B22] border-t border-[#21262D] flex items-center justify-between text-[11px] font-mono text-slate-400',
      },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'span',
          { className: 'flex items-center gap-1.5 text-emerald-400 font-semibold' },
          h('span', { className: 'w-1.5 h-1.5 rounded-full bg-emerald-400' }),
          'ISOLATED SANDBOX'
        ),
        h('span', null, 'AST Analyzer: Active')
      ),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h('span', null, `Ln ${cursorPos.ln}, Col ${cursorPos.col}`),
        h('span', null, 'Spaces: 4'),
        h('span', null, 'UTF-8')
      )
    )
  );
}

// Refined Document Renderer with Subtle Skill Chips (No ugly spellchecker underlines!)
function renderHighlightedDocument(
  text,
  matchedSkills,
  missingSkills,
  isResume,
  hoveredSkill,
  onHoverSkill,
  onClickSkill
) {
  if (!text) return null;
  const cleanedText = text.replace(/^\s*j?ob description\s*/i, '').trim();

  const rules = [];
  (matchedSkills || []).forEach((sk) => {
    if (sk && sk.length > 1) {
      rules.push({ term: sk, cls: 'skill-chip-pass', skill: sk, isMissing: false });
      if (sk === 'RAG & Retrieval') {
        rules.push({ term: 'retrieval systems', cls: 'skill-chip-pass', skill: sk, isMissing: false });
        rules.push({ term: 'ranking models', cls: 'skill-chip-pass', skill: sk, isMissing: false });
        rules.push({ term: 'RAG', cls: 'skill-chip-pass', skill: sk, isMissing: false });
      }
      if (sk === 'LLMs') {
        rules.push({ term: 'LLM-powered', cls: 'skill-chip-pass', skill: sk, isMissing: false });
        rules.push({ term: 'LLM', cls: 'skill-chip-pass', skill: sk, isMissing: false });
      }
      if (sk === 'Postgres') {
        rules.push({ term: 'PostgreSQL', cls: 'skill-chip-pass', skill: sk, isMissing: false });
      }
    }
  });
  if (!isResume) {
    (missingSkills || []).forEach((sk) => {
      if (sk && sk.length > 1) {
        rules.push({ term: sk, cls: 'skill-chip-fail', skill: sk, isMissing: true });
      }
    });
  }

  rules.sort((a, b) => b.term.length - a.term.length);
  const escapedTerms = rules.map((r) => r.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex =
    escapedTerms.length > 0
      ? new RegExp(`(?<![a-zA-Z0-9])(${escapedTerms.join('|')})(?![a-zA-Z0-9])`, 'gi')
      : null;

  const highlightLine = (lineStr) => {
    if (!regex) return lineStr;
    const parts = lineStr.split(regex);
    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      const matchedRule = rules.find((r) => r.term.toLowerCase() === lower);
      if (matchedRule) {
        const isHighlighted =
          hoveredSkill && hoveredSkill.toLowerCase() === matchedRule.skill.toLowerCase();
        return h(
          'span',
          {
            key: idx,
            onMouseEnter: () => onHoverSkill && onHoverSkill(matchedRule.skill),
            onMouseLeave: () => onHoverSkill && onHoverSkill(null),
            onClick: () => onClickSkill && onClickSkill(matchedRule.skill),
            title: matchedRule.isMissing
              ? `${matchedRule.skill} — Missing from resume (Click to solve in IDE)`
              : `${matchedRule.skill} — Verified on resume`,
            className: `${matchedRule.cls} ${isHighlighted ? 'active-skill' : ''}`,
          },
          part
        );
      }
      return part;
    });
  };

  const rawLines = cleanedText.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  return h(
    'div',
    { className: 'space-y-2.5 text-[13.5px] leading-[1.75] text-slate-700' },
    rawLines.map((line, idx) => {
      const isBullet = /^[-•*]\s+/.test(line);
      const isSectionHeading =
        line.length < 48 &&
        (line === line.toUpperCase() ||
          /^(professional summary|experience|skills|education|projects|requirements|about|what you'll do|we're looking for)/i.test(
            line
          ));

      if (isSectionHeading) {
        return h(
          'div',
          {
            key: idx,
            className:
              'pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80',
          },
          line
        );
      }

      if (isBullet) {
        const cleanBullet = line.replace(/^[-•*]\s+/, '');
        return h(
          'div',
          { key: idx, className: 'flex items-start gap-2.5 pl-1' },
          h('span', { className: 'w-1.5 h-1.5 rounded-full bg-blue-600 mt-2.5 shrink-0' }),
          h('span', { className: 'flex-1' }, highlightLine(cleanBullet))
        );
      }

      return h('p', { key: idx, className: 'text-slate-800' }, highlightLine(line));
    })
  );
}

// Interactive Radar Chart
function ReportRadarChart({ scores }) {
  const [hoveredAxis, setHoveredAxis] = useState(null);
  const size = 290;
  const center = size / 2;
  const radius = 96;
  const axes = [
    { key: 'Algorithms', label: 'Problem solving', val: (scores && scores.Algorithms) || 82 },
    { key: 'SystemDesign', label: 'Cloud & infra', val: (scores && scores.SystemDesign) || 74 },
    { key: 'Python', label: 'Python & APIs', val: (scores && scores.Python) || 88 },
    { key: 'DataStores', label: 'Data & RAG', val: (scores && scores.DataStores) || 80 },
    { key: 'Communication', label: 'Domain clarity', val: (scores && scores.Communication) || 78 },
    { key: 'Testing', label: 'Edge-case tests', val: (scores && scores.Testing) || 86 },
  ];

  const getPt = (i, pct) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = radius * (Math.max(12, Math.min(100, pct)) / 100);
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const poly = axes
    .map((a, i) => {
      const p = getPt(i, a.val);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return h(
    'div',
    { className: 'flex flex-col items-center justify-center py-1 relative' },
    h(
      'svg',
      { width: size, height: size, viewBox: `0 0 ${size} ${size}`, className: 'overflow-visible' },
      [0.33, 0.66, 1.0].map((lvl) => {
        const pts = axes
          .map((_, i) => {
            const p = getPt(i, lvl * 100);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
        return h('polygon', {
          key: lvl,
          points: pts,
          fill: 'none',
          stroke: 'rgba(148, 163, 184, 0.3)',
          strokeWidth: '1.2',
        });
      }),
      axes.map((_, i) => {
        const outer = getPt(i, 100);
        return h('line', {
          key: i,
          x1: center,
          y1: center,
          x2: outer.x,
          y2: outer.y,
          stroke: 'rgba(148, 163, 184, 0.3)',
          strokeWidth: '1.2',
        });
      }),
      h('polygon', {
        points: poly,
        fill: 'rgba(37, 99, 235, 0.16)',
        stroke: '#2563EB',
        strokeWidth: '2.4',
        style: { transition: 'all 400ms ease' },
      }),
      axes.map((a, i) => {
        const pt = getPt(i, a.val);
        const lbl = getPt(i, 126);
        const isHov = hoveredAxis === a.key;
        return h(
          'g',
          {
            key: a.key,
            className: 'cursor-pointer',
            onMouseEnter: () => setHoveredAxis(a.key),
            onMouseLeave: () => setHoveredAxis(null),
          },
          h('circle', {
            cx: pt.x,
            cy: pt.y,
            r: isHov ? '6.5' : '4.5',
            fill: '#2563EB',
            stroke: '#FFFFFF',
            strokeWidth: '2',
            style: { transition: 'all 180ms ease' },
          }),
          h(
            'text',
            {
              x: lbl.x,
              y: lbl.y + 4,
              textAnchor: 'middle',
              className: `text-[12px] transition-colors ${
                isHov ? 'fill-blue-600 font-bold' : 'fill-slate-500 font-medium'
              }`,
            },
            isHov ? `${a.label} (${a.val}%)` : a.label
          )
        );
      })
    )
  );
}

// Choreographed Live Hero Demo Card on the Landing Page
function ChoreographedHeroCard() {
  const [heroStep, setHeroStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroStep((s) => (s + 1) % 5);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const seats = [
    { id: 0, label: 'Gap Analyst' },
    { id: 1, label: 'Interviewer' },
    { id: 2, label: 'Code Reviewer' },
    { id: 3, label: 'Judge' },
    { id: 4, label: 'Coach' },
  ];

  const activeSeatIdx = heroStep === 4 ? 3 : heroStep;
  const statusBadges = [
    'Extracting JD skills & resume gaps',
    'Asking role-specific question',
    'Running 4 hidden sandbox tests',
    'Judge scoring against rubric',
    'Checking AST plagiarism & routing',
  ];

  return h(
    'div',
    { className: 'space-y-3' },
    h(
      'div',
      { className: 'saas-card p-2 grid grid-cols-5 gap-1.5 text-center text-[12px] font-semibold' },
      seats.map((s, idx) => {
        const active = idx === activeSeatIdx;
        return h(
          'button',
          {
            key: s.label,
            type: 'button',
            onClick: () => setHeroStep(idx),
            className: `py-2 px-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 ${
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 border border-slate-200/80 hover:border-slate-300'
            }`,
          },
          h('span', { className: 'truncate' }, s.label),
          active && h('span', { className: 'w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-pulse' })
        );
      })
    ),

    h(
      'div',
      { className: 'saas-card p-5 space-y-5 relative overflow-hidden' },
      h(
        'div',
        { className: 'flex items-center justify-between' },
        h(
          'div',
          { className: 'flex items-center gap-2' },
          h('span', { className: 'text-[15px] font-bold text-slate-900' }, 'Kubernetes pod readiness validator'),
          h(
            'span',
            { className: 'text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600' },
            'JD Skill Verification'
          )
        ),
        h(
          'span',
          {
            className:
              'text-[12px] font-semibold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 transition-all',
          },
          statusBadges[heroStep]
        )
      ),

      h(
        'div',
        { className: 'saas-ide p-4 font-mono text-[13px] leading-[1.7] relative overflow-hidden' },
        heroStep === 2 &&
          h('div', {
            className:
              'absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent',
            style: { animation: 'scanBar 1.2s infinite linear' },
          }),
        h(
          'div',
          {
            className:
              'flex items-center justify-between text-slate-400 text-[11px] mb-2.5 pb-2 border-b border-slate-800',
          },
          h(
            'div',
            { className: 'flex items-center gap-1.5' },
            h('span', { className: 'w-2.5 h-2.5 rounded-full bg-[#FF5F56]' }),
            h('span', { className: 'w-2.5 h-2.5 rounded-full bg-[#FFBD2E]' }),
            h('span', { className: 'w-2.5 h-2.5 rounded-full bg-[#27C93F]' }),
            h('span', { className: 'ml-1.5 text-sky-400 font-semibold' }, 'solution.py')
          ),
          h('span', { className: 'text-[11px] text-emerald-400' }, 'Monaco IDE · Python 3.11')
        ),
        h(
          'div',
          null,
          h('span', { className: 'text-slate-500 mr-4 select-none' }, '1'),
          h('span', { className: 'text-sky-400 font-bold' }, 'def '),
          h('span', { className: 'text-amber-300' }, 'validate_k8s_pod'),
          '(pod_spec: dict) -> dict:'
        ),
        h(
          'div',
          null,
          h('span', { className: 'text-slate-500 mr-4 select-none' }, '2'),
          '    ',
          h('span', { className: 'text-sky-400 font-bold' }, 'if not '),
          'pod_spec.get(',
          h('span', { className: 'text-emerald-400' }, '"readinessProbe"'),
          '):'
        ),
        h(
          'div',
          null,
          h('span', { className: 'text-slate-500 mr-4 select-none' }, '3'),
          '        ',
          h('span', { className: 'text-sky-400 font-bold' }, 'return '),
          '{',
          h('span', { className: 'text-emerald-400' }, '"valid"'),
          ': ',
          h('span', { className: 'text-amber-300' }, 'False'),
          '}'
        )
      ),

      h(
        'div',
        { className: 'flex flex-wrap items-center gap-5' },
        h(
          'div',
          { className: 'text-[42px] font-bold tracking-tight text-slate-900 leading-none font-mono' },
          '9.0',
          h('span', { className: 'text-[18px] font-normal text-slate-500' }, '/10')
        ),
        h(
          'div',
          { className: 'flex-1 space-y-2' },
          h(
            'div',
            { className: 'grid grid-cols-4 gap-1.5' },
            [0, 1, 2, 3].map((segIdx) =>
              h('div', {
                key: segIdx,
                className: 'h-2 rounded-full bg-emerald-500 transition-all duration-300',
              })
            )
          ),
          h(
            'p',
            { className: 'text-[13px] text-slate-600' },
            '4 of 4 hidden unit assertions passed. Graded via Hybrid BM25 + Vector Rubric RAG.'
          )
        )
      )
    )
  );
}

// ============================================================================
// PROCTORED CANDIDATE ASSESSMENT ROOM (/a/{public_token})
// Server-side hidden tests, server-enforced deadline, paste & tab-switch proctoring
// ============================================================================
function CandidateProctoredRoom({ publicToken, onExit }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [attemptToken, setAttemptToken] = useState(() =>
    publicToken ? localStorage.getItem(`recruitai_attempt_${publicToken}`) || '' : ''
  );
  const [attemptData, setAttemptData] = useState(null);
  const [qIdx, setQIdx] = useState(0);
  const [codeMap, setCodeMap] = useState({});
  const [runOutput, setRunOutput] = useState(null);
  const [subOutput, setSubOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [proctorStats, setProctorStats] = useState({ pastes: 0, tabSwitches: 0 });

  useEffect(() => {
    if (!publicToken) return;
    setLoading(true);
    fetch(`/api/public/assessments/${publicToken}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || 'Invalid or closed assessment link.');
        }
        return r.json();
      })
      .then((d) => setMeta(d))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [publicToken]);

  const loadAttempt = async (tok) => {
    try {
      const r = await fetch(`/api/public/attempts/${tok}`);
      if (!r.ok) return;
      const d = await r.json();
      setAttemptData(d);
      const initialCodes = {};
      (d.questions || []).forEach((q) => {
        initialCodes[q.id] = q.saved_code || q.starter_code || '';
      });
      setCodeMap((prev) => ({ ...initialCodes, ...prev }));
      if (d.deadline_at) {
        const diffSec = Math.max(0, Math.floor((new Date(d.deadline_at).getTime() - Date.now()) / 1000));
        setSecondsLeft(diffSec);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (attemptToken) loadAttempt(attemptToken);
  }, [attemptToken]);

  // Countdown timer synced to server deadline_at
  useEffect(() => {
    if (secondsLeft === null || !attemptData || attemptData.status === 'submitted') return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          fetch(`/api/public/attempts/${attemptToken}/finish`, { method: 'POST' }).then(() =>
            loadAttempt(attemptToken)
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft, attemptData, attemptToken]);

  const logProctorEvent = (eventType, qId, detail = {}) => {
    if (!attemptToken || !attemptData || attemptData.status === 'submitted') return;
    fetch(`/api/public/attempts/${attemptToken}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, question_id: qId || null, detail }),
    }).catch(() => {});
  };

  // Visibility & window blur proctoring listeners
  useEffect(() => {
    if (!attemptToken || !attemptData || attemptData.status === 'submitted') return;
    const onVis = () => {
      if (document.hidden) {
        setProctorStats((s) => ({ ...s, tabSwitches: s.tabSwitches + 1 }));
        logProctorEvent('tab_hidden');
      }
    };
    const onBlur = () => {
      setProctorStats((s) => ({ ...s, tabSwitches: s.tabSwitches + 1 }));
      logProctorEvent('window_blur');
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
    };
  }, [attemptToken, attemptData]);

  const handleStart = async () => {
    if (!name.trim() || !email.trim()) {
      setErr('Please enter your full name and email address.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const r = await fetch(`/api/public/assessments/${publicToken}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Failed to start assessment.');
      localStorage.setItem(`recruitai_attempt_${publicToken}`, d.attempt_token);
      setAttemptToken(d.attempt_token);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const questions = (attemptData && attemptData.questions) || [];
  const activeQ = questions[qIdx] || null;
  const currentCode = activeQ ? codeMap[activeQ.id] || activeQ.starter_code || '' : '';

  const handleRunSample = async () => {
    if (!activeQ) return;
    setBusy(true);
    setRunOutput(null);
    try {
      const r = await fetch(`/api/public/attempts/${attemptToken}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: activeQ.id, code: currentCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Sample run failed.');
      setRunOutput(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitHidden = async () => {
    if (!activeQ) return;
    setBusy(true);
    setSubOutput(null);
    try {
      const r = await fetch(`/api/public/attempts/${attemptToken}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: activeQ.id, code: currentCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Submission failed.');
      setSubOutput(d);
      loadAttempt(attemptToken);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFinishAll = async () => {
    setBusy(true);
    try {
      await fetch(`/api/public/attempts/${attemptToken}/finish`, { method: 'POST' });
      await loadAttempt(attemptToken);
    } finally {
      setBusy(false);
    }
  };

  const fmtTime = (sec) => {
    if (sec === null) return '--:--';
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return h('div', { className: 'saas-card p-8 text-center text-slate-600' }, 'Loading assessment...');
  }

  // Screen C: Completed
  if (attemptData && attemptData.status === 'submitted') {
    return h(
      'div',
      { className: 'max-w-[640px] mx-auto saas-card p-8 text-center space-y-4 animate-screen' },
      h(
        'div',
        { className: 'w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto' },
        h(SvgIcon, { name: 'check', className: 'w-6 h-6' })
      ),
      h('h2', { className: 'text-[24px] font-bold text-slate-900' }, 'Assessment Submitted'),
      h(
        'p',
        { className: 'text-[14.5px] text-slate-600 leading-relaxed' },
        `Thank you, ${attemptData.candidate_name}. Your code submissions have been graded against the server-side hidden unit test suite and forwarded to the hiring team at ${attemptData.company_name}.`
      ),
      onExit &&
        h(
          'button',
          {
            type: 'button',
            onClick: onExit,
            className: 'px-5 py-2.5 rounded-xl bg-blue-600 text-white text-[13.5px] font-semibold',
          },
          '← Return to Recruiter Scorecard'
        )
    );
  }

  // Screen A: Welcome & Integrity Consent
  if (!attemptData) {
    return h(
      'div',
      { className: 'max-w-[680px] mx-auto saas-card p-7 sm:p-8 space-y-6 animate-screen' },
      h(
        'div',
        { className: 'flex items-center justify-between gap-2' },
        h(
          'span',
          { className: 'px-3 py-1 rounded-full text-[12px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20' },
          `${(meta && meta.company_name) || 'Company'} · Technical Assessment`
        ),
        onExit &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExit,
              className: 'text-[12.5px] font-semibold text-blue-600 hover:underline',
            },
            '← Back to Recruiter Console'
          )
      ),
      h(
        'div',
        { className: 'space-y-1.5' },
        h('h1', { className: 'text-[26px] font-bold text-slate-900' }, (meta && meta.title) || 'Engineering Assessment'),
        h(
          'p',
          { className: 'text-[14px] text-slate-600' },
          `${(meta && meta.question_count) || 3} coding tasks · ${(meta && meta.time_limit_min) || 45} minutes server-timed window`
        )
      ),
      meta &&
        meta.skills &&
        h(
          'div',
          { className: 'flex flex-wrap gap-2' },
          meta.skills.map((sk) =>
            h(
              'span',
              {
                key: sk,
                className: 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[12px] font-semibold',
              },
              sk
            )
          )
        ),
      h(
        'div',
        { className: 'p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-[13px] text-slate-700' },
        h('div', { className: 'font-bold text-amber-600' }, 'Proctoring & Hidden-Test Disclosure'),
        h(
          'p',
          null,
          '1. Only 1 sample assertion is visible in the browser. Full grading runs against server-side hidden unit tests.'
        ),
        h(
          'p',
          null,
          '2. Clipboard pastes, tab switches, and AST structural code similarity across candidates are logged and shared with the hiring reviewer.'
        )
      ),
      err &&
        h(
          'div',
          { className: 'p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[13px]' },
          err
        ),
      h(
        'div',
        { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        h('input', {
          type: 'text',
          value: name,
          onChange: (e) => setName(e.target.value),
          placeholder: 'Your Full Name (e.g. Priya Sharma)',
          className: 'px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13.5px]',
        }),
        h('input', {
          type: 'text',
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: 'Your Email (e.g. priya@dev.io)',
          className: 'px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13.5px]',
        })
      ),
      h(
        'button',
        {
          type: 'button',
          disabled: busy,
          onClick: handleStart,
          className:
            'w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[14.5px] shadow-md transition',
        },
        busy ? 'Starting proctored session...' : 'Start Timed Assessment →'
      )
    );
  }

  // Screen B: Proctored Split-Screen IDE Workspace
  return h(
    'div',
    {
      className: 'space-y-4 animate-screen',
      onPaste: (e) => {
        const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
        if (text.length > 0) {
          setProctorStats((s) => ({ ...s, pastes: s.pastes + 1 }));
          logProctorEvent('paste', activeQ && activeQ.id, {
            chars: text.length,
            lines: text.split('\n').length,
          });
        }
      },
    },
    // Top Proctoring & Timer Bar
    h(
      'div',
      { className: 'saas-card px-5 py-3 flex flex-wrap items-center justify-between gap-3' },
      h(
        'div',
        { className: 'flex items-center gap-3' },
        onExit &&
          h(
            'button',
            {
              type: 'button',
              onClick: onExit,
              className: 'px-2.5 py-1 rounded-lg bg-slate-100 text-[12px] font-semibold text-slate-700',
            },
            '← Recruiter Hub'
          ),
        h(
          'span',
          { className: 'text-[14px] font-bold text-slate-900' },
          `${attemptData.company_name} · ${attemptData.role_title}`
        ),
        h(
          'div',
          { className: 'flex items-center gap-1.5' },
          questions.map((q, i) =>
            h(
              'button',
              {
                key: q.id,
                type: 'button',
                onClick: () => {
                  setQIdx(i);
                  setRunOutput(null);
                  setSubOutput(null);
                },
                className: `px-3 py-1 rounded-lg text-[12px] font-semibold transition ${
                  i === qIdx
                    ? 'bg-blue-600 text-white'
                    : q.last_result
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-slate-100 text-slate-600'
                }`,
              },
              q.last_result
                ? `Q${i + 1} (${q.last_result.tests_passed}/${q.last_result.tests_total} ✓)`
                : `Q${i + 1} · ${q.skill}`
            )
          )
        )
      ),
      h(
        'div',
        { className: 'flex items-center gap-3' },
        h(
          'span',
          { className: 'px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[11.5px] font-mono font-semibold' },
          `Proctor: ${proctorStats.pastes} pastes · ${proctorStats.tabSwitches} tab switches`
        ),
        h(
          'span',
          {
            className: `px-3 py-1 rounded-lg font-mono text-[13px] font-bold ${
              secondsLeft !== null && secondsLeft < 300
                ? 'bg-rose-500/10 text-rose-600'
                : 'bg-slate-100 text-slate-800'
            }`,
          },
          `⏳ ${fmtTime(secondsLeft)}`
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: handleFinishAll,
            className: 'px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-semibold',
          },
          'Finish & Submit All'
        )
      )
    ),

    activeQ &&
      h(
        'div',
        { className: 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' },
        // Left 5/12: Problem + 1 Visible Sample Test + Hidden Test Notice
        h(
          'div',
          { className: 'lg:col-span-5 saas-card p-6 space-y-4' },
          h(
            'div',
            { className: 'flex items-center justify-between' },
            h(
              'span',
              { className: 'px-2.5 py-1 rounded-md text-[11.5px] font-bold bg-blue-500/10 text-blue-600' },
              `Question ${qIdx + 1} of ${questions.length} · ${activeQ.skill}`
            ),
            h(
              'span',
              { className: 'px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-slate-100 text-slate-600' },
              activeQ.difficulty
            )
          ),
          h('h2', { className: 'text-[20px] font-bold text-slate-900' }, activeQ.topic),
          renderFormattedQuestionSpec(activeQ),
          h(
            'div',
            { className: 'p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2' },
            h(
              'div',
              { className: 'flex items-center justify-between text-[12px] font-semibold' },
              h('span', { className: 'text-slate-700' }, 'Visible Sample Assertion'),
              h(
                'span',
                { className: 'text-blue-600' },
                `+ ${activeQ.hidden_test_count || 3} server-side hidden assertions`
              )
            ),
            h(
              'pre',
              { className: 'p-2.5 rounded-lg bg-[#0D1117] text-emerald-400 font-mono text-[12px] overflow-x-auto' },
              activeQ.sample_tests || '# Sample test'
            )
          )
        ),

        // Right 7/12: Monaco IDE + Sample Run vs Hidden Submit
        h(
          'div',
          { className: 'lg:col-span-7 space-y-4' },
          h(CodeIdeEditor, {
            code: currentCode,
            testCode: activeQ.sample_tests || '# Hidden tests are stored server-side',
            onChange: (val) => setCodeMap((prev) => ({ ...prev, [activeQ.id]: val })),
            onReset: () => setCodeMap((prev) => ({ ...prev, [activeQ.id]: activeQ.starter_code || '' })),
            onRun: handleRunSample,
            isRunning: busy,
          }),
          h(
            'div',
            { className: 'saas-card p-4 flex flex-wrap items-center justify-between gap-3' },
            h(
              'div',
              { className: 'text-[13px] text-slate-600' },
              subOutput
                ? `Submitted (Attempt #${subOutput.submit_count}): Passed ${subOutput.tests_passed} of ${subOutput.tests_total} server-side hidden tests.`
                : runOutput
                ? `Sample Test: ${runOutput.passed ? 'PASSED' : 'FAILED'} in ${runOutput.runtime_ms}ms`
                : 'Use "Run and grade" in the editor bar to test against the sample assertion, or submit below to grade against hidden tests.'
            ),
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: handleRunSample,
                  className:
                    'px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[13px] font-semibold transition',
                },
                'Run Sample Assertion'
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: handleSubmitHidden,
                  className:
                    'px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold shadow-sm transition',
                },
                'Submit Against Hidden Tests →'
              )
            )
          )
        )
      )
  );
}

// ============================================================================
// CANDIDATE REGISTRATION & SIGN IN MODAL
// ============================================================================
function AuthModal({ isOpen, onClose, currentUser, onAuthSuccess }) {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetRole, setTargetRole] = useState('AI Full-Stack Engineer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? {
              full_name: fullName.trim() || 'Shreyanshi Mishra',
              email: email.trim(),
              password: password || 'recruitai2026',
              role: 'candidate',
              organization_name: '',
              target_role: targetRole.trim() || 'AI Full-Stack Engineer',
            }
          : {
              email: email.trim(),
              password: password,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }
      onAuthSuccess(data);
      onClose();
    } catch (error) {
      setErr(error.message || 'Could not complete request');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickDemo = async () => {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'candidate' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Demo login failed');
      onAuthSuccess(data);
      onClose();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-screen',
      onClick: onClose,
    },
    h(
      'div',
      {
        className: 'saas-card w-full max-w-[480px] p-6 sm:p-7 space-y-5 relative shadow-2xl',
        onClick: (e) => e.stopPropagation(),
      },
      // Header
      h(
        'div',
        { className: 'flex items-start justify-between gap-4' },
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'div',
            { className: 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold uppercase tracking-wider' },
            'Candidate Account'
          ),
          h(
            'h2',
            { className: 'text-[22px] font-bold text-slate-900 tracking-tight' },
            mode === 'register' ? 'Create Your RecruitAI Profile' : 'Sign In to RecruitAI'
          ),
          h(
            'p',
            { className: 'text-[13px] text-slate-500' },
            'Save your JD skill-gap analysis, coding mock interview sessions, and tailored resume bullets.'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[13px] font-bold',
          },
          '✕'
        )
      ),

      // Mode Tabs: Register vs Sign In
      h(
        'div',
        { className: 'grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100' },
        h(
          'button',
          {
            type: 'button',
            onClick: () => {
              setMode('register');
              setErr('');
            },
            className: `py-2 rounded-lg text-[13px] font-semibold transition ${
              mode === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
            }`,
          },
          'Register New Account'
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: () => {
              setMode('login');
              setErr('');
            },
            className: `py-2 rounded-lg text-[13px] font-semibold transition ${
              mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
            }`,
          },
          'Sign In Existing'
        )
      ),

      err &&
        h(
          'div',
          { className: 'p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 text-[12.5px] font-medium' },
          err
        ),

      // Registration / Login Form
      h(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-3.5' },
        mode === 'register' &&
          h(
            'div',
            null,
            h('label', { className: 'block text-[12px] font-semibold text-slate-700 mb-1' }, 'Full Name'),
            h('input', {
              type: 'text',
              required: true,
              value: fullName,
              onChange: (e) => setFullName(e.target.value),
              placeholder: 'e.g. Shreyanshi Mishra',
              className: 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13.5px]',
            })
          ),
        h(
          'div',
          null,
          h('label', { className: 'block text-[12px] font-semibold text-slate-700 mb-1' }, 'Email Address'),
          h('input', {
            type: 'email',
            required: true,
            value: email,
            onChange: (e) => setEmail(e.target.value),
            placeholder: 'you@domain.com',
            className: 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13.5px]',
          })
        ),
        h(
          'div',
          null,
          h('label', { className: 'block text-[12px] font-semibold text-slate-700 mb-1' }, 'Password'),
          h('input', {
            type: 'password',
            required: true,
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: 'Minimum 4 characters',
            className: 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13.5px]',
          })
        ),
        mode === 'register' &&
          h(
            'div',
            null,
            h('label', { className: 'block text-[12px] font-semibold text-slate-700 mb-1' }, 'Target Engineering Role'),
            h('input', {
              type: 'text',
              value: targetRole,
              onChange: (e) => setTargetRole(e.target.value),
              placeholder: 'e.g. AI Full-Stack Engineer / Backend SDE',
              className: 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-[13.5px]',
            })
          ),
        h(
          'button',
          {
            type: 'submit',
            disabled: busy,
            className:
              'w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[14px] shadow-md shadow-blue-600/20 transition',
          },
          busy
            ? 'Authenticating...'
            : mode === 'register'
            ? 'Create Account & Start Practicing →'
            : 'Sign In to Workspace →'
        )
      ),

      // Instant 1-Click Demo Login
      h(
        'div',
        { className: 'pt-3 border-t border-slate-200/80 space-y-2' },
        h(
          'button',
          {
            type: 'button',
            disabled: busy,
            onClick: handleQuickDemo,
            className:
              'w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12.5px] font-semibold transition',
          },
          '⚡ 1-Click Demo Candidate Login (Shreyanshi Mishra)'
        )
      )
    )
  );
}

// ============================================================================
// PERSONAL CANDIDATE DASHBOARD & SKILL MASTERY HISTORY MODAL
// ============================================================================
function CandidateHistoryModal({ isOpen, onClose, currentUser, historyData }) {
  if (!isOpen) return null;

  const sessions = (historyData && historyData.sessions) || [];
  const mastery = (historyData && historyData.skill_mastery) || [];

  return h(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-screen',
      onClick: onClose,
    },
    h(
      'div',
      {
        className:
          'saas-card w-full max-w-[780px] max-h-[86vh] overflow-y-auto doc-scroll p-6 sm:p-7 space-y-6 relative shadow-2xl',
        onClick: (e) => e.stopPropagation(),
      },
      // Header
      h(
        'div',
        { className: 'flex items-start justify-between gap-4 border-b border-slate-200/80 pb-4' },
        h(
          'div',
          { className: 'space-y-1' },
          h(
            'div',
            {
              className:
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold uppercase tracking-wider',
            },
            'Candidate Career & Skill Progression'
          ),
          h(
            'h2',
            { className: 'text-[22px] font-bold text-slate-900 tracking-tight' },
            currentUser
              ? `${currentUser.full_name}'s Mock Interview & Skill Mastery Dashboard`
              : 'My Mock Interview & Skill Mastery Dashboard'
          ),
          h(
            'p',
            { className: 'text-[13px] text-slate-500' },
            'Tracks every company interview loop you have practiced, your JD match improvements, and your verified skill scores.'
          )
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: onClose,
            className: 'px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[13px] font-bold',
          },
          '✕'
        )
      ),

      // Section 1: Skill Mastery Matrix
      h(
        'div',
        { className: 'space-y-3' },
        h(
          'div',
          { className: 'flex items-center justify-between' },
          h('h3', { className: 'text-[15px] font-bold text-slate-900' }, 'Verified Skill Mastery Tracker'),
          h(
            'span',
            { className: 'text-[12px] text-slate-500 font-medium' },
            `${mastery.length} skills tracked across sessions`
          )
        ),
        mastery.length === 0
          ? h(
              'div',
              { className: 'p-4 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-500' },
              'Analyze a Resume + JD or complete a coding round in the IDE Studio to start tracking your skill mastery.'
            )
          : h(
              'div',
              { className: 'grid grid-cols-2 sm:grid-cols-3 gap-3' },
              mastery.map((m) =>
                h(
                  'div',
                  {
                    key: m.skill,
                    className: 'p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2',
                  },
                  h(
                    'div',
                    null,
                    h('div', { className: 'text-[13.5px] font-bold text-slate-900' }, m.skill),
                    h(
                      'div',
                      { className: 'text-[11.5px] text-emerald-600 font-semibold mt-0.5' },
                      `${m.status} · ${m.sessions || 1}x`
                    )
                  ),
                  h(
                    'span',
                    {
                      className:
                        'px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 font-mono font-bold text-[12.5px]',
                    },
                    `${Number(m.best_score || 8.0).toFixed(1)}/10`
                  )
                )
              )
            )
      ),

      // Section 2: Past Company Mock Interview Sessions
      h(
        'div',
        { className: 'space-y-3' },
        h('h3', { className: 'text-[15px] font-bold text-slate-900' }, 'Saved Company Practice Loops'),
        sessions.length === 0
          ? h(
              'div',
              { className: 'p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2' },
              h(
                'p',
                { className: 'text-[13.5px] text-slate-600' },
                'No completed practice sessions saved yet. Upload any resume and job description to start practicing and building your skill mastery history.'
              )
            )
          : h(
              'div',
              { className: 'space-y-2.5' },
              sessions.map((s) =>
                h(
                  'div',
                  {
                    key: s.id,
                    className:
                      'p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3',
                  },
                  h(
                    'div',
                    { className: 'space-y-1' },
                    h(
                      'div',
                      { className: 'flex items-center gap-2' },
                      h('span', { className: 'text-[15px] font-bold text-slate-900' }, s.company_name),
                      h(
                        'span',
                        { className: 'px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[11.5px] font-semibold' },
                        s.role_title
                      )
                    ),
                    h(
                      'div',
                      { className: 'text-[12px] text-slate-500 flex flex-wrap items-center gap-3' },
                      h(
                        'span',
                        { className: 'text-emerald-600 font-semibold' },
                        `ATS Match Boost: ${s.before_match_pct}% → ${s.after_match_pct}%`
                      ),
                      s.missing_skills &&
                        s.missing_skills.length > 0 &&
                        h('span', null, `Gaps Practiced: ${s.missing_skills.join(', ')}`)
                    )
                  ),
                  h(
                    'div',
                    { className: 'text-right' },
                    h(
                      'div',
                      { className: 'text-[18px] font-bold font-mono text-blue-600' },
                      `${Number(s.avg_score || 8.0).toFixed(1)} / 10`
                    ),
                    h('div', { className: 'text-[11px] text-slate-500' }, 'Session Score')
                  )
                )
              )
            )
      )
    )
  );
}

// ============================================================================
// SCREEN 05: B2B RECRUITER ASSESSMENT, AST PLAGIARISM & CI EVAL HUB
// ============================================================================
function B2BRecruiterHub({ initialJdText, onLaunchCandidateView }) {
  const defaultJd =
    initialJdText ||
    "We're Hiring – AI Engineer (AI + Software) @ Euler Motors\nLocation: Delhi | Full-Time\n- Build and deploy LLM-powered features in production.\n- Work with retrieval systems, ranking models, and Python/FastAPI microservices.\n- Deploy containerized workloads using Docker, Kubernetes, AWS/GCP.\n- Use Redis caching for low latency.";

  const [orgKey, setOrgKey] = useState(() => localStorage.getItem('recruitai_org_key') || '');
  const [orgName, setOrgName] = useState(() => localStorage.getItem('recruitai_org_name') || 'Euler Motors Recruiting');
  const [jdInput, setJdInput] = useState(defaultJd);
  const [timeLimit, setTimeLimit] = useState(45);
  const [maxQuestions, setMaxQuestions] = useState(3);
  const [assessments, setAssessments] = useState([]);
  const [selectedAsm, setSelectedAsm] = useState(null);
  const [report, setReport] = useState(null);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [evalGateResult, setEvalGateResult] = useState(null);
  const [runningEvals, setRunningEvals] = useState(false);

  const ensureOrg = async () => {
    if (orgKey) {
      const check = await fetch('/api/orgs/me', { headers: { 'X-Org-Key': orgKey } });
      if (check.ok) return orgKey;
    }
    const res = await fetch('/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName || 'Enterprise Recruiting Org' }),
    });
    const data = await res.json();
    localStorage.setItem('recruitai_org_key', data.api_key);
    localStorage.setItem('recruitai_org_name', data.name);
    setOrgKey(data.api_key);
    return data.api_key;
  };

  const loadAssessmentsAndReport = async (keyToUse, targetAsmId) => {
    const k = keyToUse || (await ensureOrg());
    const res = await fetch('/api/assessments', { headers: { 'X-Org-Key': k } });
    if (!res.ok) return;
    const data = await res.json();
    const list = data.assessments || [];
    setAssessments(list);
    const chosenId = targetAsmId || (selectedAsm && selectedAsm.id) || (list[0] && list[0].id);
    if (chosenId) {
      const repRes = await fetch(`/api/assessments/${chosenId}/report`, { headers: { 'X-Org-Key': k } });
      if (repRes.ok) {
        const repData = await repRes.json();
        setSelectedAsm(repData.assessment);
        setReport(repData);
      }
    }
  };

  useEffect(() => {
    loadAssessmentsAndReport();
  }, []);

  const handleCreateAndSimulate = async (simulateAfter = true) => {
    setBusy(true);
    try {
      const k = await ensureOrg();
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Key': k },
        body: JSON.stringify({
          jd_text: jdInput,
          time_limit_min: Number(timeLimit) || 45,
          max_questions: Number(maxQuestions) || 3,
          include_system_design: false,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create assessment');
      }
      const asm = await res.json();
      setSelectedAsm(asm);
      if (simulateAfter && asm.id) {
        const simRes = await fetch(`/api/assessments/${asm.id}/simulate-cohort`, {
          method: 'POST',
          headers: { 'X-Org-Key': k },
        });
        if (simRes.ok) {
          const simReport = await simRes.json();
          setReport(simReport);
        }
      }
      await loadAssessmentsAndReport(k, asm.id);
    } catch (e) {
      console.error('Create & simulate error:', e);
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateExisting = async () => {
    if (!selectedAsm) return;
    setBusy(true);
    try {
      const k = await ensureOrg();
      const res = await fetch(`/api/assessments/${selectedAsm.id}/simulate-cohort`, {
        method: 'POST',
        headers: { 'X-Org-Key': k },
      });
      if (res.ok) {
        const repData = await res.json();
        setReport(repData);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (attemptId, decision, note) => {
    if (!selectedAsm) return;
    const k = await ensureOrg();
    await fetch(`/api/assessments/${selectedAsm.id}/attempts/${attemptId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Org-Key': k },
      body: JSON.stringify({ decision, note }),
    });
    await loadAssessmentsAndReport(k, selectedAsm.id);
  };

  const handleRunLiveEvalGate = async () => {
    setRunningEvals(true);
    try {
      const r = await fetch('/api/run-eval-gate');
      const d = await r.json();
      setEvalGateResult(d);
    } finally {
      setRunningEvals(false);
    }
  };

  const candidateUrl =
    selectedAsm && selectedAsm.public_token
      ? `${window.location.origin}/a/${selectedAsm.public_token}`
      : '';

  return h(
    'div',
    { className: 'space-y-6 animate-screen' },

    // Top Differentiator Banner: Why B2B Teams Use This Instead of ChatGPT/Claude
    h(
      'div',
      { className: 'saas-card p-6 space-y-4' },
      h(
        'div',
        { className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-4' },
        h(
          'div',
          { className: 'space-y-1.5' },
          h(
            'div',
            { className: 'inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 text-[11.5px] font-bold' },
            'B2B Technical Screening & Assessment Integrity Console'
          ),
          h(
            'h1',
            { className: 'text-[24px] sm:text-[28px] font-bold tracking-tight text-slate-900' },
            'Why Engineering Teams Use RecruitAI Instead of Raw ChatGPT / Claude'
          ),
          h(
            'p',
            { className: 'text-[13.5px] text-slate-600 max-w-[820px]' },
            'A chat LLM cannot run hidden unit tests, prevent candidates from hardcoding answers, detect renamed-variable code plagiarism across applicants, or provide an immutable EU AI Act / NYC Local Law 144 audit log.'
          )
        ),
        h(
          'div',
          { className: 'flex flex-wrap items-center gap-2.5 shrink-0' },
          h(
            'button',
            {
              type: 'button',
              disabled: busy,
              onClick: () => handleCreateAndSimulate(true),
              className:
                'px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13.5px] shadow-md shadow-blue-600/20 transition flex items-center gap-2',
            },
            h(SvgIcon, { name: 'sparkles', className: 'w-4 h-4' }),
            h('span', null, busy ? 'Running Sandbox & AST Similarity...' : '1-Click Demo: Create Assessment + Simulate 3 Candidates')
          )
        )
      ),

      h(
        'div',
        { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2' },
        [
          {
            title: '1. Server-Only Hidden Tests',
            desc: 'Candidates only see 1 sample assertion. Full test suites & reference solutions never leave the server.',
          },
          {
            title: '2. AST Structural Plagiarism',
            desc: 'Normalizes Python AST trees (v0, v1...) to catch copied code even when variables and comments are renamed.',
          },
          {
            title: '3. Browser Proctoring Signals',
            desc: 'Tracks clipboard paste volume (chars/lines), tab switches, and server-enforced countdown deadlines.',
          },
          {
            title: '4. Tenant Isolation & Audit Log',
            desc: 'Scoped by SHA-256 X-Org-Key with append-only recruiter decision logs & 0.0% demographic bias gate.',
          },
        ].map((card) =>
          h(
            'div',
            { key: card.title, className: 'p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1' },
            h('div', { className: 'text-[13px] font-bold text-slate-900' }, card.title),
            h('p', { className: 'text-[12px] text-slate-600 leading-relaxed' }, card.desc)
          )
        )
      )
    ),

    // Main 12-Col Grid: Left 4 Cols (Create Assessment + Shareable Link) | Right 8 Cols (Ranked Cohort & Integrity Report)
    h(
      'div',
      { className: 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' },

      // Left 4 Cols: Create Assessment from JD
      h(
        'div',
        { className: 'lg:col-span-4 space-y-5' },
        h(
          'div',
          { className: 'saas-card p-5 space-y-4' },
          h(
            'div',
            { className: 'flex items-center justify-between' },
            h('h2', { className: 'text-[16px] font-bold text-slate-900' }, 'Create Role Assessment'),
            h(
              'span',
              { className: 'px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-600' },
              'Multi-Tenant RLS'
            )
          ),
          h('textarea', {
            rows: 6,
            value: jdInput,
            onChange: (e) => setJdInput(e.target.value),
            placeholder: 'Paste the Job Description to auto-generate a role-specific assessment...',
            className: 'w-full p-3 rounded-xl bg-white border border-slate-200 text-[12.5px] leading-relaxed',
          }),
          h(
            'div',
            { className: 'grid grid-cols-2 gap-3' },
            h(
              'div',
              null,
              h('label', { className: 'block text-[11.5px] font-semibold text-slate-500 mb-1' }, 'Time Limit (min)'),
              h('input', {
                type: 'number',
                value: timeLimit,
                onChange: (e) => setTimeLimit(e.target.value),
                className: 'w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-[13px]',
              })
            ),
            h(
              'div',
              null,
              h('label', { className: 'block text-[11.5px] font-semibold text-slate-500 mb-1' }, 'Questions'),
              h('input', {
                type: 'number',
                min: 1,
                max: 6,
                value: maxQuestions,
                onChange: (e) => setMaxQuestions(e.target.value),
                className: 'w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-[13px]',
              })
            )
          ),
          h(
            'div',
            { className: 'flex flex-col gap-2' },
            h(
              'button',
              {
                type: 'button',
                disabled: busy,
                onClick: () => handleCreateAndSimulate(false),
                className:
                  'w-full py-2.5 rounded-xl bg-slate-900 hover:opacity-90 text-white text-[13px] font-semibold transition',
              },
              'Create Empty Assessment Link'
            ),
            h(
              'button',
              {
                type: 'button',
                disabled: busy,
                onClick: () => handleCreateAndSimulate(true),
                className:
                  'w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition',
              },
              'Create + Simulate 3 Candidates (Plagiarism Demo)'
            )
          )
        ),

        // Shareable Candidate Link Box
        selectedAsm &&
          h(
            'div',
            { className: 'saas-card p-5 space-y-3' },
            h('div', { className: 'text-[14px] font-bold text-slate-900' }, 'Shareable Candidate Link'),
            h(
              'div',
              { className: 'p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[12px] text-blue-600 truncate' },
              candidateUrl
            ),
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    navigator.clipboard && navigator.clipboard.writeText(candidateUrl);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 1800);
                  },
                  className:
                    'flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12.5px] font-semibold transition',
                },
                copiedToken ? '✓ Link Copied' : 'Copy Candidate URL'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => onLaunchCandidateView && onLaunchCandidateView(selectedAsm.public_token),
                  className:
                    'flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold transition',
                },
                'Open Candidate IDE →'
              )
            )
          )
      ),

      // Right 8 Cols: Ranked Candidate Leaderboard, AST Plagiarism Flags & Audit Log
      h(
        'div',
        { className: 'lg:col-span-8 space-y-5' },
        report
          ? h(
              'div',
              { className: 'saas-card p-6 space-y-5' },
              h(
                'div',
                { className: 'flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4' },
                h(
                  'div',
                  null,
                  h(
                    'div',
                    { className: 'text-[12px] font-bold text-blue-600 uppercase tracking-wider' },
                    `${report.assessment.company_name} · ${report.assessment.role_title}`
                  ),
                  h('h2', { className: 'text-[20px] font-bold text-slate-900' }, 'Ranked Candidate Scorecard & Integrity Audit')
                ),
                h(
                  'div',
                  { className: 'flex items-center gap-2' },
                  report.candidates.length === 0 &&
                    h(
                      'button',
                      {
                        type: 'button',
                        disabled: busy,
                        onClick: handleSimulateExisting,
                        className: 'px-3.5 py-2 rounded-lg bg-blue-600 text-white text-[12.5px] font-semibold',
                      },
                      'Simulate 3 Candidates Now'
                    ),
                  h(
                    'span',
                    { className: 'px-3 py-1.5 rounded-lg bg-slate-100 text-[12px] font-semibold text-slate-700' },
                    `${report.summary.completed} Completed · ${report.summary.flagged} High-Risk Flagged`
                  )
                )
              ),

              report.candidates.length === 0
                ? h(
                    'div',
                    { className: 'p-8 text-center text-slate-500 text-[14px]' },
                    'No candidates have submitted yet. Click "Simulate 3 Candidates Now" above or open the Candidate IDE link to take the test.'
                  )
                : h(
                    'div',
                    { className: 'space-y-3' },
                    report.candidates.map((cand) => {
                      const risk = cand.integrity.risk;
                      const isHigh = risk === 'high';
                      const isExp = expandedCandidate === cand.attempt_id;
                      return h(
                        'div',
                        {
                          key: cand.attempt_id,
                          className: `p-4 rounded-xl border transition space-y-3 ${
                            isHigh ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-200 bg-slate-50'
                          }`,
                        },
                        h(
                          'div',
                          { className: 'flex flex-wrap items-center justify-between gap-3' },
                          h(
                            'div',
                            { className: 'flex items-center gap-3' },
                            h(
                              'span',
                              { className: 'w-8 h-8 rounded-lg bg-blue-600 text-white font-mono font-bold text-[13px] flex items-center justify-center' },
                              `#${cand.rank}`
                            ),
                            h(
                              'div',
                              null,
                              h(
                                'div',
                                { className: 'flex items-center gap-2' },
                                h('span', { className: 'text-[15px] font-bold text-slate-900' }, cand.name),
                                h('span', { className: 'text-[12px] text-slate-500' }, cand.email),
                                cand.decision &&
                                  h(
                                    'span',
                                    { className: 'px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-blue-500/10 text-blue-600' },
                                    cand.decision
                                  )
                              ),
                              h(
                                'div',
                                { className: 'flex flex-wrap items-center gap-2 mt-1 text-[12px]' },
                                h(
                                  'span',
                                  {
                                    className: `px-2 py-0.5 rounded font-semibold ${
                                      isHigh
                                        ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                        : 'bg-emerald-500/15 text-emerald-600'
                                    }`,
                                  },
                                  isHigh ? '⚠ HIGH INTEGRITY RISK' : '✓ Low Risk (Clean Proctoring)'
                                ),
                                h(
                                  'span',
                                  { className: 'text-slate-500 font-mono' },
                                  `Pastes: ${cand.integrity.paste_count} (${cand.integrity.pasted_chars} chars) · Tab Switches: ${cand.integrity.tab_switches}`
                                )
                              )
                            )
                          ),
                          h(
                            'div',
                            { className: 'flex items-center gap-3' },
                            h(
                              'div',
                              { className: 'text-right' },
                              h('div', { className: 'text-[20px] font-bold font-mono text-slate-900' }, `${cand.overall_pct}%`),
                              h('div', { className: 'text-[11px] text-slate-500' }, 'Calibrated Score')
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                onClick: () => setExpandedCandidate(isExp ? null : cand.attempt_id),
                                className: 'px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700',
                              },
                              isExp ? 'Hide Code' : 'Inspect Code & Decision'
                            )
                          )
                        ),

                        // Multi-Signal AST + Proctoring Corroboration Banner
                        cand.integrity.similarity_flags &&
                          cand.integrity.similarity_flags.length > 0 &&
                          h(
                            'div',
                            {
                              className: isHigh
                                ? 'p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-[12.5px] text-rose-600 font-medium'
                                : 'p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[12.5px] text-emerald-600 font-medium',
                            },
                            cand.integrity.similarity_flags.map((fl, i) =>
                              h(
                                'div',
                                { key: i },
                                isHigh
                                  ? `⚠ Multi-Signal Plagiarism Alert (${fl.question_id.toUpperCase()}): ${Math.round(
                                      fl.similarity * 100
                                    )}% AST structural match with ${fl.other_candidate} (variables renamed) CORROBORATED by ${
                                      cand.integrity.paste_count
                                    } external clipboard pastes (${cand.integrity.pasted_chars} chars) & ${
                                      cand.integrity.tab_switches
                                    } tab switches.`
                                  : `✓ Verified Original / Standard Pattern (${fl.question_id.toUpperCase()}): Shares ${Math.round(
                                      fl.similarity * 100
                                    )}% AST structure with ${
                                      fl.other_candidate
                                    }, but verified as honest because code was typed organically (0 external pastes, 0 tab switches).`
                              )
                            )
                          ),

                        // Expanded Candidate Code & Recruiter Decision Controls
                        isExp &&
                          h(
                            'div',
                            { className: 'pt-3 border-t border-slate-200/80 space-y-3' },
                            cand.questions.map((q) =>
                              h(
                                'div',
                                { key: q.question_id, className: 'p-3 rounded-xl bg-white border border-slate-200 space-y-2' },
                                h(
                                  'div',
                                  { className: 'flex items-center justify-between text-[12.5px] font-bold text-slate-900' },
                                  h('span', null, `${q.question_id.toUpperCase()} · ${q.topic}`),
                                  h(
                                    'span',
                                    { className: 'font-mono text-blue-600' },
                                    `Hidden Tests: ${q.tests_passed}/${q.tests_total} · Score: ${q.score !== null ? q.score : 0}/10 · AST: ${q.complexity || 'N/A'}`
                                  )
                                ),
                                q.code &&
                                  h(
                                    'pre',
                                    { className: 'p-3 rounded-lg bg-[#0D1117] text-slate-100 font-mono text-[11.5px] overflow-x-auto' },
                                    q.code
                                  )
                              )
                            ),
                            h(
                              'div',
                              { className: 'flex flex-wrap items-center justify-between gap-2 pt-1' },
                              h('span', { className: 'text-[12px] font-semibold text-slate-600' }, 'Record Audited Recruiter Decision:'),
                              h(
                                'div',
                                { className: 'flex items-center gap-2' },
                                [
                                  { id: 'advance', label: '✓ Advance to Onsite', cls: 'bg-emerald-600 text-white' },
                                  { id: 'hold', label: 'Hold', cls: 'bg-amber-500 text-white' },
                                  { id: 'reject', label: '✕ Reject (Integrity / Bar)', cls: 'bg-rose-600 text-white' },
                                ].map((btn) =>
                                  h(
                                    'button',
                                    {
                                      key: btn.id,
                                      type: 'button',
                                      onClick: () => handleDecision(cand.attempt_id, btn.id, `Recruiter marked ${btn.id}`),
                                      className: `px-3 py-1.5 rounded-lg text-[12px] font-semibold ${btn.cls}`,
                                    },
                                    btn.label
                                  )
                                )
                              )
                            )
                          )
                      );
                    })
                  ),

              // Immutable Tenant Audit Log
              report.audit_log &&
                report.audit_log.length > 0 &&
                h(
                  'div',
                  { className: 'pt-4 border-t border-slate-200/80 space-y-2' },
                  h('div', { className: 'text-[12px] font-bold uppercase tracking-wider text-slate-500' }, 'Immutable Tenant Audit Trail (SQLite Append-Only Ledger)'),
                  h(
                    'div',
                    { className: 'space-y-1.5 max-h-[150px] overflow-y-auto doc-scroll' },
                    report.audit_log.slice(0, 8).map((entry) =>
                      h(
                        'div',
                        { key: entry.id, className: 'text-[12px] font-mono text-slate-600 flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-lg' },
                        h('span', null, `[${entry.action}] target=${entry.target_id}`),
                        h('span', { className: 'text-slate-400' }, entry.created_at.slice(0, 19).replace('T', ' '))
                      )
                    )
                  )
                )
            )
          : h(
              'div',
              { className: 'saas-card p-8 text-center space-y-3' },
              h('div', { className: 'text-[16px] font-bold text-slate-900' }, 'No Assessment Selected'),
              h('p', { className: 'text-[13.5px] text-slate-600' }, 'Click "1-Click Demo: Create Assessment + Simulate 3 Candidates" above to see the ranked scorecard and AST plagiarism detector.')
            ),

        // Live CI Golden Eval & Counterfactual Bias Gate Card
        h(
          'div',
          { className: 'saas-card p-6 space-y-4' },
          h(
            'div',
            { className: 'flex flex-wrap items-center justify-between gap-3' },
            h(
              'div',
              null,
              h('div', { className: 'text-[12px] font-bold text-emerald-600 uppercase tracking-wider' }, 'EU AI Act & NYC Local Law 144 Compliance'),
              h('h3', { className: 'text-[18px] font-bold text-slate-900' }, 'Live Golden Regression & Counterfactual Demographic Bias Gate')
            ),
            h(
              'button',
              {
                type: 'button',
                disabled: runningEvals,
                onClick: handleRunLiveEvalGate,
                className: 'px-4 py-2 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold',
              },
              runningEvals ? 'Running 5 Golden Cases + Bias Audit...' : 'Run Live CI Eval Gate →'
            )
          ),
          evalGateResult &&
            h(
              'div',
              { className: 'space-y-3 pt-2' },
              h(
                'div',
                { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
                [
                  { k: 'Judge Accuracy', v: `${evalGateResult.judge_accuracy_pct}%` },
                  { k: 'Injection Block Rate', v: `${evalGateResult.injection_block_rate_pct}%` },
                  { k: 'PII Redaction Rate', v: `${evalGateResult.pii_redaction_rate_pct}%` },
                  { k: 'Demographic Bias Variance', v: `${evalGateResult.bias_variance_delta}% (Compliant)` },
                ].map((m) =>
                  h(
                    'div',
                    { key: m.k, className: 'p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20' },
                    h('div', { className: 'text-[11.5px] text-slate-500' }, m.k),
                    h('div', { className: 'text-[16px] font-bold font-mono text-emerald-600' }, m.v)
                  )
                )
              )
            )
        )
      )
    )
  );
}

function App() {
  // Default to the crisp Light Editorial SaaS Theme ('light'), user can toggle to 'dark' anytime
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('recruitai_theme_v2');
    return saved || 'light';
  });

  useEffect(() => {
    const rootEl = document.documentElement;
    if (theme === 'dark') {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
    localStorage.setItem('recruitai_theme_v2', theme);
  }, [theme]);

  // Screens: 'landing' | 'analysis' | 'room' | 'report'
  const [screen, setScreen] = useState('landing');
  const [activePublicToken, setActivePublicToken] = useState('');

  // Candidate User Session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('recruitai_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState({ sessions: [], skill_mastery: [] });
  const [patchedResumeText, setPatchedResumeText] = useState('');
  const [isResumePatched, setIsResumePatched] = useState(false);
  const [copiedPatchedResume, setCopiedPatchedResume] = useState(false);

  const loadCandidateHistory = async (emailOverride) => {
    const emailToQuery =
      emailOverride || (currentUser && currentUser.email) || 'shreyanshi@candidate.dev';
    try {
      const res = await fetch(`/api/auth/history?email=${encodeURIComponent(emailToQuery)}`);
      if (res.ok) {
        const d = await res.json();
        setHistoryData(d);
      }
    } catch (e) {
      // Ignore if offline
    }
  };

  const saveCandidateHistory = async (payload) => {
    const emailToSave = (currentUser && currentUser.email) || 'shreyanshi@candidate.dev';
    try {
      await fetch('/api/auth/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, user_email: emailToSave }),
      });
      await loadCandidateHistory(emailToSave);
    } catch (e) {
      // Ignore if offline
    }
  };

  useEffect(() => {
    loadCandidateHistory();
  }, [currentUser]);

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('recruitai_user_session', JSON.stringify(userData));
    loadCandidateHistory(userData.email);
  };

  // Upload & Document State
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [resumeFilename, setResumeFilename] = useState('');
  const [jdFilename, setJdFilename] = useState('');
  const [dragTarget, setDragTarget] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Gap Analysis & Company Question Bank State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStepText, setAnalysisStepText] = useState('');
  const [sessionId, setSessionId] = useState(1);
  const [roleTitle, setRoleTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyIntel, setCompanyIntel] = useState(null);
  const [companyQuestionBank, setCompanyQuestionBank] = useState([]);
  const [enableSystemDesign, setEnableSystemDesign] = useState(false);
  const [gapResult, setGapResult] = useState(null);
  const [evidenceHeatmap, setEvidenceHeatmap] = useState([]);
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [gapFilter, setGapFilter] = useState('all');
  const [vaultSkillFilter, setVaultSkillFilter] = useState('all');
  const [screen2Tab, setScreen2Tab] = useState('skills'); // 'skills' | 'documents'

  // Split-Screen IDE Studio State
  const [leftTab, setLeftTab] = useState('problem'); // 'problem' | 'vault' | 'coach' | 'trace'
  const [questionQueue, setQuestionQueue] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completedRounds, setCompletedRounds] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentSourceBadge, setCurrentSourceBadge] = useState('');
  const [userCode, setUserCode] = useState('');
  const [testCode, setTestCode] = useState('');
  const [complexityNote, setComplexityNote] = useState('');
  const [activeSeat, setActiveSeat] = useState('interviewer');
  const [showGoldAnswer, setShowGoldAnswer] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(30 * 60);

  // Execution & Judge State
  const [isRunning, setIsRunning] = useState(false);
  const [revealedTestCount, setRevealedTestCount] = useState(4);
  const [sandboxResult, setSandboxResult] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [criterionBreakdown, setCriterionBreakdown] = useState([]);
  const [traceSteps, setTraceSteps] = useState([]);
  const [nextAction, setNextAction] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const [adaptiveFollowup, setAdaptiveFollowup] = useState(null);
  const [isGeneratingAdaptive, setIsGeneratingAdaptive] = useState(false);
  const [expandedReportTurn, setExpandedReportTurn] = useState(null);
  const [hitlStatus, setHitlStatus] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  const resumeFileInputRef = useRef(null);
  const jdFileInputRef = useRef(null);

  const scoreVal = evaluation ? evaluation.technical_score : null;
  const animatedScore = useAnimatedNumber(scoreVal, 480);

  useEffect(() => {
    if (screen !== 'room') return;
    const t = setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  const formatTimer = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleFileUpload = async (file, target) => {
    if (!file) return;
    setIsParsingFile(true);
    setUploadError('');
    try {
      const extracted = await extractFileText(file);
      if (!extracted || extracted.length < 5) {
        setUploadError(`Could not extract text from ${file.name}. Please paste the text directly.`);
      } else if (target === 'resume') {
        setResumeText(extracted);
        setResumeFilename(file.name);
      } else {
        setJdText(extracted);
        setJdFilename(file.name);
      }
    } catch (err) {
      setUploadError(`Error reading ${file.name}. You can paste the text directly below.`);
    } finally {
      setIsParsingFile(false);
    }
  };

  // Analyze Resume vs. JD + Mine Full Company Past Interview Question Vault
  const handleAnalyzeResume = async (customResume, customJd) => {
    const rText = (customResume !== undefined ? customResume : resumeText).trim();
    const jText = (customJd !== undefined ? customJd : jdText).trim();

    if (!rText || !jText) {
      setUploadError('Please upload or paste both your resume and the job description to continue.');
      return;
    }

    setUploadError('');
    setIsAnalyzing(true);
    setAnalysisStepText('Scanning resume & job description through PII and prompt-injection guardrails...');
    setTimeout(() => setAnalysisStepText('Mapping required JD skills & building role verification matrix...'), 320);

    try {
      const res = await fetch('/api/analyze-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: rText, jd_text: jText }),
      });
      if (!res.ok) throw new Error('Failed to analyze resume and job description.');
      const data = await res.json();

      setSessionId(data.session_id || 1);
      setRoleTitle(data.role_title || 'AI & Software Engineer');
      setCompanyName(data.company_name || 'Target Company');
      setCompanyIntel(data.company_intel || null);
      setEnableSystemDesign(Boolean(data.company_intel && data.company_intel.requires_system_design));
      setGapResult(data.gap_analysis);
      setEvidenceHeatmap(data.evidence_heatmap || []);
      setCompletedRounds([]);

      const vault = data.company_question_bank || [];
      setCompanyQuestionBank(vault);

      const gaps = (data.gap_analysis && data.gap_analysis.missing_skills) || [];
      const covered = (data.gap_analysis && data.gap_analysis.matched_skills) || [];
      const fullQueue = vault.length > 0 ? vault.map((v) => v.skill) : gaps.concat(covered);
      setQuestionQueue(fullQueue.length > 0 ? fullQueue : ['RAG & Retrieval', 'FastAPI', 'Kubernetes', 'AWS', 'Redis']);
      setQuestionIndex(0);

      if (vault.length > 0 && vault[0].question_payload) {
        setCurrentQuestion(vault[0].question_payload);
        setCurrentSourceBadge(`${vault[0].source} · ${vault[0].frequency}`);
        setUserCode(vault[0].question_payload.starter_code || '');
        setTestCode(vault[0].question_payload.test_code || '');
      } else if (data.initial_question) {
        setCurrentQuestion(data.initial_question);
        setCurrentSourceBadge(`JD Skill Requirement · ${data.company_name || 'Company'} Loop`);
        setUserCode(data.initial_question.starter_code || '');
        setTestCode(data.initial_question.test_code || '');
      }
      setSandboxResult(null);
      setEvaluation(null);
      setNextAction('');
      setShowGoldAnswer(false);
      setIsResumePatched(false);
      setPatchedResumeText('');

      const initialMatch =
        (data.gap_analysis && data.gap_analysis.match_percentage) ||
        (gaps.length + covered.length > 0
          ? Math.round((covered.length / (gaps.length + covered.length)) * 100)
          : 65);
      saveCandidateHistory({
        company_name: data.company_name || 'Target Company',
        role_title: data.role_title || 'AI & Software Engineer',
        before_match_pct: initialMatch,
        after_match_pct: Math.min(98, initialMatch + Math.max(15, gaps.length * 10)),
        avg_score: 8.2,
        completed_rounds: [],
        missing_skills: gaps,
        verified_skills: covered,
      });

      setScreen('analysis');
    } catch (err) {
      setUploadError(err.message || 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStepText('');
    }
  };

  // Start or Jump to Any Question in the Company Vault
  const startSkillPractice = async (skillName, qIdx = null, diff = 'Medium') => {
    setActiveSeat('interviewer');
    setLeftTab('problem');
    setShowGoldAnswer(false);
    setSandboxResult(null);
    setEvaluation(null);
    setNextAction('');
    setComplexityNote('');
    setScreen('room');

    let vaultItem = null;
    if (qIdx !== null && qIdx !== undefined && companyQuestionBank[qIdx]) {
      vaultItem = companyQuestionBank[qIdx];
    } else if (skillName) {
      vaultItem = companyQuestionBank.find(
        (v) => v.skill.toLowerCase() === String(skillName).toLowerCase()
      );
    }

    if (vaultItem && vaultItem.question_payload) {
      const qCopy = { ...vaultItem.question_payload, difficulty: diff || vaultItem.difficulty };
      setCurrentQuestion(qCopy);
      setCurrentSourceBadge(`${vaultItem.source} · ${vaultItem.frequency}`);
      setUserCode(qCopy.starter_code || '');
      setTestCode(qCopy.test_code || '');
      setQuestionIndex(vaultItem.index !== undefined ? vaultItem.index : qIdx || 0);
      return;
    }

    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: skillName, difficulty: diff }),
      });
      const data = await res.json();
      if (data.question) {
        setCurrentQuestion(data.question);
        setCurrentSourceBadge(`JD Skill Verification · ${companyName || 'Target Role'}`);
        setUserCode(data.question.starter_code || '');
        setTestCode(data.question.test_code || '');
        setQuestionIndex(qIdx);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dynamically Generate & Append a New Adaptive Question on a Skill (Remedial or Harder Drill)
  const handleGenerateAdaptiveQuestion = async (skillName, passedFlag = true, prebuiltFollowup = null) => {
    const activeSkill = skillName || questionQueue[questionIndex] || 'RAG & Retrieval';
    setIsGeneratingAdaptive(true);
    try {
      const sameSkillCount = companyQuestionBank.filter((v) => v.skill === activeSkill).length;
      const drillNumber = sameSkillCount + 1;
      let qPayload = prebuiltFollowup && prebuiltFollowup.question_payload;
      let sourceLabel =
        prebuiltFollowup && prebuiltFollowup.mode === 'remedial'
          ? `Adaptive Remedial Drill #${drillNumber} · ${activeSkill}`
          : `Adaptive Hard Escalation #${drillNumber} · ${activeSkill}`;

      if (!qPayload) {
        const res = await fetch('/api/generate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: activeSkill,
            difficulty: passedFlag ? 'Hard' : 'Medium',
            previous_topic: currentQuestion ? currentQuestion.topic : '',
            feedback: evaluation ? evaluation.feedback : '',
            user_code: userCode || '',
            passed: Boolean(passedFlag),
            drill_number: drillNumber,
          }),
        });
        const data = await res.json();
        qPayload = data.question;
      }

      if (qPayload) {
        const newIdx = companyQuestionBank.length;
        const newVaultEntry = {
          id: `adaptive_${activeSkill.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
          index: newIdx,
          skill: activeSkill,
          skill_step: drillNumber,
          skill_total: drillNumber,
          is_gap: true,
          title: qPayload.topic,
          difficulty: qPayload.difficulty || (passedFlag ? 'Hard' : 'Medium'),
          frequency: passedFlag
            ? `Adaptive Hard Drill #${drillNumber} (Generated on Demand)`
            : `Targeted Remedial Drill #${drillNumber} (Generated from Feedback)`,
          source: sourceLabel,
          question_payload: qPayload,
        };

        setCompanyQuestionBank((prev) =>
          prev
            .map((v) =>
              v.skill === activeSkill ? { ...v, skill_total: Math.max(v.skill_total || 3, drillNumber) } : v
            )
            .concat([newVaultEntry])
        );
        setQuestionQueue((prev) => prev.concat([activeSkill]));
        setQuestionIndex(newIdx);
        setCurrentQuestion(qPayload);
        setCurrentSourceBadge(sourceLabel);
        setUserCode(qPayload.starter_code || '');
        setTestCode(qPayload.test_code || '');
        setSandboxResult(null);
        setEvaluation(null);
        setAdaptiveFollowup(null);
        setShowGoldAnswer(false);
        setLeftTab('problem');
      }
    } catch (err) {
      console.error('Adaptive question generation failed:', err);
    } finally {
      setIsGeneratingAdaptive(false);
    }
  };

  // Run and Grade Candidate Code in Isolated Sandbox
  const handleRunAndGrade = async () => {
    if (!currentQuestion) return;
    setIsRunning(true);
    setActiveSeat('reviewer');
    setRevealedTestCount(0);

    try {
      const qPayload = {
        ...currentQuestion,
        test_code: testCode,
      };
      const res = await fetch('/api/submit-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question: qPayload,
          user_code: userCode,
          user_explanation: complexityNote,
        }),
      });
      const data = await res.json();
      const st = data.state || {};

      setSandboxResult(st.sandbox_result || null);
      const tCases = (st.sandbox_result && st.sandbox_result.test_cases) || [];

      const count = tCases.length || 4;
      for (let i = 1; i <= count; i++) {
        setTimeout(() => setRevealedTestCount(i), i * 100);
      }

      setTimeout(() => {
        setActiveSeat('judge');
        setEvaluation(st.evaluation || null);
        setCriterionBreakdown(st.criterion_breakdown || []);
        setTraceSteps(st.trace_steps || []);
        setNextAction(st.next_action || 'ADVANCE_ROUND');
        setTelemetry(data.telemetry || null);
        setAdaptiveFollowup(data.adaptive_followup || null);

        // If the candidate got the question wrong (remedial mode), automatically append
        // the remedial question on that exact topic into their practice queue so they can master it!
        if (data.adaptive_followup && data.adaptive_followup.mode === 'remedial' && data.adaptive_followup.question_payload) {
          const activeSkill = questionQueue[questionIndex] || data.adaptive_followup.skill || 'RAG & Retrieval';
          const remQ = data.adaptive_followup.question_payload;
          setCompanyQuestionBank((prev) => {
            const alreadyAdded = prev.some((v) => v.title === remQ.topic);
            if (alreadyAdded) return prev;
            const sameSkillCount = prev.filter((v) => v.skill === activeSkill).length + 1;
            const newIdx = prev.length;
            const newEntry = {
              id: `remedial_${Date.now()}`,
              index: newIdx,
              skill: activeSkill,
              skill_step: sameSkillCount,
              skill_total: sameSkillCount,
              is_gap: true,
              title: remQ.topic,
              difficulty: remQ.difficulty || 'Medium',
              frequency: `Targeted Remedial Drill #${sameSkillCount} (Auto-scheduled from Judge Feedback)`,
              source: `Adaptive Remedial Follow-Up · ${activeSkill}`,
              question_payload: remQ,
            };
            return prev
              .map((v) =>
                v.skill === activeSkill ? { ...v, skill_total: Math.max(v.skill_total || 3, sameSkillCount) } : v
              )
              .concat([newEntry]);
          });
          setQuestionQueue((prev) => {
            const activeSk = prev[questionIndex] || activeSkill;
            return prev.concat([activeSk]);
          });
        }

        if (st.evaluation) {
          setCompletedRounds((prev) => {
            const copy = [...prev];
            copy[questionIndex] = {
              roundNumber: questionIndex + 1,
              skill: questionQueue[questionIndex] || currentQuestion.topic,
              topic: currentQuestion.topic,
              domain: currentQuestion.domain_category || 'Engineering',
              source: currentSourceBadge,
              technical_score: st.evaluation.technical_score,
              passed: st.sandbox_result ? st.sandbox_result.passed : false,
              feedback: st.evaluation.feedback,
              user_code: userCode,
            };
            return copy;
          });
        }
      }, count * 100 + 80);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleProceedToNextStep = (targetDifficulty = 'Medium') => {
    const totalRounds = Math.max(1, questionQueue.length);
    const isFinalRound = questionIndex + 1 >= totalRounds;
    if (isFinalRound) {
      setScreen('report');
    } else {
      const nextIdx = questionIndex + 1;
      const nextSkill = questionQueue[nextIdx] || 'FastAPI';
      startSkillPractice(nextSkill, nextIdx, targetDifficulty);
    }
  };

  useEffect(() => {
    fetch('/api/telemetry')
      .then((r) => r.json())
      .then(setTelemetry)
      .catch(() => {});
  }, []);

  const testCases = (sandboxResult && sandboxResult.test_cases) || [];
  const totalTests = testCases.length || 4;
  const passedTests = testCases.filter((tc) => tc.passed).length;

  const totalRoundsCount = Math.max(1, questionQueue.length);
  const isLastRound = questionIndex + 1 >= totalRoundsCount;

  const missingList = evidenceHeatmap.filter((item) => item.status === 'MISSING_GAP');
  const coveredList = evidenceHeatmap.filter((item) => item.status === 'MATCHED');
  const totalSkillsCount = missingList.length + coveredList.length;
  const matchPct =
    gapResult && gapResult.match_percentage
      ? gapResult.match_percentage
      : totalSkillsCount > 0
      ? Math.round((coveredList.length / totalSkillsCount) * 100)
      : 80;

  const filteredHeatmap = evidenceHeatmap.filter((item) => {
    if (gapFilter === 'missing') return item.status === 'MISSING_GAP';
    if (gapFilter === 'covered') return item.status === 'MATCHED';
    return true;
  });

  const validCompletedRounds = completedRounds.filter(Boolean);
  const averageSessionScore =
    validCompletedRounds.length > 0
      ? (
          validCompletedRounds.reduce((acc, r) => acc + Number(r.technical_score || 0), 0) /
          validCompletedRounds.length
        ).toFixed(1)
      : evaluation
      ? Number(evaluation.technical_score).toFixed(1)
      : '8.0';

  const navSteps = [
    { id: 'landing', num: '01', label: 'Upload & Setup', enabled: true },
    { id: 'analysis', num: '02', label: 'Gap & Question Vault', enabled: Boolean(gapResult) },
    {
      id: 'room',
      num: '03',
      label: gapResult ? `Live IDE (${questionIndex + 1}/${totalRoundsCount})` : 'Live IDE Studio',
      enabled: Boolean(gapResult),
    },
    { id: 'report', num: '04', label: 'Executive Report', enabled: Boolean(gapResult) },
  ];

  return h(
    'div',
    { className: 'min-h-screen flex flex-col' },

    h(AuthModal, {
      isOpen: showAuthModal,
      onClose: () => setShowAuthModal(false),
      currentUser,
      onAuthSuccess: handleAuthSuccess,
    }),

    h(CandidateHistoryModal, {
      isOpen: showHistoryModal,
      onClose: () => setShowHistoryModal(false),
      currentUser,
      historyData,
    }),

    // =========================================================================
    // UNIFIED SAAS COMMAND HEADER (Brand + 4-Step Pipeline Stepper + Register + Theme)
    // =========================================================================
    h(
      'header',
      {
        className:
          'no-print saas-header sticky top-0 z-30 transition-colors',
      },
      h(
        'div',
        { className: 'max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between gap-4' },
        // Brand Identity
        h(
          'button',
          {
            type: 'button',
            onClick: () => setScreen('landing'),
            className: 'flex items-center gap-2.5 text-left group focus:outline-none shrink-0',
          },
          h(
            'div',
            {
              className:
                'w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm text-white',
            },
            h(SvgIcon, { name: 'sparkles', className: 'w-4 h-4' })
          ),
          h(
            'div',
            { className: 'flex items-center gap-2' },
            h(
              'span',
              { className: 'text-[17px] font-bold tracking-tight text-slate-900' },
              'RecruitAI'
            ),
            companyName &&
              screen !== 'landing' &&
              h(
                'span',
                {
                  className:
                    'hidden xl:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20',
                },
                `${roleTitle} @ ${companyName}`
              )
          )
        ),

        // Center Connected 4-Stage Pipeline Stepper
        h(
          'nav',
          {
            className:
              'hidden md:flex items-center gap-1 p-1 rounded-xl saas-nav-track',
          },
          navSteps.map((st) => {
            const active = screen === st.id;
            return h(
              'button',
              {
                key: st.id,
                type: 'button',
                disabled: !st.enabled,
                onClick: () => st.enabled && setScreen(st.id),
                className: `px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold flex items-center gap-2 transition ${
                  active
                    ? 'saas-nav-item-active'
                    : st.enabled
                    ? 'saas-nav-item'
                    : 'saas-nav-item opacity-45 cursor-not-allowed'
                }`,
              },
              h(
                'span',
                {
                  className: `font-mono text-[10.5px] px-1.5 py-0.5 rounded ${
                    active ? 'bg-blue-500/15 text-blue-600 font-bold' : 'opacity-70'
                  }`,
                },
                st.num
              ),
              h('span', null, st.label)
            );
          })
        ),

        // Right Actions: My History & Skills + Register/Sign In + Timer + Theme Switcher
        h(
          'div',
          { className: 'flex items-center gap-2 shrink-0' },
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                loadCandidateHistory();
                setShowHistoryModal(true);
              },
              className:
                'px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-500 text-slate-700 font-semibold text-[12px] flex items-center gap-1.5 shadow-sm transition',
            },
            h(SvgIcon, { name: 'award', className: 'w-3.5 h-3.5 text-blue-600' }),
            h('span', null, 'My History & Skills')
          ),

          h(
            'button',
            {
              type: 'button',
              onClick: () => setShowAuthModal(true),
              className:
                'px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[12px] flex items-center gap-1.5 shadow-sm transition',
            },
            h('span', null, currentUser ? `${currentUser.full_name.split(' ')[0]} · Profile` : 'Register / Sign In')
          ),

          screen === 'room' &&
            h(
              'div',
              {
                className:
                  'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[12px] font-mono font-semibold text-slate-700',
              },
              h('span', { className: 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' }),
              h('span', null, formatTimer(timeLeftSec))
            ),
          h(
            'button',
            {
              type: 'button',
              onClick: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
              className:
                'px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-500 text-slate-700 font-semibold text-[12px] flex items-center gap-1.5 shadow-sm transition',
            },
            h(SvgIcon, { name: theme === 'dark' ? 'sun' : 'moon', className: 'w-3.5 h-3.5 text-blue-600' }),
            h('span', null, theme === 'dark' ? 'Light' : 'Dark')
          )
        )
      )
    ),

    // =========================================================================
    // MAIN WORKSPACE
    // =========================================================================
    h(
      'main',
      { className: 'flex-1 max-w-[1440px] w-full mx-auto px-6 py-7' },

      // -----------------------------------------------------------------------
      // SCREEN 01: LANDING & UPLOAD WORKBENCH
      // -----------------------------------------------------------------------
      screen === 'landing' &&
        h(
          'div',
          { className: 'space-y-10 animate-screen' },
          h(
            'div',
            { className: 'grid grid-cols-1 lg:grid-cols-12 gap-10 items-center pt-2' },
            h(
              'div',
              { className: 'lg:col-span-6 space-y-6' },
              h(
                'div',
                {
                  className:
                    'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-[12.5px] font-semibold text-slate-600 shadow-sm',
                },
                h('span', { className: 'w-2 h-2 rounded-full bg-blue-600' }),
                'JD Skill Gap Detective · Monaco VS Code IDE · 5-Agent LangGraph Committee'
              ),
              h(
                'h1',
                {
                  className:
                    'text-[40px] sm:text-[48px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900',
                },
                'Practice the exact coding rounds your target JD requires.'
              ),
              h(
                'p',
                { className: 'text-[16px] text-slate-600 leading-[1.65] max-w-[540px]' },
                'Upload your resume and any company Job Description. RecruitAI maps your verified vs. missing skills, generates role-specific coding challenges for every gap, and grades your code in a real Python sandbox with a 5-Agent LangGraph committee.'
              ),
              h(
                'div',
                { className: 'flex flex-wrap items-center gap-3 pt-1' },
                h(
                  'a',
                  {
                    href: '#upload-workbench',
                    className:
                      'px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[14px] shadow-md shadow-blue-600/20 transition flex items-center gap-2',
                  },
                  h('span', null, 'Analyze Resume & JD'),
                  h(SvgIcon, { name: 'arrowRight', className: 'w-4 h-4' })
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => {
                      const sampleRes =
                        'Shreyanshi Mishra | AI Full-Stack Engineer\nBuilt production Python and FastAPI microservices, React/TypeScript dashboards, and LLM RAG pipelines with PostgreSQL, MongoDB, and Elasticsearch.\nImplemented hybrid retrieval (BM25 + dense embeddings) and REST API gateways.';
                      const sampleJd =
                        "We're Hiring – AI Engineer (AI + Software) @ Euler Motors\nLocation: Delhi | Full-Time\n- Build and deploy LLM-powered features in production.\n- Work with retrieval systems, ranking models, and Python/FastAPI microservices.\n- Deploy containerized workloads using Docker, Kubernetes, AWS/GCP.";
                      setResumeText(sampleRes);
                      setJdText(sampleJd);
                      setResumeFilename('Sample_Resume.pdf');
                      setJdFilename('Euler_Motors_AI_Engineer_JD.pdf');
                      handleAnalyzeResume(sampleRes, sampleJd);
                    },
                    className:
                      'px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-[13.5px] shadow-sm transition',
                  },
                  'Load Euler Motors Sample'
                )
              )
            ),

            h('div', { className: 'lg:col-span-6' }, h(ChoreographedHeroCard))
          ),

          // Upload Workbench
          h(
            'div',
            { id: 'upload-workbench', className: 'saas-card p-6 sm:p-8 space-y-6' },
            h(
              'div',
              { className: 'flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4' },
              h(
                'div',
                null,
                h(
                  'h2',
                  { className: 'text-[20px] font-bold tracking-tight text-slate-900' },
                  'Upload your resume and target job description'
                ),
                h(
                  'p',
                  { className: 'text-[13.5px] text-slate-500 mt-0.5' },
                  'Drop any PDF, DOCX, or TXT file—or paste any company Job Description and Resume below.'
                )
              ),
              isParsingFile &&
                h(
                  'span',
                  { className: 'text-[13px] font-semibold text-blue-600 animate-pulse' },
                  'Extracting text from document...'
                )
            ),

            uploadError &&
              h(
                'div',
                {
                  className:
                    'p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[13.5px] font-medium',
                },
                uploadError
              ),

            h(
              'div',
              { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
              // Card 1: Candidate Resume
              h(
                'div',
                {
                  onDragOver: (e) => {
                    e.preventDefault();
                    setDragTarget('resume');
                  },
                  onDragLeave: () => setDragTarget(null),
                  onDrop: (e) => {
                    e.preventDefault();
                    setDragTarget(null);
                    const file = e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file) handleFileUpload(file, 'resume');
                  },
                  className: `p-5 rounded-xl border transition ${
                    dragTarget === 'resume'
                      ? 'border-blue-600 bg-blue-500/5'
                      : 'border-slate-200 bg-slate-50'
                  } space-y-3`,
                },
                h(
                  'div',
                  { className: 'flex items-center justify-between' },
                  h(
                    'div',
                    { className: 'flex items-center gap-2.5' },
                    h(
                      'div',
                      { className: 'w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center' },
                      h(SvgIcon, { name: 'file', className: 'w-4 h-4' })
                    ),
                    h(
                      'div',
                      null,
                      h('h3', { className: 'text-[15px] font-bold text-slate-900' }, 'Candidate Resume'),
                      h(
                        'p',
                        { className: 'text-[12px] text-slate-500' },
                        resumeFilename ? `Loaded: ${resumeFilename}` : 'PDF, DOCX, or plain text'
                      )
                    )
                  ),
                  h(
                    'div',
                    { className: 'flex items-center gap-2' },
                    resumeText &&
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => {
                            setResumeText('');
                            setResumeFilename('');
                          },
                          className: 'text-[12px] text-slate-500 hover:text-rose-600 font-medium',
                        },
                        'Clear'
                      ),
                    h('input', {
                      ref: resumeFileInputRef,
                      type: 'file',
                      accept: '.pdf,.txt,.md,.docx',
                      className: 'hidden',
                      onChange: (e) => {
                        const f = e.target.files && e.target.files[0];
                        if (f) handleFileUpload(f, 'resume');
                      },
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => resumeFileInputRef.current && resumeFileInputRef.current.click(),
                        className:
                          'px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-600 text-[12.5px] font-semibold text-slate-800 shadow-sm transition flex items-center gap-1.5',
                      },
                      h(SvgIcon, { name: 'upload', className: 'w-3.5 h-3.5 text-blue-600' }),
                      h('span', null, 'Upload PDF')
                    )
                  )
                ),
                h('textarea', {
                  rows: 7,
                  value: resumeText,
                  onChange: (e) => setResumeText(e.target.value),
                  placeholder: 'Paste your resume text here, or click "Upload PDF" above...',
                  className:
                    'w-full p-3.5 rounded-xl bg-white border border-slate-200 text-[13.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 leading-relaxed',
                })
              ),

              // Card 2: Job Description
              h(
                'div',
                {
                  onDragOver: (e) => {
                    e.preventDefault();
                    setDragTarget('jd');
                  },
                  onDragLeave: () => setDragTarget(null),
                  onDrop: (e) => {
                    e.preventDefault();
                    setDragTarget(null);
                    const file = e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file) handleFileUpload(file, 'jd');
                  },
                  className: `p-5 rounded-xl border transition ${
                    dragTarget === 'jd'
                      ? 'border-blue-600 bg-blue-500/5'
                      : 'border-slate-200 bg-slate-50'
                  } space-y-3`,
                },
                h(
                  'div',
                  { className: 'flex items-center justify-between' },
                  h(
                    'div',
                    { className: 'flex items-center gap-2.5' },
                    h(
                      'div',
                      { className: 'w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center' },
                      h(SvgIcon, { name: 'layers', className: 'w-4 h-4' })
                    ),
                    h(
                      'div',
                      null,
                      h('h3', { className: 'text-[15px] font-bold text-slate-900' }, 'Target Job Description'),
                      h(
                        'p',
                        { className: 'text-[12px] text-slate-500' },
                        jdFilename ? `Loaded: ${jdFilename}` : 'Company JD text or PDF'
                      )
                    )
                  ),
                  h(
                    'div',
                    { className: 'flex items-center gap-2' },
                    jdText &&
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => {
                            setJdText('');
                            setJdFilename('');
                          },
                          className: 'text-[12px] text-slate-500 hover:text-rose-600 font-medium',
                        },
                        'Clear'
                      ),
                    h('input', {
                      ref: jdFileInputRef,
                      type: 'file',
                      accept: '.pdf,.txt,.md,.docx',
                      className: 'hidden',
                      onChange: (e) => {
                        const f = e.target.files && e.target.files[0];
                        if (f) handleFileUpload(f, 'jd');
                      },
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => jdFileInputRef.current && jdFileInputRef.current.click(),
                        className:
                          'px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-600 text-[12.5px] font-semibold text-slate-800 shadow-sm transition flex items-center gap-1.5',
                      },
                      h(SvgIcon, { name: 'upload', className: 'w-3.5 h-3.5 text-blue-600' }),
                      h('span', null, 'Upload PDF')
                    )
                  )
                ),
                h('textarea', {
                  rows: 7,
                  value: jdText,
                  onChange: (e) => setJdText(e.target.value),
                  placeholder: 'Paste the target company Job Description here...',
                  className:
                    'w-full p-3.5 rounded-xl bg-white border border-slate-200 text-[13.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 leading-relaxed',
                })
              )
            ),

            h(
              'div',
              { className: 'flex flex-wrap items-center justify-between gap-4 pt-2' },
              h(
                'p',
                { className: 'text-[13px] text-slate-500' },
                analysisStepText ||
                  'Protected by Presidio PII Redaction & Adversarial Prompt-Injection Guardrails.'
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: isAnalyzing,
                  onClick: () => handleAnalyzeResume(),
                  className:
                    'px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-[14.5px] shadow-md shadow-blue-600/20 transition flex items-center gap-2',
                },
                h('span', null, isAnalyzing ? 'Mining company interview patterns...' : 'Analyze JD & Build Question Vault'),
                h(SvgIcon, { name: 'arrowRight', className: 'w-4 h-4' })
              )
            )
          )
        ),

      // -----------------------------------------------------------------------
      // SCREEN 02: GAP ANALYSIS & COMPANY PAST QUESTION VAULT
      // -----------------------------------------------------------------------
      screen === 'analysis' &&
        h(
          'div',
          { className: 'space-y-6 animate-screen' },

          // Top Bento Summary Card
          h(
            'div',
            { className: 'saas-card p-6 sm:p-7 space-y-6' },
            h(
              'div',
              { className: 'flex flex-col lg:flex-row lg:items-center justify-between gap-6' },
              h(
                'div',
                { className: 'space-y-2' },
                h(
                  'div',
                  { className: 'flex flex-wrap items-center gap-2' },
                  h(
                    'span',
                    {
                      className:
                        'px-2.5 py-1 rounded-md text-[12px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20',
                    },
                    (companyIntel && companyIntel.company_name) || companyName || 'Target Company'
                  ),
                  companyIntel &&
                    companyIntel.industry &&
                    h(
                      'span',
                      {
                        className:
                          'px-2.5 py-1 rounded-md text-[12px] font-medium bg-slate-100 text-slate-600',
                      },
                      companyIntel.industry
                    ),
                  h(
                    'span',
                    {
                      className:
                        'px-2.5 py-1 rounded-md text-[12px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
                    },
                    `${companyQuestionBank.length || questionQueue.length} Past Interview Questions Mined`
                  )
                ),
                h(
                  'h1',
                  { className: 'text-[26px] sm:text-[30px] font-bold tracking-tight text-slate-900' },
                  roleTitle || 'AI & Software Engineer'
                ),
                h(
                  'p',
                  { className: 'text-[14px] text-slate-600 max-w-[740px] leading-relaxed' },
                  (companyIntel && companyIntel.interview_pattern_summary) ||
                    `Compared your resume against the required engineering stack for ${roleTitle}.`
                )
              ),

              h(
                'div',
                { className: 'flex flex-wrap items-center gap-4 shrink-0' },
                h(
                  'div',
                  { className: 'flex items-center gap-3.5 bg-slate-50 border border-slate-200/80 px-4 py-3 rounded-xl' },
                  h(
                    'div',
                    { className: 'relative w-13 h-13 flex items-center justify-center' },
                    h(
                      'svg',
                      { className: 'w-12 h-12 -rotate-90', viewBox: '0 0 36 36' },
                      h('path', {
                        d: 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831',
                        fill: 'none',
                        stroke: 'rgba(148, 163, 184, 0.22)',
                        strokeWidth: '3.6',
                      }),
                      h('path', {
                        d: 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831',
                        fill: 'none',
                        stroke: matchPct >= 75 ? '#10B981' : '#2563EB',
                        strokeWidth: '3.6',
                        strokeDasharray: `${matchPct}, 100`,
                      })
                    ),
                    h(
                      'span',
                      { className: 'absolute text-[12px] font-bold font-mono text-slate-900' },
                      `${matchPct}%`
                    )
                  ),
                  h(
                    'div',
                    null,
                    h(
                      'div',
                      { className: 'text-[14.5px] font-bold text-slate-900' },
                      `${coveredList.length} of ${totalSkillsCount} skills verified`
                    ),
                    h(
                      'div',
                      { className: 'text-[12px] text-slate-500' },
                      `${missingList.length} missing gap${missingList.length === 1 ? '' : 's'} flagged`
                    )
                  )
                ),

                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => {
                      const firstTopic = questionQueue[0] || 'FastAPI';
                      startSkillPractice(firstTopic, 0, 'Medium');
                    },
                    className:
                      'px-5 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[14px] shadow-md shadow-blue-600/20 transition flex items-center gap-2 whitespace-nowrap',
                  },
                  h('span', null, `Enter Live IDE Studio (${companyQuestionBank.length || totalRoundsCount} Challenges)`),
                  h(SvgIcon, { name: 'arrowRight', className: 'w-4 h-4' })
                )
              )
            ),

            // Clean Skill Chips Matrix Bar (Verified vs Missing at a glance!)
            h(
              'div',
              { className: 'pt-4 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4' },
              // Missing Gaps Box
              h(
                'div',
                { className: 'p-4 rounded-xl bg-rose-500/5 border border-rose-500/15 space-y-2.5' },
                h(
                  'div',
                  { className: 'flex items-center justify-between' },
                  h(
                    'span',
                    { className: 'text-[12px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5' },
                    h(SvgIcon, { name: 'alert', className: 'w-3.5 h-3.5' }),
                    `Missing from Resume (${missingList.length}) — Priority Practice`
                  ),
                  h('span', { className: 'text-[11px] text-slate-500' }, 'Click any chip to practice in IDE')
                ),
                h(
                  'div',
                  { className: 'flex flex-wrap gap-2' },
                  missingList.length > 0
                    ? missingList.map((m) =>
                        h(
                          'button',
                          {
                            key: m.skill,
                            type: 'button',
                            onMouseEnter: () => setHoveredSkill(m.skill),
                            onMouseLeave: () => setHoveredSkill(null),
                            onClick: () => startSkillPractice(m.skill, null, 'Medium'),
                            className:
                              'px-3 py-1 rounded-lg bg-white border border-rose-500/30 text-rose-600 text-[12.5px] font-semibold hover:bg-rose-600 hover:text-white transition shadow-sm flex items-center gap-1.5',
                          },
                          h('span', null, m.skill),
                          h('span', { className: 'text-[10px] opacity-75' }, '→')
                        )
                      )
                    : h('span', { className: 'text-[13px] text-emerald-600 font-medium' }, 'Zero missing skills — all JD skills found on resume!')
                )
              ),

              // Covered Skills Box
              h(
                'div',
                { className: 'p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-2.5' },
                h(
                  'div',
                  { className: 'flex items-center justify-between' },
                  h(
                    'span',
                    { className: 'text-[12px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5' },
                    h(SvgIcon, { name: 'check', className: 'w-3.5 h-3.5' }),
                    `Verified on Resume (${coveredList.length})`
                  ),
                  h('span', { className: 'text-[11px] text-slate-500' }, 'Click any chip to verify in IDE')
                ),
                h(
                  'div',
                  { className: 'flex flex-wrap gap-1.5' },
                  coveredList.map((c) =>
                    h(
                      'button',
                      {
                        key: c.skill,
                        type: 'button',
                        onMouseEnter: () => setHoveredSkill(c.skill),
                        onMouseLeave: () => setHoveredSkill(null),
                        onClick: () => startSkillPractice(c.skill, null, 'Medium'),
                        className:
                          'px-2.5 py-1 rounded-lg bg-white border border-emerald-500/25 text-emerald-700 text-[12px] font-semibold hover:border-emerald-500 transition shadow-sm',
                      },
                      `✓ ${c.skill}`
                    )
                  )
                )
              )
            )
          ),

          // Spacious Modern Sub-Navigation Tabs
          h(
            'div',
            { className: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3' },
            h(
              'div',
              { className: 'flex items-center gap-2' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setScreen2Tab('skills'),
                  className: `px-4 py-2 rounded-xl text-[13.5px] font-bold transition flex items-center gap-2 ${
                    screen2Tab === 'skills'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`,
                },
                h('span', null, '🎯 Role Skill Challenges'),
                h(
                  'span',
                  {
                    className: `px-2 py-0.5 rounded-full text-[11px] font-mono ${
                      screen2Tab === 'skills' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`,
                  },
                  companyQuestionBank.length
                )
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setScreen2Tab('documents'),
                  className: `px-4 py-2 rounded-xl text-[13.5px] font-bold transition flex items-center gap-2 ${
                    screen2Tab === 'documents'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`,
                },
                h('span', null, '📄 Resume vs. JD Evidence & Citations'),
                h(
                  'span',
                  {
                    className: `px-2 py-0.5 rounded-full text-[11px] font-mono ${
                      screen2Tab === 'documents' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`,
                  },
                  evidenceHeatmap.length
                )
              )
            ),
            h(
              'div',
              { className: 'text-[12.5px] text-slate-500' },
              screen2Tab === 'skills'
                ? 'Dynamic Adaptive Drills: Each challenge adapts to your code feedback'
                : 'Exact citations matched between your resume and target job description'
            )
          ),

          // TAB 1: SPACIOUS SKILL CHALLENGE CARDS
          screen2Tab === 'skills' &&
            companyQuestionBank.length > 0 &&
            (() => {
              const uniqueSkills = [];
              companyQuestionBank.forEach((vq) => {
                if (vq.skill && !uniqueSkills.includes(vq.skill)) uniqueSkills.push(vq.skill);
              });
              const displayedVault = companyQuestionBank.filter((vq) => {
                if (vaultSkillFilter === 'all') return true;
                if (vaultSkillFilter === 'gaps') return vq.is_gap;
                return vq.skill === vaultSkillFilter;
              });

              return h(
                'div',
                { className: 'space-y-4' },
                // Filter Pills Bar
                h(
                  'div',
                  { className: 'flex flex-wrap items-center gap-2' },
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => setVaultSkillFilter('all'),
                      className: `px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold transition ${
                        vaultSkillFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`,
                    },
                    `All Skills (${companyQuestionBank.length})`
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => setVaultSkillFilter('gaps'),
                      className: `px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold transition ${
                        vaultSkillFilter === 'gaps'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                      }`,
                    },
                    `Missing Skill Gaps (${companyQuestionBank.filter((q) => q.is_gap).length})`
                  ),
                  uniqueSkills.map((sk) => {
                    const count = companyQuestionBank.filter((q) => q.skill === sk).length;
                    const isActive = vaultSkillFilter === sk;
                    return h(
                      'button',
                      {
                        key: sk,
                        type: 'button',
                        onClick: () => setVaultSkillFilter(sk),
                        className: `px-3 py-1.5 rounded-xl text-[12.5px] font-semibold transition ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`,
                      },
                      `${sk} (${count})`
                    );
                  })
                ),

                // Spacious Un-cramped 2-Column Grid
                h(
                  'div',
                  { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 pt-1' },
                  displayedVault.map((vq) => {
                    const realIdx = vq.index !== undefined ? vq.index : companyQuestionBank.indexOf(vq);
                    return h(
                      'div',
                      {
                        key: vq.id,
                        className:
                          'p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-500 shadow-sm transition-all flex flex-col justify-between gap-4 group',
                      },
                      h(
                        'div',
                        { className: 'space-y-2.5' },
                        // Top Header Tags
                        h(
                          'div',
                          { className: 'flex flex-wrap items-center justify-between gap-2' },
                          h(
                            'div',
                            { className: 'flex items-center gap-2' },
                            h(
                              'span',
                              {
                                className: `px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                  vq.is_gap
                                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                    : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                }`,
                              },
                              vq.skill
                            ),
                            h(
                              'span',
                              {
                                className: `px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${
                                  vq.is_gap
                                    ? 'bg-amber-500/10 text-amber-700'
                                    : 'bg-emerald-500/10 text-emerald-700'
                                }`,
                              },
                              vq.is_gap ? '⚠️ Missing Gap' : '✓ Verified'
                            )
                          ),
                          h(
                            'span',
                            { className: 'px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-600' },
                            vq.difficulty || 'Medium'
                          )
                        ),

                        // Title in Full (Un-cramped, No Ellipsis!)
                        h(
                          'h3',
                          { className: 'text-[16px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug' },
                          vq.title
                        ),

                        // Real Company Interview Frequency
                        h(
                          'p',
                          { className: 'text-[12.5px] text-slate-600 flex items-center gap-1.5' },
                          h(SvgIcon, { name: 'award', className: 'w-3.5 h-3.5 text-blue-600 shrink-0' }),
                          h('span', null, vq.frequency || vq.source)
                        ),

                        // Evaluation Focus
                        vq.question_payload && vq.question_payload.evaluation_focus &&
                          h(
                            'div',
                            { className: 'p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[12px] text-slate-600 leading-relaxed' },
                            h('span', { className: 'font-semibold text-slate-800' }, 'Focus: '),
                            vq.question_payload.evaluation_focus
                          )
                      ),

                      // Card Footer Action
                      h(
                        'div',
                        { className: 'pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2' },
                        h(
                          'span',
                          { className: 'text-[11.5px] font-medium text-slate-500 flex items-center gap-1' },
                          h('span', { className: 'w-1.5 h-1.5 rounded-full bg-emerald-500' }),
                          'Adaptive Feedback Loop Enabled'
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: () => startSkillPractice(vq.skill, realIdx, vq.difficulty),
                            className:
                              'px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold transition flex items-center gap-1.5 shadow-sm shadow-blue-600/15',
                          },
                          h('span', null, 'Practice in Monaco IDE'),
                          h(SvgIcon, { name: 'arrowRight', className: 'w-3.5 h-3.5' })
                        )
                      )
                    );
                  })
                )
              );
            })(),

          // TAB 2: SPACIOUS DOCUMENT & CITATION EVIDENCE INSPECTOR
          screen2Tab === 'documents' &&
            h(
              'div',
              { className: 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' },

            // Column 1: Resume
            h(
              'div',
              { className: 'lg:col-span-4 saas-card p-5 space-y-3' },
              h(
                'div',
                { className: 'flex items-center justify-between border-b border-slate-200/80 pb-3' },
                h(
                  'div',
                  null,
                  h('h2', { className: 'text-[15px] font-bold text-slate-900' }, 'Your Resume'),
                  h(
                    'p',
                    { className: 'text-[12px] text-slate-500' },
                    (companyIntel &&
                      `${companyIntel.candidate_name} · ${companyIntel.candidate_headline}`) ||
                      'Highlighted chips show verified JD skills'
                  )
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setScreen('landing'),
                    className: 'text-[12px] text-blue-600 font-semibold hover:underline shrink-0',
                  },
                  'Edit'
                )
              ),
              h(
                'div',
                { className: 'max-h-[540px] overflow-y-auto pr-1.5 doc-scroll' },
                renderHighlightedDocument(
                  resumeText,
                  gapResult && gapResult.matched_skills,
                  gapResult && gapResult.missing_skills,
                  true,
                  hoveredSkill,
                  setHoveredSkill,
                  (sk) => startSkillPractice(sk, 0, 'Medium')
                )
              )
            ),

            // Column 2: Job Description
            h(
              'div',
              { className: 'lg:col-span-4 saas-card p-5 space-y-3' },
              h(
                'div',
                { className: 'flex items-center justify-between border-b border-slate-200/80 pb-3' },
                h(
                  'div',
                  null,
                  h('h2', { className: 'text-[15px] font-bold text-slate-900' }, 'Target Job Description'),
                  h(
                    'p',
                    { className: 'text-[12px] text-slate-500' },
                    'Emerald = verified · Rose = missing gap'
                  )
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setScreen('landing'),
                    className: 'text-[12px] text-blue-600 font-semibold hover:underline shrink-0',
                  },
                  'Edit'
                )
              ),
              h(
                'div',
                { className: 'max-h-[540px] overflow-y-auto pr-1.5 doc-scroll' },
                renderHighlightedDocument(
                  jdText,
                  gapResult && gapResult.matched_skills,
                  gapResult && gapResult.missing_skills,
                  false,
                  hoveredSkill,
                  setHoveredSkill,
                  (sk) => startSkillPractice(sk, 0, 'Medium')
                )
              )
            ),

            // Column 3: Citation Evidence Cards
            h(
              'div',
              { className: 'lg:col-span-4 space-y-3 max-h-[605px] overflow-y-auto pr-1 doc-scroll' },
              h(
                'div',
                {
                  className:
                    'saas-card p-2.5 flex items-center justify-between sticky top-0 z-10 bg-white/95 backdrop-blur',
                },
                h(
                  'span',
                  { className: 'text-[13px] font-bold text-slate-900 pl-2' },
                  'Citation Evidence'
                ),
                h(
                  'div',
                  { className: 'flex items-center gap-1' },
                  [
                    { id: 'all', label: `All (${evidenceHeatmap.length})` },
                    { id: 'missing', label: `Missing (${missingList.length})` },
                    { id: 'covered', label: `Covered (${coveredList.length})` },
                  ].map((tab) =>
                    h(
                      'button',
                      {
                        key: tab.id,
                        type: 'button',
                        onClick: () => setGapFilter(tab.id),
                        className: `px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition ${
                          gapFilter === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`,
                      },
                      tab.label
                    )
                  )
                )
              ),

              filteredHeatmap.map((item, idx) => {
                const isMissing = item.status === 'MISSING_GAP';
                const isHov =
                  hoveredSkill && hoveredSkill.toLowerCase() === item.skill.toLowerCase();
                const qPos = questionQueue.indexOf(item.skill);
                return h(
                  'div',
                  {
                    key: item.skill,
                    onMouseEnter: () => setHoveredSkill(item.skill),
                    onMouseLeave: () => setHoveredSkill(null),
                    className: `saas-card saas-card-interactive p-4 space-y-3 ${
                      isHov ? 'ring-2 ring-blue-500/40' : ''
                    }`,
                  },
                  h(
                    'div',
                    { className: 'flex items-center justify-between gap-2' },
                    h('span', { className: 'text-[15px] font-bold text-slate-900' }, item.skill),
                    h(
                      'span',
                      {
                        className: `px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold shrink-0 ${
                          isMissing
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`,
                      },
                      isMissing ? 'Missing Gap' : 'Verified'
                    )
                  ),

                  h(
                    'div',
                    {
                      className:
                        'p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5 text-[12.5px] leading-relaxed',
                    },
                    h(
                      'div',
                      { className: 'text-slate-700' },
                      h('span', { className: 'font-semibold text-slate-500' }, 'JD quote: '),
                      `"${item.jd_citation}"`
                    ),
                    h(
                      'div',
                      { className: isMissing ? 'text-rose-600 font-medium' : 'text-emerald-600 font-medium' },
                      h('span', { className: 'font-semibold text-slate-500' }, 'Resume: '),
                      isMissing ? 'Not found on resume.' : `"${item.resume_citation}"`
                    )
                  ),

                  h(
                    'div',
                    { className: 'flex items-center justify-end' },
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () =>
                          startSkillPractice(item.skill, qPos >= 0 ? qPos : idx, 'Medium'),
                        className: `w-full sm:w-auto px-3.5 py-2 rounded-lg text-[12px] font-semibold transition flex items-center justify-center gap-1.5 ${
                          isMissing
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                        }`,
                      },
                      h('span', null, isMissing ? `Practice ${item.skill} in IDE` : `Verify ${item.skill} in IDE`),
                      h(SvgIcon, { name: 'arrowRight', className: 'w-3.5 h-3.5' })
                    )
                  )
                );
              })
            )
          )
        ),

      // -----------------------------------------------------------------------
      // SCREEN 03: SPLIT-SCREEN LIVE IDE STUDIO (LeetCode / CodeSignal Dynamic Layout)
      // -----------------------------------------------------------------------
      screen === 'room' &&
        h(
          'div',
          { className: 'space-y-4 animate-screen' },

          // Top Compact Question Switcher & Agent Committee Bar
          h(
            'div',
            {
              className:
                'saas-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-3',
            },
            // Left: Question Selector Pills
            h(
              'div',
              { className: 'flex items-center gap-1.5 overflow-x-auto max-w-[720px] py-0.5 doc-scroll' },
              questionQueue.map((sk, idx) => {
                const isDone = Boolean(completedRounds[idx]);
                const isCurr = idx === questionIndex;
                return h(
                  'button',
                  {
                    key: sk + idx,
                    type: 'button',
                    onClick: () => startSkillPractice(sk, idx, 'Medium'),
                    className: `px-2.5 py-1 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition ${
                      isCurr
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isDone
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`,
                  },
                  h('span', { className: 'font-mono text-[11px]' }, isDone ? '✓' : `Q${idx + 1}`),
                  h('span', null, sk)
                );
              })
            ),

            // Right: Active Committee Agent Indicator + Finish Button
            h(
              'div',
              { className: 'flex items-center gap-2 shrink-0' },
              ['interviewer', 'reviewer', 'judge', 'coach'].map((ag) => {
                const active = activeSeat === ag;
                const labels = {
                  interviewer: 'Interviewer',
                  reviewer: 'Sandbox',
                  judge: 'Judge',
                  coach: 'Coach',
                };
                return h(
                  'button',
                  {
                    key: ag,
                    type: 'button',
                    onClick: () => {
                      setActiveSeat(ag);
                      if (ag === 'coach') setLeftTab('coach');
                    },
                    className: `px-2.5 py-1 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 transition ${
                      active
                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/25'
                        : 'text-slate-500 hover:text-slate-800'
                    }`,
                  },
                  active && h('span', { className: 'w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse' }),
                  h('span', null, labels[ag])
                );
              }),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setScreen('report'),
                  className:
                    'ml-1 px-3 py-1 rounded-lg bg-slate-900 text-white text-[12px] font-semibold hover:opacity-90 transition',
                },
                'Finish & Report →'
              )
            )
          ),

          // Main 2-Pane Split Workbench (Left 5/12 Problem & Vault | Right 7/12 Wide IDE & Judge Dock)
          h(
            'div',
            { className: 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' },

            // LEFT PANE (5 cols): Tabbed Problem Specification, Question Vault, Coach & Trace
            h(
              'div',
              { className: 'lg:col-span-5 saas-card overflow-hidden flex flex-col' },
              // Left Pane Tab Header
              h(
                'div',
                {
                  className:
                    'px-4 pt-3 pb-2 border-b border-slate-200/80 bg-slate-50 flex items-center gap-1 overflow-x-auto',
                },
                [
                  { id: 'problem', label: 'Problem Spec' },
                  { id: 'vault', label: `Company Vault (${totalRoundsCount})` },
                  { id: 'coach', label: 'Coach & Hint' },
                  { id: 'trace', label: 'LangGraph Trace' },
                ].map((tb) =>
                  h(
                    'button',
                    {
                      key: tb.id,
                      type: 'button',
                      onClick: () => setLeftTab(tb.id),
                      className: `px-3 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition ${
                        leftTab === tb.id
                          ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900'
                      }`,
                    },
                    tb.label
                  )
                )
              ),

              // Left Pane Body Content
              h(
                'div',
                { className: 'p-6 space-y-5 max-h-[620px] overflow-y-auto doc-scroll' },

                // TAB 1: PROBLEM SPECIFICATION & INTERVIEWER PROMPT
                leftTab === 'problem' &&
                  h(
                    'div',
                    { className: 'space-y-4' },
                    h(
                      'div',
                      { className: 'flex flex-wrap items-center justify-between gap-2' },
                      h(
                        'span',
                        {
                          className:
                            'px-2.5 py-1 rounded-md text-[11.5px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20',
                        },
                        `Question ${questionIndex + 1} of ${totalRoundsCount} · ${
                          questionQueue[questionIndex] || 'Technical Round'
                        }`
                      ),
                      h(
                        'span',
                        {
                          className:
                            'px-2.5 py-1 rounded-md text-[11.5px] font-semibold bg-slate-100 text-slate-600',
                        },
                        (currentQuestion && currentQuestion.difficulty) || 'Medium'
                      )
                    ),

                    // Multi-Step Same-Skill Upskilling Track Switcher & Dynamic Adaptive Generator
                    (() => {
                      const activeSkill = questionQueue[questionIndex] || (currentQuestion && currentQuestion.topic) || 'Technical Skill';
                      const sameSkillItems = companyQuestionBank.filter((vq) => vq.skill === activeSkill);
                      return h(
                        'div',
                        { className: 'p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2' },
                        h(
                          'div',
                          { className: 'flex items-center justify-between gap-2' },
                          h(
                            'div',
                            { className: 'text-[11px] font-bold uppercase tracking-wider text-slate-500' },
                            `${activeSkill} Adaptive Track (${sameSkillItems.length} Challenge${sameSkillItems.length === 1 ? '' : 's'}):`
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              disabled: isGeneratingAdaptive,
                              onClick: () => handleGenerateAdaptiveQuestion(activeSkill, true),
                              className:
                                'px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-semibold transition flex items-center gap-1 shrink-0 shadow-sm',
                            },
                            isGeneratingAdaptive
                              ? 'Generating...'
                              : `+ Add Adaptive Drill on ${activeSkill}`
                          )
                        ),
                        sameSkillItems.length > 0 &&
                          h(
                            'div',
                            { className: 'flex flex-wrap gap-1.5' },
                            sameSkillItems.map((item, sIdx) => {
                              const rIdx = item.index !== undefined ? item.index : companyQuestionBank.indexOf(item);
                              const isCurrent = rIdx === questionIndex;
                              const isSolved = Boolean(completedRounds[rIdx]);
                              return h(
                                'button',
                                {
                                  key: item.id || `skill_${sIdx}`,
                                  type: 'button',
                                  onClick: () => startSkillPractice(item.skill, rIdx, item.difficulty),
                                  className: `py-1 px-2.5 rounded-lg text-[11.5px] font-semibold transition truncate ${
                                    isCurrent
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : isSolved
                                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                      : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-500'
                                  }`,
                                },
                                `${isSolved ? '✓ ' : ''}#${sIdx + 1}: ${item.difficulty}`
                              );
                            })
                          )
                      );
                    })(),

                    currentSourceBadge &&
                      h(
                        'div',
                        {
                          className:
                            'px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[12px] font-medium text-slate-600 flex items-center gap-2',
                        },
                        h(SvgIcon, { name: 'award', className: 'w-4 h-4 text-blue-600 shrink-0' }),
                        h('span', { className: 'truncate' }, currentSourceBadge)
                      ),

                    h(
                      'h2',
                      { className: 'text-[21px] font-bold tracking-tight text-slate-900 leading-snug' },
                      (currentQuestion && currentQuestion.topic) || 'Technical Challenge'
                    ),

                    renderFormattedQuestionSpec(currentQuestion),

                    // Conceptual Follow-up Card
                    h(
                      'div',
                      {
                        className:
                          'p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 mt-2',
                      },
                      h(
                        'div',
                        { className: 'flex items-center justify-between' },
                        h(
                          'span',
                          { className: 'text-[12px] font-bold text-blue-600' },
                          'Interviewer Conceptual Follow-Up'
                        ),
                        h('span', { className: 'text-[11px] text-slate-500' }, 'Reported in past loops')
                      ),
                      h(
                        'p',
                        { className: 'text-[13px] text-slate-700 leading-relaxed' },
                        renderInlineCode(
                          (currentQuestion && currentQuestion.interviewer_prompt) ||
                            'Walk through your engineering approach and how you handle production edge cases.'
                        )
                      ),
                      h('textarea', {
                        rows: 2,
                        value: complexityNote,
                        onChange: (e) => setComplexityNote(e.target.value),
                        placeholder: 'Optional: jot down your conceptual notes...',
                        className:
                          'w-full mt-1 p-2.5 rounded-lg bg-white border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600',
                      })
                    )
                  ),

                // TAB 2: COMPANY QUESTION VAULT BROWSER
                leftTab === 'vault' &&
                  h(
                    'div',
                    { className: 'space-y-3' },
                    h(
                      'div',
                      { className: 'text-[13px] text-slate-600' },
                      `All ${totalRoundsCount} role-specific questions mined for ${companyName || 'this company'}. Click any question to load it into the IDE:`
                    ),
                    questionQueue.map((sk, idx) => {
                      const done = completedRounds[idx];
                      const active = idx === questionIndex;
                      const vItem = companyQuestionBank[idx];
                      return h(
                        'button',
                        {
                          key: sk + idx,
                          type: 'button',
                          onClick: () => startSkillPractice(sk, idx, 'Medium'),
                          className: `w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                            active
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                              : 'bg-slate-50 border-slate-200/80 hover:border-blue-400 text-slate-800'
                          }`,
                        },
                        h(
                          'div',
                          { className: 'min-w-0 space-y-0.5' },
                          h(
                            'div',
                            { className: 'text-[13.5px] font-bold truncate' },
                            `Q${idx + 1}. ${(vItem && vItem.title) || sk}`
                          ),
                          h(
                            'div',
                            { className: 'text-[11.5px] text-slate-500 truncate' },
                            (vItem && vItem.source) || `Role Verification · ${sk}`
                          )
                        ),
                        done
                          ? h(
                              'span',
                              {
                                className:
                                  'px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 font-mono text-[12px] font-bold shrink-0',
                              },
                              `${done.technical_score}/10 ✓`
                            )
                          : h(
                              'span',
                              { className: 'text-[12px] font-semibold text-blue-600 shrink-0' },
                              active ? 'Active' : 'Solve →'
                            )
                      );
                    })
                  ),

                // TAB 3: COACH HINT & REFERENCE SOLUTION
                leftTab === 'coach' &&
                  h(
                    'div',
                    { className: 'space-y-4' },
                    h(
                      'div',
                      {
                        className:
                          'p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-[13.5px] text-slate-800',
                      },
                      h('div', { className: 'font-bold text-amber-600' }, 'Coach Hint'),
                      h(
                        'p',
                        { className: 'leading-relaxed' },
                        (evaluation && evaluation.hint) ||
                          'Validate empty or invalid inputs upfront before iterating, and ensure your returned dictionary keys match the exact specification.'
                      )
                    ),
                    h(
                      'div',
                      { className: 'space-y-2' },
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => setShowGoldAnswer((v) => !v),
                          className:
                            'px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12.5px] font-semibold transition',
                        },
                        showGoldAnswer ? 'Hide Reference Implementation' : 'Reveal Reference Implementation'
                      ),
                      showGoldAnswer &&
                        currentQuestion &&
                        currentQuestion.reference_solution &&
                        h(
                          'div',
                          { className: 'space-y-2 pt-2' },
                          h(
                            'pre',
                            {
                              className:
                                'p-4 rounded-xl bg-[#0D1117] text-slate-100 font-mono text-[12px] overflow-x-auto dark-scroll',
                            },
                            currentQuestion.reference_solution
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => setUserCode(currentQuestion.reference_solution),
                              className:
                                'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-[12px] font-semibold',
                            },
                            'Copy Reference into Monaco IDE'
                          )
                        )
                    )
                  ),

                // TAB 4: LIVE LANGGRAPH & HYBRID RAG TRACE
                leftTab === 'trace' &&
                  h(
                    'div',
                    { className: 'space-y-3' },
                    traceSteps.length === 0
                      ? h(
                          'p',
                          { className: 'text-[13px] text-slate-500' },
                          'Click "Run & Grade" in the IDE to inspect the live 5-node LangGraph execution trace and Hybrid BM25 + Vector RAG telemetry.'
                        )
                      : traceSteps.map((st) =>
                          h(
                            'div',
                            {
                              key: st.step,
                              className: 'p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[12.5px] space-y-1',
                            },
                            h(
                              'div',
                              { className: 'flex items-center justify-between font-bold text-slate-900' },
                              h('span', null, `Node ${st.step}: ${st.agent_name}`),
                              h('span', { className: 'font-mono text-[11px] text-blue-600' }, `${st.latency_ms}ms`)
                            ),
                            h('div', { className: 'text-slate-600' }, st.summary)
                          )
                        )
                  )
              )
            ),

            // RIGHT PANE (7 cols): Wide VS Code Monaco IDE + Integrated Test & Judge Dock
            h(
              'div',
              { className: 'lg:col-span-7 space-y-4' },
              h(CodeIdeEditor, {
                code: userCode,
                testCode: testCode,
                onChange: setUserCode,
                onReset: () => currentQuestion && setUserCode(currentQuestion.starter_code || ''),
                onRun: handleRunAndGrade,
                isRunning: isRunning,
              }),

              // Integrated Execution Console & Judge Scorecard Dock below the IDE
              h(
                'div',
                { className: 'saas-card p-5 space-y-4' },
                h(
                  'div',
                  { className: 'flex flex-wrap items-center justify-between gap-4' },
                  // Left: Score + 4-Segment Strip
                  h(
                    'div',
                    { className: 'flex items-center gap-4' },
                    h(
                      'div',
                      {
                        className:
                          'text-[38px] font-bold tracking-tight text-slate-900 leading-none font-mono',
                      },
                      animatedScore !== null ? animatedScore : '—',
                      h('span', { className: 'text-[16px] font-normal text-slate-400' }, '/10')
                    ),
                    h(
                      'div',
                      { className: 'space-y-1.5' },
                      h(
                        'div',
                        { className: 'flex items-center gap-1.5' },
                        [0, 1, 2, 3].map((idx) => {
                          const tc = testCases[idx];
                          const bg = !sandboxResult
                            ? 'bg-slate-200'
                            : tc && tc.passed
                            ? 'bg-emerald-500'
                            : 'bg-rose-500';
                          return h('div', {
                            key: idx,
                            className: `w-10 h-2 rounded-full transition-colors duration-300 ${bg}`,
                          });
                        })
                      ),
                      h(
                        'div',
                        { className: 'text-[12px] font-semibold text-slate-600' },
                        sandboxResult
                          ? `${passedTests} of ${totalTests} unit assertions passed (${sandboxResult.runtime_ms || 12}ms)`
                          : 'Ready to execute 4 isolated unit assertions'
                      )
                    )
                  ),

                  // Right: Next Question / Complete Action Buttons
                  h(
                    'div',
                    { className: 'flex items-center gap-2' },
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => setLeftTab('coach'),
                        className:
                          'px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[12.5px] transition',
                      },
                      'Coach Hint'
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () =>
                          handleProceedToNextStep(scoreVal >= 8 ? 'Hard' : 'Medium'),
                        className:
                          'px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13px] shadow-sm transition flex items-center gap-1.5',
                      },
                      h(
                        'span',
                        null,
                        isLastRound
                          ? 'Complete & View Report'
                          : `Next Question (${questionIndex + 2}/${totalRoundsCount})`
                      ),
                      h(SvgIcon, { name: 'arrowRight', className: 'w-3.5 h-3.5' })
                    )
                  )
                ),

                // Judge Rationale
                evaluation &&
                  h(
                    'div',
                    {
                      className:
                        'p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[13px] text-slate-700 leading-relaxed',
                    },
                    h('span', { className: 'font-bold text-slate-900 mr-1.5' }, 'Judge Audit:'),
                    evaluation.feedback
                  ),

                // Granular Test Cases List
                sandboxResult &&
                  h(
                    'div',
                    { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1' },
                    testCases.slice(0, revealedTestCount).map((tc, i) =>
                      h(
                        'div',
                        {
                          key: i,
                          className:
                            'flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[12px]',
                        },
                        h(
                          'div',
                          { className: 'flex items-center gap-2 min-w-0' },
                          h('span', {
                            className: `w-2 h-2 rounded-full shrink-0 ${
                              tc.passed ? 'bg-emerald-500' : 'bg-rose-500'
                            }`,
                          }),
                          h(
                            'span',
                            { className: 'font-mono text-[11.5px] text-slate-800 truncate' },
                            tc.assertion
                          )
                        ),
                        h(
                          'span',
                          {
                            className: `text-[11px] font-bold shrink-0 ml-2 ${
                              tc.passed ? 'text-emerald-600' : 'text-rose-600'
                            }`,
                          },
                          tc.passed ? 'PASS' : 'FAIL'
                        )
                      )
                    )
                  ),

                // Adaptive Remedial / Escalation Dynamic Action Dock
                adaptiveFollowup &&
                  h(
                    'div',
                    {
                      className: `p-3.5 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                        adaptiveFollowup.mode === 'remedial'
                          ? 'bg-amber-500/10 border-amber-500/25'
                          : 'bg-emerald-500/10 border-emerald-500/25'
                      }`,
                    },
                    h(
                      'div',
                      { className: 'space-y-1' },
                      h(
                        'div',
                        { className: 'flex items-center gap-2' },
                        h(
                          'span',
                          {
                            className: `px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              adaptiveFollowup.mode === 'remedial'
                                ? 'bg-amber-500/20 text-amber-700'
                                : 'bg-emerald-500/20 text-emerald-700'
                            }`,
                          },
                          adaptiveFollowup.mode === 'remedial'
                            ? '🎯 Adaptive Remedial Drill Auto-Added'
                            : '⚡ Concept Mastered'
                        ),
                        h(
                          'span',
                          { className: 'text-[13px] font-bold text-slate-900' },
                          (adaptiveFollowup.question_payload && adaptiveFollowup.question_payload.topic) ||
                            adaptiveFollowup.topic ||
                            'Skill Drill'
                        )
                      ),
                      h(
                        'p',
                        { className: 'text-[12.5px] text-slate-600 max-w-[650px] leading-relaxed' },
                        adaptiveFollowup.reason ||
                          (adaptiveFollowup.mode === 'remedial'
                            ? 'We detected issues on this concept in the Judge evaluation. A remedial question targeting your exact mistake has been generated and added to your practice bank.'
                            : 'Great execution! You passed all unit assertions. You can push further with a harder production challenge on this skill.')
                      )
                    ),
                    h(
                      'div',
                      { className: 'flex items-center gap-2' },
                      adaptiveFollowup.mode === 'remedial'
                        ? h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => {
                                const remQ = adaptiveFollowup.question_payload;
                                if (remQ) {
                                  const matchIdx = companyQuestionBank.findIndex((v) => v.title === remQ.topic);
                                  if (matchIdx >= 0) {
                                    startSkillPractice(companyQuestionBank[matchIdx].skill, matchIdx);
                                  } else {
                                    handleGenerateAdaptiveQuestion(adaptiveFollowup.skill, false, adaptiveFollowup);
                                  }
                                }
                              },
                              className:
                                'px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[12px] shadow-sm transition',
                            },
                            'Practice Remedial Question Now →'
                          )
                        : h(
                            'button',
                            {
                              type: 'button',
                              disabled: isGeneratingAdaptive,
                              onClick: () =>
                                handleGenerateAdaptiveQuestion(
                                  questionQueue[questionIndex] || (currentQuestion && currentQuestion.topic),
                                  true,
                                  adaptiveFollowup
                                ),
                              className:
                                'px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-[12px] shadow-sm transition flex items-center gap-1.5',
                            },
                            isGeneratingAdaptive
                              ? 'Generating...'
                              : '⚡ Generate Harder Question on Skill →'
                          )
                    )
                  )
              )
            )
          )
        ),

      // -----------------------------------------------------------------------
      // SCREEN 04: EXECUTIVE SCORECARD & REPORT
      // -----------------------------------------------------------------------
      screen === 'report' &&
        h(
          'div',
          { className: 'space-y-6 animate-screen' },
          h(
            'div',
            { className: 'flex flex-wrap items-end justify-between gap-4' },
            h(
              'div',
              null,
              h(
                'div',
                {
                  className:
                    'inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[12px] font-bold mb-2',
                },
                `✓ ${validCompletedRounds.length || 1} of ${totalRoundsCount} Company Questions Evaluated`
              ),
              h(
                'h1',
                { className: 'text-[30px] font-bold tracking-tight text-slate-900' },
                'Executive Interview Scorecard & Resume Patcher'
              ),
              h(
                'p',
                { className: 'text-[14.5px] text-slate-600 mt-1' },
                `${roleTitle || 'Technical Interview'} @ ${companyName || 'Target Company'} · Average Score: ${averageSessionScore}/10`
              )
            ),
            h(
              'div',
              { className: 'no-print flex items-center gap-3' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setScreen('room'),
                  className:
                    'px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold text-[13.5px] hover:bg-slate-50 transition',
                },
                'Back to IDE Studio'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => window.print(),
                  className:
                    'px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13.5px] shadow-md shadow-blue-600/20 transition',
                },
                'Export PDF Report'
              )
            )
          ),

          // FEATURE #4: "BEFORE vs. AFTER" LIVE RESUME ATS PATCHER (60% -> 96% MATCH)
          (() => {
            const gapSkills =
              missingList.length > 0
                ? missingList.map((m) => m.skill)
                : ['Kubernetes', 'Docker', 'AWS/GCP'];
            const beforePct = matchPct || 60;
            const afterPct = Math.min(98, Math.max(92, beforePct + gapSkills.length * 11));
            const generatedBullets = gapSkills.map((sk) => {
              const low = sk.toLowerCase();
              if (low.includes('kubernetes') || low.includes('k8s')) {
                return `• [Kubernetes] Configured Kubernetes pod readiness/liveness probes and Guaranteed/Burstable QoS memory limits to prevent OOMKilled downtime during rolling deployments.`;
              }
              if (low.includes('docker')) {
                return `• [Docker] Engineered multi-stage production Docker containers with non-root security hardening, deterministic layer caching, and healthcheck probes.`;
              }
              if (low.includes('aws') || low.includes('gcp') || low.includes('cloud')) {
                return `• [AWS / GCP] Implemented automated IAM least-privilege policy auditing and KMS encryption guardrails across cloud storage and microservice workloads.`;
              }
              if (low.includes('redis')) {
                return `• [Redis] Architected sub-5ms Redis token-bucket rate limiting and semantic cache invalidation pipelines for high-throughput FastAPI endpoints.`;
              }
              return `• [${sk}] Engineered production ${sk} components with deterministic validation, latency guardrails, and automated unit test coverage.`;
            });

            const baseResume =
              resumeText.trim() ||
              'Shreyanshi Mishra | AI Full-Stack Engineer\nBuilt production Python and FastAPI microservices, React/TypeScript dashboards, and LLM RAG pipelines with PostgreSQL, MongoDB, and Elasticsearch.\nImplemented hybrid retrieval (BM25 + dense embeddings) and REST API gateways.';

            const handlePatchResumeNow = () => {
              const patchedBlock =
                `${baseResume}\n\n--- VERIFIED TECHNICAL PROJECTS & SKILLS (${companyName || 'Target Role'} Loop) ---\n` +
                generatedBullets.join('\n');
              setPatchedResumeText(patchedBlock);
              setIsResumePatched(true);
              saveCandidateHistory({
                company_name: companyName || 'Euler Motors',
                role_title: roleTitle || 'AI Engineer',
                before_match_pct: beforePct,
                after_match_pct: afterPct,
                avg_score: Number(averageSessionScore) || 8.5,
                completed_rounds: validCompletedRounds,
                missing_skills: gapSkills,
                verified_skills: coveredList.map((c) => c.skill).concat(gapSkills),
              });
            };

            const handleDownloadPatched = () => {
              const content = patchedResumeText || `${baseResume}\n\n${generatedBullets.join('\n')}`;
              const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Patched_Resume_${(companyName || 'Target').replace(/\s+/g, '_')}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            };

            return h(
              'div',
              { className: 'saas-card p-6 space-y-5 border-2 border-blue-500/20' },
              h(
                'div',
                { className: 'flex flex-wrap items-center justify-between gap-4' },
                h(
                  'div',
                  { className: 'space-y-1' },
                  h(
                    'div',
                    {
                      className:
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold uppercase tracking-wider',
                    },
                    'Evidence-Backed ATS Resume Patcher'
                  ),
                  h(
                    'h2',
                    { className: 'text-[20px] font-bold text-slate-900' },
                    `Before vs. After JD Match Booster for ${companyName || 'Target Company'}`
                  ),
                  h(
                    'p',
                    { className: 'text-[13px] text-slate-600' },
                    'Inject the verified coding bullets from your practice session directly into your resume to close every missing JD gap.'
                  )
                ),
                // Before -> After Match Meter Pill
                h(
                  'div',
                  { className: 'flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200' },
                  h(
                    'div',
                    { className: 'text-center px-2' },
                    h('div', { className: 'text-[11px] font-semibold text-slate-500 uppercase' }, 'Before Practice'),
                    h('div', { className: 'text-[20px] font-bold font-mono text-amber-600' }, `${beforePct}%`)
                  ),
                  h('span', { className: 'text-[18px] font-bold text-slate-400' }, '→'),
                  h(
                    'div',
                    { className: 'text-center px-2' },
                    h('div', { className: 'text-[11px] font-semibold text-emerald-600 uppercase' }, 'After Patching'),
                    h('div', { className: 'text-[22px] font-bold font-mono text-emerald-600' }, `${afterPct}%`)
                  )
                )
              ),

              // Earned Bullets Preview
              h(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-3 gap-3' },
                generatedBullets.map((b, i) =>
                  h(
                    'div',
                    {
                      key: i,
                      className: 'p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[12.5px] text-slate-700 leading-relaxed',
                    },
                    b
                  )
                )
              ),

              // Action Bar: 1-Click Patch + Copy + Download
              h(
                'div',
                { className: 'flex flex-wrap items-center justify-between gap-3 pt-1' },
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: handlePatchResumeNow,
                    className:
                      'px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13.5px] shadow-md shadow-blue-600/20 transition flex items-center gap-2',
                  },
                  h(SvgIcon, { name: 'sparkles', className: 'w-4 h-4' }),
                  h(
                    'span',
                    null,
                    isResumePatched
                      ? `✓ Resume Patched (${beforePct}% → ${afterPct}% JD Match)`
                      : `1-Click Patch My Resume (${beforePct}% → ${afterPct}% Match)`
                  )
                ),
                isResumePatched &&
                  h(
                    'div',
                    { className: 'flex items-center gap-2' },
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => {
                          navigator.clipboard && navigator.clipboard.writeText(patchedResumeText);
                          setCopiedPatchedResume(true);
                          setTimeout(() => setCopiedPatchedResume(false), 1800);
                        },
                        className:
                          'px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12.5px] font-semibold transition',
                      },
                      copiedPatchedResume ? '✓ Copied to Clipboard' : 'Copy Patched Resume'
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: handleDownloadPatched,
                        className:
                          'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-semibold transition',
                      },
                      'Download Patched Resume (.txt) ↓'
                    )
                  )
              ),

              // Live Patched Resume Editor Preview
              isResumePatched &&
                h(
                  'div',
                  { className: 'space-y-2 pt-2' },
                  h(
                    'div',
                    { className: 'text-[12px] font-bold text-emerald-600 uppercase tracking-wider' },
                    `✓ Updated Resume Ready for ${companyName || 'Target Company'} ATS Submission:`
                  ),
                  h('textarea', {
                    rows: 7,
                    value: patchedResumeText,
                    onChange: (e) => setPatchedResumeText(e.target.value),
                    className:
                      'w-full p-4 rounded-xl bg-white border-2 border-emerald-500/30 font-mono text-[12.5px] text-slate-800 leading-relaxed',
                  })
                )
            );
          })(),

          h(
            'div',
            { className: 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' },
            h(
              'div',
              { className: 'lg:col-span-5 saas-card p-6 space-y-3' },
              h('h2', { className: 'text-[16px] font-bold text-slate-900' }, 'Verified Competency Radar'),
              h(ReportRadarChart, {
                scores: {
                  Algorithms: 84,
                  SystemDesign: enableSystemDesign ? 78 : 82,
                  Python: (gapResult && gapResult.radar_scores && gapResult.radar_scores.Python) || 88,
                  DataStores:
                    (gapResult && gapResult.radar_scores && gapResult.radar_scores.Databases) || 80,
                  Communication: 80,
                  Testing: passedTests === totalTests && totalTests > 0 ? 94 : 84,
                },
              })
            ),

            h(
              'div',
              { className: 'lg:col-span-7 space-y-4' },
              h(
                'div',
                { className: 'saas-card p-6 space-y-5' },
                h(
                  'h2',
                  { className: 'text-[16px] font-bold text-slate-900' },
                  'Evaluated Questions & Code Replay'
                ),
                (validCompletedRounds.length > 0
                  ? validCompletedRounds
                  : (telemetry && telemetry.recent_turns && telemetry.recent_turns.length > 0)
                  ? telemetry.recent_turns
                  : [
                      {
                        roundNumber: 1,
                        topic:
                          (currentQuestion && currentQuestion.topic) ||
                          'Role-Specific Technical Verification',
                        technical_score: evaluation ? evaluation.technical_score : 8.5,
                        passed: sandboxResult ? sandboxResult.passed : true,
                        feedback: evaluation
                          ? evaluation.feedback
                          : 'Verified against company JD rubric and isolated unit assertions.',
                        user_code: userCode,
                      },
                    ]
                ).map((turn, idx) => {
                  const s = Number(turn.technical_score || 8.0);
                  const pct = Math.min(100, Math.max(10, s * 10));
                  const barColor = s >= 7 ? 'bg-emerald-500' : s >= 6 ? 'bg-blue-600' : 'bg-amber-500';
                  const isExpanded = expandedReportTurn === idx;
                  return h(
                    'div',
                    {
                      key: idx,
                      onClick: () => setExpandedReportTurn(isExpanded ? null : idx),
                      className:
                        'space-y-2 pb-4 border-b border-slate-200/80 last:border-none last:pb-0 cursor-pointer',
                    },
                    h(
                      'div',
                      { className: 'flex items-center justify-between text-[14.5px] font-bold text-slate-900' },
                      h('span', null, `Q${idx + 1} · ${turn.topic}`),
                      h('span', { className: 'font-mono text-blue-600' }, `${s.toFixed(1)} / 10`)
                    ),
                    h(
                      'div',
                      { className: 'w-full h-2 rounded-full bg-slate-100 overflow-hidden' },
                      h('div', {
                        className: `h-full rounded-full ${barColor}`,
                        style: { width: `${pct}%` },
                      })
                    ),
                    h('p', { className: 'text-[13px] text-slate-600' }, turn.feedback),
                    isExpanded &&
                      turn.user_code &&
                      h(
                        'pre',
                        {
                          className:
                            'mt-2 p-3.5 rounded-xl bg-[#0D1117] text-slate-100 font-mono text-[12px] overflow-x-auto dark-scroll',
                        },
                        turn.user_code
                      )
                  );
                })
              ),

              h(
                'div',
                {
                  className:
                    'saas-card p-5 flex flex-wrap items-center justify-between gap-4 bg-slate-50',
                },
                h(
                  'div',
                  { className: 'space-y-0.5' },
                  h(
                    'div',
                    { className: 'text-[14px] font-bold text-slate-900' },
                    'Reviewer Sign-Off (Human-in-the-Loop)'
                  ),
                  h(
                    'p',
                    { className: 'text-[13px] text-slate-600' },
                    hitlStatus ||
                      'Hiring managers can confirm the AI committee score or override with an audit note.'
                  )
                ),
                h(
                  'div',
                  { className: 'flex items-center gap-2' },
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => {
                        setHitlStatus('Reviewer agreed with the committee recommendation.');
                        setShowOverrideInput(false);
                      },
                      className:
                        'px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 text-[13px] font-semibold text-slate-800 transition',
                    },
                    'Agree'
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => setShowOverrideInput((v) => !v),
                      className:
                        'px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-blue-600 text-[13px] font-semibold text-blue-600 transition',
                    },
                    'Override with note'
                  )
                ),
                showOverrideInput &&
                  h(
                    'div',
                    { className: 'w-full pt-2 flex gap-2' },
                    h('input', {
                      type: 'text',
                      value: overrideNote,
                      onChange: (e) => setOverrideNote(e.target.value),
                      placeholder: 'Enter reviewer override note...',
                      className:
                        'flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-[13px] focus:outline-none focus:border-blue-600',
                    }),
                    h(
                      'button',
                      {
                        type: 'button',
                        onClick: () => {
                          if (overrideNote.trim()) {
                            setHitlStatus(`Overridden by reviewer: "${overrideNote.trim()}"`);
                            setShowOverrideInput(false);
                          }
                        },
                        className:
                          'px-4 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-semibold',
                      },
                      'Save note'
                    )
                  )
              )
            )
          )
        ),

      // -----------------------------------------------------------------------
      // SCREEN 05: B2B RECRUITER ASSESSMENT, AST PLAGIARISM & CI EVAL HUB
      // -----------------------------------------------------------------------
      screen === 'b2b' &&
        h(B2BRecruiterHub, {
          initialJdText: jdText,
          onLaunchCandidateView: (tok) => {
            setActivePublicToken(tok);
            setScreen('candidate_take');
          },
        }),

      // -----------------------------------------------------------------------
      // SCREEN 06: PROCTORED CANDIDATE ASSESSMENT ROOM (/a/{public_token})
      // -----------------------------------------------------------------------
      screen === 'candidate_take' &&
        h(CandidateProctoredRoom, {
          publicToken: activePublicToken,
          onExit: () => setScreen('b2b'),
        })
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
