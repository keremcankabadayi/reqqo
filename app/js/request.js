class RequestManager {
  constructor() {
    this.abortController = null;
    this.grantedOrigins = new Set();
  }

  // Snapshot the origins Chrome has already granted, and follow changes to
  // them. The send path needs to know whether it holds access *synchronously*:
  // asking Chrome would mean an await, and an await before
  // permissions.request() discards the click gesture that call requires. So the
  // question is answered from this cache instead.
  async loadGrantedOrigins() {
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      return;
    }

    try {
      const current = await chrome.permissions.getAll();
      this.grantedOrigins = new Set(current.origins || []);

      chrome.permissions.onAdded.addListener((added) => {
        (added.origins || []).forEach((origin) => this.grantedOrigins.add(origin));
      });
      chrome.permissions.onRemoved.addListener((removed) => {
        (removed.origins || []).forEach((origin) => this.grantedOrigins.delete(origin));
      });
    } catch (error) {
      // Leave the cache empty: ensureHostPermission() still falls back to
      // request(), which is a no-op prompt-wise when access is already held.
      console.warn('Could not read granted host permissions:', error);
    }
  }

  hasHostPermission(origin) {
    return this.grantedOrigins.has('<all_urls>') || this.grantedOrigins.has(origin);
  }

  addProtocolIfMissing(url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('localhost') || url.startsWith('127.0.0.1') || url.match(/^(\d{1,3}\.){3}\d{1,3}/)) {
      return `http://${url}`;
    }
    return `https://${url}`;
  }

  // Chrome match patterns cover every port on a host and reject an explicit
  // one, so the port is deliberately dropped here.
  originPatternFor(url) {
    try {
      const urlObj = new URL(this.addProtocolIfMissing(url.trim()));
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return null;
      }
      return `${urlObj.protocol}//${urlObj.hostname}/*`;
    } catch {
      return null;
    }
  }

  // <all_urls> is optional rather than granted at install, so each origin has to
  // be requested the first time it is used. Chrome requires a user gesture for
  // permissions.request(), and an await before this call discards that gesture —
  // callers must reach it directly from the click that started the action.
  // Already-granted origins resolve immediately without showing a prompt.
  async ensureHostPermission(url) {
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      return { granted: true };
    }

    const origin = this.originPatternFor(url);
    if (!origin) {
      // Not an address we can express as a match pattern; let fetch report it.
      return { granted: true };
    }

    // The pattern covers the whole host, so every path and query string on a
    // host the user has already approved goes straight through — request() is
    // never reached, and no second prompt is possible.
    if (this.hasHostPermission(origin)) {
      return { granted: true };
    }

    try {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (granted) {
        this.grantedOrigins.add(origin);
        return { granted: true };
      }
      return {
        granted: false,
        error: `Reqqo needs your permission to reach ${origin} before it can send this request.`
      };
    } catch (error) {
      return {
        granted: false,
        error: `Could not request access to ${origin} (${error.message}). Try the action again.`
      };
    }
  }

  buildUrl(baseUrl, params = []) {
    let url = baseUrl.trim();
    
    const enabledParams = params.filter(p => p.enabled && p.key);
    const usedPathParams = new Set();
    
    enabledParams.forEach(param => {
      const key = placeholderManager.replacePlaceholders(param.key);
      const value = placeholderManager.replacePlaceholders(param.value || '');
      
      const pathParamPattern = new RegExp(`\\{${key}\\}`, 'g');
      if (pathParamPattern.test(url)) {
        url = url.replace(pathParamPattern, encodeURIComponent(value));
        usedPathParams.add(key);
      }
    });
    
    const queryParams = enabledParams.filter(p => {
      const key = placeholderManager.replacePlaceholders(p.key);
      return !usedPathParams.has(key);
    });

    const urlObj = new URL(this.addProtocolIfMissing(url));
    
    urlObj.search = '';
    
    queryParams.forEach(param => {
      const key = placeholderManager.replacePlaceholders(param.key);
      const value = placeholderManager.replacePlaceholders(param.value || '');
      urlObj.searchParams.append(key, value);
    });

    return urlObj.toString();
  }

  buildHeaders(headersList = []) {
    const headers = {};
    
    headersList
      .filter(h => h.enabled && h.key)
      .forEach(header => {
        const key = placeholderManager.replacePlaceholders(header.key);
        const value = placeholderManager.replacePlaceholders(header.value || '');
        headers[key] = value;
      });

    return authManager.applyAuthToHeaders(headers);
  }

  buildBody(bodyType, bodyContent, formDataArray) {
    if (bodyType === 'none') {
      return null;
    }

    switch (bodyType) {
      case 'json':
        if (!bodyContent) return null;
        const processedJson = placeholderManager.replacePlaceholders(bodyContent);
        try {
          JSON.parse(processedJson);
          return processedJson;
        } catch {
          return processedJson;
        }

      case 'form-data':
        if (!formDataArray || !Array.isArray(formDataArray)) return null;
        const formData = new FormData();
        formDataArray
          .filter(item => item.enabled && item.key)
          .forEach(item => {
            const key = placeholderManager.replacePlaceholders(item.key);
            const value = placeholderManager.replacePlaceholders(item.value || '');
            formData.append(key, value);
          });
        return formData;

      case 'raw':
        if (!bodyContent) return null;
        return placeholderManager.replacePlaceholders(bodyContent);

      default:
        return null;
    }
  }

  async send(config) {
    const { method, url, headers, params, bodyType, body, formData, collectionId, collectionName, requestName } = config;

    this.abortController = new AbortController();
    const startTime = performance.now();
    
    const timeoutId = setTimeout(() => {
      this.abortController.abort();
    }, 30000);

    try {
      const finalUrl = this.buildUrl(
        placeholderManager.replacePlaceholders(url),
        params
      );
      const finalHeaders = this.buildHeaders(headers);
      const finalBody = this.buildBody(bodyType, body, formData);

      // Browsers don't allow GET/HEAD requests with body, even with XHR
      // For Elasticsearch and similar APIs, we convert GET with body to POST
      let effectiveMethod = method;
      if ((method === 'GET' || method === 'HEAD') && finalBody && !(finalBody instanceof FormData)) {
        effectiveMethod = 'POST';
        console.warn(`Converting ${method} request to POST because it has a body (browser limitation)`);
      }

      const fetchOptions = {
        method: effectiveMethod,
        headers: finalHeaders,
        signal: this.abortController.signal,
        credentials: 'omit'
      };

      if (finalBody && effectiveMethod !== 'HEAD') {
        fetchOptions.body = finalBody;
        
        if (bodyType === 'form-data' && finalBody instanceof FormData) {
          delete finalHeaders['Content-Type'];
        }
      }

      const response = await fetch(finalUrl, fetchOptions);
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody;
      let responseSize = 0;
      const contentType = response.headers.get('content-type') || '';

      try {
        const text = await response.text();
        responseSize = new Blob([text]).size;

        if (contentType.includes('application/json')) {
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
        } else {
          responseBody = text;
        }
      } catch {
        responseBody = '';
      }

      clearTimeout(timeoutId);

      const result = {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        duration,
        size: responseSize,
        url: finalUrl
      };

      await historyManager.addToHistory({
        method,
        url: url,
        collectionId: collectionId || null,
        collectionName: collectionName || null,
        requestName: requestName || null,
        requestHeaders: finalHeaders,
        requestBody: body,
        requestParams: params || [],
        bodyType: bodyType || 'json',
        response: result
      });

      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (error.name === 'AbortError') {
        const message = duration >= 30000 ? 'Request timeout (30s)' : 'Request was cancelled';
        return {
          success: false,
          error: message,
          duration
        };
      }

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  syntaxHighlightJSON(json) {
    if (typeof json === 'object') {
      json = JSON.stringify(json, null, 2);
    }
    
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }
}

const requestManager = new RequestManager();

