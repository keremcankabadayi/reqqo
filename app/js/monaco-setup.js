class CodeEditor {
  constructor() {
    this.requestEditor = null;
    this.responseEditor = null;
    this.requestHighlight = null;
    this.responseHighlight = null;
  }

  async init() {
    this.createRequestEditor();
    this.createResponseEditor();
  }

  createRequestEditor() {
    const container = document.getElementById('requestBodyEditor');
    if (!container) return;

    container.innerHTML = `
      <div class="code-editor-wrapper">
        <div class="code-editor-highlight" id="requestHighlight"></div>
        <textarea class="code-editor-textarea" id="requestTextarea" spellcheck="false" placeholder="Enter request body..."></textarea>
      </div>
    `;

    this.requestEditor = document.getElementById('requestTextarea');
    this.requestHighlight = document.getElementById('requestHighlight');

    this.requestEditor.addEventListener('input', () => {
      this.updateHighlight(this.requestEditor, this.requestHighlight, 'json');
      if (window.app) {
        window.app.currentRequest.body = this.getRequestBody();
      }
    });

    this.requestEditor.addEventListener('scroll', () => {
      this.requestHighlight.scrollTop = this.requestEditor.scrollTop;
      this.requestHighlight.scrollLeft = this.requestEditor.scrollLeft;
    });

    this.requestEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.requestEditor.selectionStart;
        const end = this.requestEditor.selectionEnd;
        this.requestEditor.value = this.requestEditor.value.substring(0, start) + '  ' + this.requestEditor.value.substring(end);
        this.requestEditor.selectionStart = this.requestEditor.selectionEnd = start + 2;
        this.updateHighlight(this.requestEditor, this.requestHighlight, 'json');
      }
    });
  }

  createResponseEditor() {
    const container = document.getElementById('responseBodyEditor');
    if (!container) return;

    container.innerHTML = `
      <div class="code-editor-wrapper readonly">
        <div class="code-editor-highlight" id="responseHighlight">// Send a request to see the response</div>
      </div>
    `;

    this.responseHighlight = document.getElementById('responseHighlight');
  }

  updateHighlight(textarea, highlight, language) {
    const code = textarea.value;
    highlight.innerHTML = this.syntaxHighlight(code, language) + '\n';
  }

  syntaxHighlight(code, language) {
    if (!code) return '';
    
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (language === 'json') {
      escaped = escaped.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = 'hl-number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'hl-key';
              match = match.replace(/:$/, '') + '<span class="hl-punctuation">:</span>';
            } else {
              cls = 'hl-string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'hl-boolean';
          } else if (/null/.test(match)) {
            cls = 'hl-null';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );

      escaped = escaped.replace(/([{}[\],])/g, '<span class="hl-punctuation">$1</span>');
    }

    return escaped;
  }

  getRequestBody() {
    if (this.requestEditor) {
      return this.requestEditor.value;
    }
    return '';
  }

  setRequestBody(value) {
    if (this.requestEditor) {
      this.requestEditor.value = value || '';
      this.updateHighlight(this.requestEditor, this.requestHighlight, 'json');
    }
  }

  setResponseBody(value, language = 'json') {
    if (this.responseHighlight) {
      if (language === 'json' && value) {
        try {
          const parsed = JSON.parse(value);
          value = JSON.stringify(parsed, null, 2);
        } catch {}
      }
      this.responseHighlight.innerHTML = this.syntaxHighlight(value || '', language);
    }
  }

  formatRequestBody() {
    if (this.requestEditor) {
      try {
        const parsed = JSON.parse(this.requestEditor.value);
        this.requestEditor.value = JSON.stringify(parsed, null, 2);
        this.updateHighlight(this.requestEditor, this.requestHighlight, 'json');
      } catch {}
    }
  }

  formatResponseBody() {}

  setRequestLanguage(language) {}

  getResponseBody() {
    if (this.responseHighlight) {
      return this.responseHighlight.textContent;
    }
    return '';
  }
}

const monacoSetup = new CodeEditor();
