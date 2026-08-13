/**
 * The rounded dark code cards that sit at the lower right of each feature
 * section, with a copy button and light syntax highlighting.
 *
 * The highlighter is a deliberately small tokeniser - these are short, known
 * snippets, so a full JS grammar would be dead weight on the bundle.
 */

const TOKEN = new RegExp(
  [
    "(?<comment>\\/\\/[^\\n]*)",
    "(?<string>'(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"|`(?:[^`\\\\]|\\\\.)*`)",
    '(?<keyword>\\b(?:const|let|var|function|return|new|import|from|export|await|async|if|else)\\b)',
    '(?<literal>\\b(?:true|false|null|undefined)\\b)',
    '(?<number>\\b\\d+(?:\\.\\d+)?\\b)',
    '(?<fn>\\b[A-Za-z_$][\\w$]*(?=\\s*\\())',
    '(?<prop>\\b[A-Za-z_$][\\w$]*(?=\\s*:))',
    '(?<ident>\\b[A-Za-z_$][\\w$]*\\b)',
  ].join('|'),
  'g',
);

const CLASS: Record<string, string> = {
  comment: 'tk-comment',
  string: 'tk-string',
  keyword: 'tk-keyword',
  literal: 'tk-literal',
  number: 'tk-number',
  fn: 'tk-fn',
  prop: 'tk-prop',
  ident: 'tk-ident',
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlight(code: string): string {
  let out = '';
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(code); m; m = TOKEN.exec(code)) {
    out += escapeHtml(code.slice(last, m.index));
    const groups = m.groups ?? {};
    const kind = Object.keys(groups).find((k) => groups[k] !== undefined);
    const text = escapeHtml(m[0]);
    out += kind ? `<span class="${CLASS[kind]}">${text}</span>` : text;
    last = m.index + m[0].length;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

const COPY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <rect x="5.5" y="1.5" width="9" height="11" rx="1.6"></rect>
  <path d="M10.5 14.5h-8a1 1 0 0 1-1-1v-9"></path>
</svg>`;

const CHECK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path d="M2.5 8.5l3.5 3.5 7.5-8"></path>
</svg>`;

export interface CodeCard {
  el: HTMLElement;
  destroy(): void;
}

export function createCodeCard(code: string, label = 'code example'): CodeCard {
  const el = document.createElement('figure');
  el.className = 'code-card';

  const pre = document.createElement('pre');
  pre.setAttribute('aria-label', label);
  const codeEl = document.createElement('code');
  codeEl.innerHTML = highlight(code);
  pre.appendChild(codeEl);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-card__copy';
  button.innerHTML = COPY_ICON;
  button.setAttribute('aria-label', 'Copy code');

  let resetTimer = 0;
  const onClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard can be unavailable (insecure context, headless run) - the
      // button still gives feedback so the interaction never looks broken.
    }
    button.innerHTML = CHECK_ICON;
    button.classList.add('is-copied');
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      button.innerHTML = COPY_ICON;
      button.classList.remove('is-copied');
    }, 1400);
  };
  button.addEventListener('click', onClick);

  el.append(pre, button);

  return {
    el,
    destroy(): void {
      window.clearTimeout(resetTimer);
      button.removeEventListener('click', onClick);
      el.remove();
    },
  };
}

/** The small pill that shows the install command in the hero. */
export function createInstallButton(command: string): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'install-pill';
  el.innerHTML = `<code>${escapeHtml(command)}</code>${COPY_ICON}`;
  el.setAttribute('aria-label', `Copy ${command}`);
  el.addEventListener('click', () => {
    void navigator.clipboard?.writeText(command).catch(() => undefined);
    el.classList.add('is-copied');
    window.setTimeout(() => el.classList.remove('is-copied'), 1200);
  });
  return el;
}
