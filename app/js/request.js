class RequestManager {
  constructor() {
    this.abortController = null;
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
    
    if (queryParams.length === 0) {
      return url;
    }

    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    
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
    const { method, url, headers, params, bodyType, body, formData } = config;

    this.abortController = new AbortController();
    const startTime = performance.now();

    try {
      const finalUrl = this.buildUrl(
        placeholderManager.replacePlaceholders(url),
        params
      );
      const finalHeaders = this.buildHeaders(headers);
      const finalBody = this.buildBody(bodyType, body, formData);

      const fetchOptions = {
        method,
        headers: finalHeaders,
        signal: this.abortController.signal,
        credentials: 'omit'
      };

      if (method !== 'GET' && method !== 'HEAD' && finalBody) {
        fetchOptions.body = finalBody;
        
        if (bodyType === 'form-data' && finalBody instanceof FormData) {
          delete finalHeaders['Content-Type'];
        }
      }

      const response = await fetch(finalUrl, fetchOptions);
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
        url: finalUrl,
        requestHeaders: finalHeaders,
        requestBody: body,
        response: result
      });

      return result;

    } catch (error) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request was cancelled',
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

