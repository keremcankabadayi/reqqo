class App {
  constructor() {
    this.currentRequest = {
      id: null,
      name: '',
      method: 'GET',
      url: '',
      headers: [{ enabled: true, key: 'Content-Type', value: 'application/json' }],
      params: [{ enabled: true, key: '', value: '' }],
      bodyType: 'json',
      body: '',
      formData: [{ enabled: true, key: '', value: '' }],
      rawBody: ''
    };
    this.isLoading = false;
  }

  async init() {
    await storage.ensureDB();
    await placeholderManager.loadEnvironments();
    await collectionsManager.loadCollections();

    this.bindEvents();
    this.renderCollections();
    this.renderHistory();
    this.renderEnvironments();
    this.updateMethodColor();
    this.switchBodyType('json');
  }

  bindEvents() {
    document.getElementById('sendBtn').addEventListener('click', () => this.sendRequest());
    document.getElementById('saveBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSaveDropdown();
    });
    document.getElementById('saveAsNewBtn').addEventListener('click', () => this.saveAsNew());
    document.getElementById('updateRequestBtn').addEventListener('click', () => this.updateCurrentRequest());
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.save-dropdown')) {
        this.closeSaveDropdown();
      }
    });
    document.getElementById('newRequestBtn').addEventListener('click', () => this.newRequest());
    
    document.getElementById('requestMethod').addEventListener('change', (e) => {
      this.currentRequest.method = e.target.value;
      this.updateMethodColor();
    });

    document.getElementById('requestUrl').addEventListener('input', (e) => {
      this.currentRequest.url = e.target.value;
    });

    document.getElementById('requestUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendRequest();
      }
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchSidebarTab(tab.dataset.tab));
    });

    document.querySelectorAll('.request-tabs .tab-btn').forEach(tab => {
      tab.addEventListener('click', () => this.switchRequestTab(tab.dataset.panel));
    });

    document.querySelectorAll('.response-tabs .tab-btn').forEach(tab => {
      tab.addEventListener('click', () => this.switchResponseTab(tab.dataset.panel));
    });

    document.querySelectorAll('[name="bodyType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.currentRequest.bodyType = e.target.value;
        this.switchBodyType(e.target.value);
      });
    });
    
    this.bindKeyValueEvents('formDataRows');
    
    document.querySelector('.add-row-btn[data-target="formDataRows"]')?.addEventListener('click', () => {
      this.addKeyValueRow('formDataRows');
    });
    
    document.getElementById('rawBodyEditor')?.addEventListener('input', (e) => {
      this.currentRequest.rawBody = e.target.value;
    });

    document.getElementById('authType').addEventListener('change', (e) => {
      this.switchAuthType(e.target.value);
    });

    document.getElementById('basicUsername').addEventListener('input', () => this.updateAuth());
    document.getElementById('basicPassword').addEventListener('input', () => this.updateAuth());
    document.getElementById('bearerToken').addEventListener('input', () => this.updateAuth());

    document.getElementById('getOAuth2Token').addEventListener('click', () => this.getOAuth2Token());

    document.querySelectorAll('.add-row-btn').forEach(btn => {
      btn.addEventListener('click', () => this.addKeyValueRow(btn.dataset.target));
    });

    this.bindKeyValueEvents('paramsRows');
    this.bindKeyValueEvents('headersRows');

    document.getElementById('createCollectionBtn').addEventListener('click', () => this.openCreateCollectionModal());
    document.getElementById('confirmCreateCollection').addEventListener('click', () => this.createCollection());
    document.getElementById('confirmSaveRequest').addEventListener('click', () => this.saveRequest());
    
    document.getElementById('exportCollectionBtn').addEventListener('click', () => this.exportCollections());
    document.getElementById('importCollectionBtn').addEventListener('click', () => this.triggerImport());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.importCollections(e));

    document.getElementById('addCollectionInModal').addEventListener('click', () => this.showNewCollectionInput());
    document.getElementById('confirmNewCollection').addEventListener('click', () => this.createCollectionInModal());
    document.getElementById('cancelNewCollection').addEventListener('click', () => this.hideNewCollectionInput());

    document.getElementById('manageEnvsBtn').addEventListener('click', () => this.openEnvironmentModal());
    document.getElementById('addEnvironmentBtn').addEventListener('click', () => this.addEnvironment());
    document.getElementById('saveEnvironment').addEventListener('click', () => this.saveEnvironment());

    document.getElementById('activeEnvironment').addEventListener('change', async (e) => {
      await placeholderManager.setActiveEnvironment(e.target.value);
    });

    document.getElementById('copyResponseBtn').addEventListener('click', () => this.copyResponse());

    document.getElementById('responseFormat').addEventListener('change', () => this.formatResponse());

    document.querySelectorAll('.modal-close, .modal-cancel, .modal-overlay').forEach(el => {
      el.addEventListener('click', () => this.closeModals());
    });

    document.querySelectorAll('.modal-content').forEach(modal => {
      modal.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  updateMethodColor() {
    const select = document.getElementById('requestMethod');
    const method = select.value.toLowerCase();
    select.style.color = `var(--method-${method})`;
  }

  switchSidebarTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.sidebar-content .tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  switchRequestTab(panelName) {
    document.querySelectorAll('.request-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelector(`.request-tabs .tab-btn[data-panel="${panelName}"]`).classList.add('active');

    document.querySelectorAll('.request-panels .panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${panelName}Panel`).classList.add('active');
  }

  switchResponseTab(panelName) {
    document.querySelectorAll('.response-tabs .tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelector(`.response-tabs .tab-btn[data-panel="${panelName}"]`).classList.add('active');

    document.querySelectorAll('.response-panels .panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${panelName}Panel`).classList.add('active');
  }

  switchBodyType(type) {
    document.querySelectorAll('.body-type-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const targetContent = document.querySelector(`.body-type-content[data-body-type="${type}"]`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
  }

  switchAuthType(type) {
    document.querySelectorAll('.auth-content > div').forEach(d => d.classList.remove('active'));
    document.querySelector(`.auth-content [data-auth="${type}"]`).classList.add('active');
    authManager.setAuth(type, {});
    this.updateAuth();
  }

  updateAuth() {
    const type = document.getElementById('authType').value;
    
    switch (type) {
      case 'basic':
        authManager.setAuth('basic', {
          username: document.getElementById('basicUsername').value,
          password: document.getElementById('basicPassword').value
        });
        break;
      case 'bearer':
        authManager.setAuth('bearer', {
          token: document.getElementById('bearerToken').value
        });
        break;
    }
  }

  async getOAuth2Token() {
    const config = {
      grantType: document.getElementById('oauth2GrantType').value,
      tokenUrl: document.getElementById('oauth2TokenUrl').value,
      clientId: document.getElementById('oauth2ClientId').value,
      clientSecret: document.getElementById('oauth2ClientSecret').value
    };

    const btn = document.getElementById('getOAuth2Token');
    btn.textContent = 'Getting token...';
    btn.disabled = true;

    const result = await authManager.fetchOAuth2Token(config);

    btn.textContent = 'Get Token';
    btn.disabled = false;

    if (result.success) {
      alert('Token obtained successfully!');
    } else {
      alert(`Failed to get token: ${result.error}`);
    }
  }

  bindKeyValueEvents(containerId) {
    const container = document.getElementById(containerId);
    
    container.addEventListener('input', (e) => {
      if (e.target.classList.contains('kv-key') || e.target.classList.contains('kv-value')) {
        this.syncKeyValueData(containerId);
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        this.syncKeyValueData(containerId);
      }
    });

    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete')) {
        e.target.closest('.kv-row').remove();
        this.syncKeyValueData(containerId);
      }
    });
  }

  syncKeyValueData(containerId) {
    const container = document.getElementById(containerId);
    const rows = container.querySelectorAll('.kv-row');
    const data = [];

    rows.forEach(row => {
      const enabled = row.querySelector('input[type="checkbox"]').checked;
      const key = row.querySelector('.kv-key').value;
      const value = row.querySelector('.kv-value').value;
      data.push({ enabled, key, value });
    });

    if (containerId === 'paramsRows') {
      this.currentRequest.params = data;
    } else if (containerId === 'headersRows') {
      this.currentRequest.headers = data;
    } else if (containerId === 'formDataRows') {
      this.currentRequest.formData = data;
    }
  }

  addKeyValueRow(containerId) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="checkbox" checked>
      <input type="text" placeholder="Key" class="kv-key">
      <input type="text" placeholder="Value" class="kv-value">
      <button class="btn-icon btn-delete">×</button>
    `;
    container.appendChild(row);
  }

  async sendRequest() {
    const url = document.getElementById('requestUrl').value.trim();
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    this.setLoading(true);
    
    const body = this.getBodyForCurrentType();

    const result = await requestManager.send({
      method: this.currentRequest.method,
      url: url,
      headers: this.currentRequest.headers,
      params: this.currentRequest.params,
      bodyType: this.currentRequest.bodyType,
      body: body,
      formData: this.currentRequest.formData
    });

    this.setLoading(false);
    this.displayResponse(result);
    this.renderHistory();
  }

  getBodyForCurrentType() {
    switch (this.currentRequest.bodyType) {
      case 'none':
        return null;
      case 'json':
        return typeof getRequestBody === 'function' ? getRequestBody() : this.currentRequest.body;
      case 'form-data':
        return this.currentRequest.formData;
      case 'raw':
        return document.getElementById('rawBodyEditor')?.value || this.currentRequest.rawBody;
      default:
        return null;
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    const btn = document.getElementById('sendBtn');
    
    if (loading) {
      btn.innerHTML = '<span>Sending...</span>';
      btn.classList.add('loading');
    } else {
      btn.innerHTML = `
        <span>Send</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 8l12-6-4 6 4 6z"/>
        </svg>
      `;
      btn.classList.remove('loading');
    }
  }

  displayResponse(result) {
    const statusBadge = document.querySelector('.status-badge');
    const responseTime = document.getElementById('responseTime');
    const responseSize = document.getElementById('responseSize');
    const responseHeadersList = document.getElementById('responseHeadersList');

    if (result.success) {
      const statusClass = result.status < 300 ? 'success' : (result.status < 400 ? 'warning' : 'error');
      statusBadge.className = `status-badge ${statusClass}`;
      statusBadge.textContent = `${result.status} ${result.statusText}`;

      responseTime.textContent = requestManager.formatDuration(result.duration);
      responseSize.textContent = requestManager.formatBytes(result.size);

      let bodyText = '';
      if (typeof result.body === 'object') {
        bodyText = JSON.stringify(result.body, null, 2);
      } else {
        bodyText = result.body || '';
      }
      
      if (typeof setResponseBody === 'function') {
        setResponseBody(bodyText);
      }

      responseHeadersList.innerHTML = '';
      Object.entries(result.headers).forEach(([name, value]) => {
        const item = document.createElement('div');
        item.className = 'response-header-item';
        item.innerHTML = `
          <span class="header-name">${this.escapeHtml(name)}</span>
          <span class="header-value">${this.escapeHtml(value)}</span>
        `;
        responseHeadersList.appendChild(item);
      });
    } else {
      statusBadge.className = 'status-badge error';
      statusBadge.textContent = 'Error';
      responseTime.textContent = requestManager.formatDuration(result.duration);
      responseSize.textContent = '--';
      
      if (typeof setResponseBody === 'function') {
        setResponseBody(`Error: ${result.error}`);
      }
      responseHeadersList.innerHTML = '';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async copyResponse() {
    const text = typeof getResponseBody === 'function' ? getResponseBody() : '';
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('copyResponseBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    } catch {
      alert('Failed to copy to clipboard');
    }
  }

  formatResponse() {
    // JSON Editor handles format internally via mode change
  }

  newRequest() {
    this.currentRequest = {
      id: null,
      name: '',
      method: 'GET',
      url: '',
      headers: [{ enabled: true, key: 'Content-Type', value: 'application/json' }],
      params: [{ enabled: true, key: '', value: '' }],
      bodyType: 'json',
      body: '',
      formData: [{ enabled: true, key: '', value: '' }],
      rawBody: ''
    };

    document.getElementById('requestMethod').value = 'GET';
    document.getElementById('requestUrl').value = '';
    if (typeof setRequestBody === 'function') {
      setRequestBody('');
    }
    document.querySelector('[name="bodyType"][value="json"]').checked = true;
    this.switchBodyType('json');

    this.renderKeyValueRows('headersRows', this.currentRequest.headers);
    this.renderKeyValueRows('paramsRows', this.currentRequest.params);
    this.renderKeyValueRows('formDataRows', this.currentRequest.formData);
    
    const rawEditor = document.getElementById('rawBodyEditor');
    if (rawEditor) rawEditor.value = '';

    document.getElementById('authType').value = 'none';
    this.switchAuthType('none');

    this.updateMethodColor();
    this.updateSaveButtonState();
  }

  renderKeyValueRows(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'kv-row';
      row.innerHTML = `
        <input type="checkbox" ${item.enabled ? 'checked' : ''}>
        <input type="text" placeholder="Key" class="kv-key" value="${this.escapeHtml(item.key || '')}">
        <input type="text" placeholder="Value" class="kv-value" value="${this.escapeHtml(item.value || '')}">
        <button class="btn-icon btn-delete">×</button>
      `;
      container.appendChild(row);
    });
  }

  loadRequest(request) {
    this.currentRequest = { 
      ...request,
      formData: request.formData || [{ enabled: true, key: '', value: '' }],
      rawBody: request.rawBody || ''
    };

    document.getElementById('requestMethod').value = request.method;
    document.getElementById('requestUrl').value = request.url;
    
    const bodyType = request.bodyType || 'none';
    const bodyTypeRadio = document.querySelector(`[name="bodyType"][value="${bodyType}"]`);
    if (bodyTypeRadio) bodyTypeRadio.checked = true;
    this.switchBodyType(bodyType);
    
    if (bodyType === 'json' && typeof setRequestBody === 'function') {
      setRequestBody(request.body || '');
    }
    
    this.renderKeyValueRows('formDataRows', this.currentRequest.formData);
    
    const rawEditor = document.getElementById('rawBodyEditor');
    if (rawEditor) rawEditor.value = this.currentRequest.rawBody;

    this.renderKeyValueRows('headersRows', request.headers || []);
    this.renderKeyValueRows('paramsRows', request.params || []);

    if (request.auth) {
      document.getElementById('authType').value = request.auth.type;
      this.switchAuthType(request.auth.type);
      
      if (request.auth.type === 'basic') {
        document.getElementById('basicUsername').value = request.auth.data.username || '';
        document.getElementById('basicPassword').value = request.auth.data.password || '';
      } else if (request.auth.type === 'bearer') {
        document.getElementById('bearerToken').value = request.auth.data.token || '';
      }
    }

    this.updateMethodColor();
    this.updateSaveButtonState();
  }

  updateSaveButtonState() {
    const saveBtn = document.getElementById('saveBtn');
    const updateBtn = document.getElementById('updateRequestBtn');
    const isExisting = this.currentRequest.id !== null;
    
    saveBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M11 13H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5l4 4v8a1 1 0 0 1-1 1z"/>
        <path d="M8 1v4h4"/>
      </svg>
      <span>Save</span>
      <svg class="dropdown-arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M2 4l3 3 3-3"/>
      </svg>
    `;
    
    if (isExisting) {
      updateBtn.disabled = false;
      updateBtn.classList.add('update-item');
    } else {
      updateBtn.disabled = true;
      updateBtn.classList.remove('update-item');
    }
    
    this.highlightActiveRequest();
  }

  toggleSaveDropdown() {
    const dropdown = document.getElementById('saveDropdown');
    dropdown.classList.toggle('open');
  }

  closeSaveDropdown() {
    const dropdown = document.getElementById('saveDropdown');
    dropdown.classList.remove('open');
  }

  saveAsNew() {
    this.closeSaveDropdown();
    const originalId = this.currentRequest.id;
    this.currentRequest.id = null;
    this.openSaveModal();
    this.currentRequest.id = originalId;
  }

  updateCurrentRequest() {
    this.closeSaveDropdown();
    
    if (!this.currentRequest.id) {
      alert('No request loaded to update');
      return;
    }

    this.openUpdateModal();
  }

  openUpdateModal() {
    const modal = document.getElementById('saveRequestModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const confirmBtn = document.getElementById('confirmSaveRequest');
    const collectionSelect = document.getElementById('saveRequestCollection');
    const collectionGroup = collectionSelect.closest('.form-group');
    
    document.getElementById('saveRequestName').value = this.currentRequest.name;
    this.hideNewCollectionInput();
    
    if (this.currentRequest.collectionId) {
      collectionSelect.value = this.currentRequest.collectionId;
    } else {
      collectionSelect.value = '';
    }
    
    modalTitle.textContent = 'Update Request';
    confirmBtn.textContent = 'Update';
    confirmBtn.classList.add('btn-update');
    collectionGroup.style.display = 'block';
    
    modal.dataset.mode = 'update';
    modal.classList.add('active');
  }

  highlightActiveRequest() {
    document.querySelectorAll('.request-item').forEach(item => {
      item.classList.remove('active');
    });
    
    if (this.currentRequest.id) {
      const activeItem = document.querySelector(`.request-item[data-id="${this.currentRequest.id}"]`);
      if (activeItem) {
        activeItem.classList.add('active');
      }
    }
  }

  async renderCollections() {
    const container = document.getElementById('collectionsList');
    const collections = await collectionsManager.loadCollections();

    if (collections.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No collections yet</p>
          <button class="btn btn-primary btn-sm" id="createCollectionBtn">Create Collection</button>
        </div>
      `;
      document.getElementById('createCollectionBtn').addEventListener('click', () => this.openCreateCollectionModal());
      return;
    }

    container.innerHTML = '';

    for (const collection of collections) {
      const requests = await collectionsManager.getRequestsInCollection(collection.id);
      
      const collectionEl = document.createElement('div');
      collectionEl.className = 'collection-group';
      collectionEl.innerHTML = `
        <div class="collection-header" data-id="${collection.id}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 3h10M2 7h10M2 11h10"/>
          </svg>
          <span class="collection-name">${this.escapeHtml(collection.name)}</span>
          <span class="badge">${requests.length}</span>
          <div class="collection-actions">
            <button class="action-btn edit" title="Edit Collection" data-collection-id="${collection.id}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8.5 1.5l2 2M1 11l.5-2L9 1.5l2 2L3.5 11z"/>
              </svg>
            </button>
            <button class="action-btn delete" title="Delete Collection" data-collection-id="${collection.id}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 3h8M4 3V2h4v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="collection-requests" data-collection="${collection.id}"></div>
      `;

      collectionEl.querySelector('.action-btn.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.editCollection(collection);
      });

      collectionEl.querySelector('.action-btn.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteCollection(collection.id);
      });

      const requestsContainer = collectionEl.querySelector('.collection-requests');
      requests.forEach(req => {
        const reqEl = document.createElement('div');
        reqEl.className = 'request-item';
        reqEl.dataset.id = req.id;
        reqEl.innerHTML = `
          <span class="method-badge ${req.method.toLowerCase()}">${req.method}</span>
          <span class="request-name">${this.escapeHtml(req.name)}</span>
          <div class="request-actions">
            <button class="action-btn duplicate" title="Duplicate">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="4" width="6" height="6" rx="1"/>
                <path d="M8 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v4a1 1 0 001 1h1"/>
              </svg>
            </button>
            <button class="action-btn delete" title="Delete">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 3h8M4 3V2h4v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3"/>
              </svg>
            </button>
          </div>
        `;
        
        reqEl.addEventListener('click', (e) => {
          if (!e.target.closest('.request-actions')) {
            this.loadRequest(req);
          }
        });

        reqEl.querySelector('.action-btn.duplicate').addEventListener('click', (e) => {
          e.stopPropagation();
          this.duplicateRequest(req.id);
        });

        reqEl.querySelector('.action-btn.delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteRequest(req.id);
        });

        requestsContainer.appendChild(reqEl);
      });

      container.appendChild(collectionEl);
    }

    this.updateSaveRequestCollectionSelect();
  }

  async deleteRequest(requestId) {
    if (confirm('Are you sure you want to delete this request?')) {
      await collectionsManager.deleteRequest(requestId);
      if (this.currentRequest.id === requestId) {
        this.newRequest();
      }
      this.renderCollections();
    }
  }

  async duplicateRequest(requestId) {
    await collectionsManager.duplicateRequest(requestId);
    this.renderCollections();
  }

  async deleteCollection(collectionId) {
    if (confirm('Are you sure you want to delete this collection and all its requests?')) {
      await collectionsManager.deleteCollection(collectionId);
      this.renderCollections();
    }
  }

  editCollection(collection) {
    const newName = prompt('Enter new collection name:', collection.name);
    if (newName && newName.trim() !== collection.name) {
      collectionsManager.updateCollection(collection.id, newName.trim());
      this.renderCollections();
    }
  }

  async renderHistory() {
    const container = document.getElementById('historyList');
    const history = await historyManager.getHistory();

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No requests yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    const groups = historyManager.groupHistoryByDate(history);

    const renderGroup = (title, items) => {
      if (items.length === 0) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'history-group';
      groupEl.innerHTML = `<div class="history-group-title">${title}</div>`;

      items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'history-item';
        itemEl.innerHTML = `
          <span class="method-badge ${item.method.toLowerCase()}">${item.method}</span>
          <span class="history-url">${this.escapeHtml(this.truncateUrl(item.url))}</span>
          <div class="history-actions">
            <button class="action-btn save" title="Save to Collection">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 10H3a1 1 0 01-1-1V3a1 1 0 011-1h4l3 3v5a1 1 0 01-1 1z"/>
                <path d="M7 2v3h3"/>
              </svg>
            </button>
            <button class="action-btn delete" title="Delete">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 3h8M4 3V2h4v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3"/>
              </svg>
            </button>
          </div>
        `;
        
        itemEl.addEventListener('click', (e) => {
          if (!e.target.closest('.history-actions')) {
            document.getElementById('requestMethod').value = item.method;
            document.getElementById('requestUrl').value = item.url;
            this.currentRequest.method = item.method;
            this.currentRequest.url = item.url;
            this.updateMethodColor();
          }
        });

        itemEl.querySelector('.action-btn.save').addEventListener('click', (e) => {
          e.stopPropagation();
          this.saveHistoryItemToCollection(item);
        });

        itemEl.querySelector('.action-btn.delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteHistoryItem(item.id);
        });

        groupEl.appendChild(itemEl);
      });

      container.appendChild(groupEl);
    };

    renderGroup('Today', groups.today);
    renderGroup('Yesterday', groups.yesterday);
    renderGroup('This Week', groups.thisWeek);
    renderGroup('Older', groups.older);
  }

  async deleteHistoryItem(historyId) {
    await historyManager.deleteHistoryItem(historyId);
    this.renderHistory();
  }

  saveHistoryItemToCollection(historyItem) {
    document.getElementById('requestMethod').value = historyItem.method;
    document.getElementById('requestUrl').value = historyItem.url;
    this.currentRequest.method = historyItem.method;
    this.currentRequest.url = historyItem.url;
    this.currentRequest.id = null;
    this.updateMethodColor();
    this.openSaveModal();
  }

  truncateUrl(url) {
    if (url.length <= 40) return url;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname.substring(0, 20) + '...';
    } catch {
      return url.substring(0, 40) + '...';
    }
  }

  async renderEnvironments() {
    const envs = await placeholderManager.loadEnvironments();
    const select = document.getElementById('activeEnvironment');
    
    select.innerHTML = '<option value="">No Environment</option>';
    envs.forEach(env => {
      const option = document.createElement('option');
      option.value = env.id;
      option.textContent = env.name;
      select.appendChild(option);
    });
  }

  openCreateCollectionModal() {
    document.getElementById('collectionName').value = '';
    document.getElementById('createCollectionModal').classList.add('active');
  }

  async createCollection() {
    const name = document.getElementById('collectionName').value.trim();
    if (!name) {
      alert('Please enter a collection name');
      return;
    }

    await collectionsManager.createCollection(name);
    this.closeModals();
    this.renderCollections();
  }

  showNewCollectionInput() {
    document.getElementById('newCollectionInput').style.display = 'flex';
    document.getElementById('newCollectionName').value = '';
    document.getElementById('newCollectionName').focus();
  }

  hideNewCollectionInput() {
    document.getElementById('newCollectionInput').style.display = 'none';
    document.getElementById('newCollectionName').value = '';
  }

  async createCollectionInModal() {
    const name = document.getElementById('newCollectionName').value.trim();
    if (!name) {
      alert('Please enter a collection name');
      return;
    }

    const collection = await collectionsManager.createCollection(name);
    this.hideNewCollectionInput();
    this.updateSaveRequestCollectionSelect();
    
    document.getElementById('saveRequestCollection').value = collection.id;
    
    this.renderCollections();
  }

  openSaveModal() {
    const url = document.getElementById('requestUrl').value;
    const modal = document.getElementById('saveRequestModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const confirmBtn = document.getElementById('confirmSaveRequest');
    const collectionSelect = document.getElementById('saveRequestCollection');
    const collectionGroup = collectionSelect.closest('.form-group');
    
    document.getElementById('saveRequestName').value = this.generateRequestName(url);
    collectionSelect.value = '';
    this.hideNewCollectionInput();
    
    modalTitle.textContent = 'Save as New Request';
    confirmBtn.textContent = 'Save';
    confirmBtn.classList.remove('btn-update');
    collectionGroup.style.display = 'block';
    
    modal.dataset.mode = 'new';
    modal.classList.add('active');
  }

  generateRequestName(url) {
    if (!url) return 'New Request';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      let pathname = urlObj.pathname || '/';
      
      pathname = decodeURIComponent(pathname);
      
      const parts = pathname.split('/').filter(p => p);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (parts.length > 1) {
          return parts.slice(-2).join('/');
        }
        return lastPart;
      }
      return urlObj.hostname || 'New Request';
    } catch {
      return 'New Request';
    }
  }

  updateSaveRequestCollectionSelect() {
    const select = document.getElementById('saveRequestCollection');
    select.innerHTML = '<option value="">No Collection</option>';
    
    collectionsManager.collections.forEach(col => {
      const option = document.createElement('option');
      option.value = col.id;
      option.textContent = col.name;
      select.appendChild(option);
    });
  }

  async saveRequest() {
    const modal = document.getElementById('saveRequestModal');
    const mode = modal.dataset.mode;
    const name = document.getElementById('saveRequestName').value.trim();
    const collectionId = document.getElementById('saveRequestCollection').value || null;

    if (!name) {
      alert('Please enter a request name');
      return;
    }

    const body = typeof getRequestBody === 'function' ? getRequestBody() : this.currentRequest.body;
    const rawBody = document.getElementById('rawBodyEditor')?.value || this.currentRequest.rawBody;
    
    const requestData = {
      name,
      method: this.currentRequest.method,
      url: document.getElementById('requestUrl').value,
      headers: this.currentRequest.headers,
      params: this.currentRequest.params,
      bodyType: this.currentRequest.bodyType,
      body: body,
      formData: this.currentRequest.formData,
      rawBody: rawBody,
      auth: authManager.getAuth(),
      collectionId
    };

    if (mode === 'update' && this.currentRequest.id) {
      await collectionsManager.updateRequest(this.currentRequest.id, requestData);
      this.currentRequest = { ...this.currentRequest, name, collectionId };
    } else {
      const saved = await collectionsManager.saveRequest(requestData, collectionId);
      this.currentRequest = { ...this.currentRequest, id: saved.id, name: saved.name, collectionId };
    }

    this.closeModals();
    this.renderCollections();
    this.updateSaveButtonState();
  }

  openEnvironmentModal() {
    document.getElementById('environmentModal').classList.add('active');
    this.renderEnvironmentManager();
  }

  async renderEnvironmentManager() {
    const envs = await placeholderManager.loadEnvironments();
    const list = document.getElementById('envManagerList');
    
    list.innerHTML = '';
    envs.forEach(env => {
      const item = document.createElement('button');
      item.className = 'env-item';
      item.textContent = env.name;
      item.dataset.id = env.id;
      item.addEventListener('click', () => this.selectEnvironmentForEdit(env));
      list.appendChild(item);
    });
  }

  selectEnvironmentForEdit(env) {
    document.querySelectorAll('.env-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.env-item[data-id="${env.id}"]`)?.classList.add('active');
    
    document.getElementById('envName').value = env.name;
    document.getElementById('envName').dataset.id = env.id;
    
    const container = document.getElementById('envVarsRows');
    container.innerHTML = '';
    
    Object.entries(env.variables || {}).forEach(([key, value]) => {
      this.addEnvVariableRow(key, value);
    });
    
    if (Object.keys(env.variables || {}).length === 0) {
      this.addEnvVariableRow('', '');
    }
  }

  addEnvironment() {
    document.querySelectorAll('.env-item').forEach(i => i.classList.remove('active'));
    document.getElementById('envName').value = '';
    document.getElementById('envName').dataset.id = '';
    document.getElementById('envVarsRows').innerHTML = '';
    this.addEnvVariableRow('', '');
  }

  addEnvVariableRow(key = '', value = '') {
    const container = document.getElementById('envVarsRows');
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="checkbox" checked>
      <input type="text" placeholder="Variable" class="kv-key" value="${this.escapeHtml(key)}">
      <input type="text" placeholder="Value" class="kv-value" value="${this.escapeHtml(value)}">
      <button class="btn-icon btn-delete">×</button>
    `;
    
    row.querySelector('.btn-delete').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  async saveEnvironment() {
    const name = document.getElementById('envName').value.trim();
    const id = document.getElementById('envName').dataset.id;
    
    if (!name) {
      alert('Please enter an environment name');
      return;
    }

    const variables = {};
    document.querySelectorAll('#envVarsRows .kv-row').forEach(row => {
      const key = row.querySelector('.kv-key').value.trim();
      const value = row.querySelector('.kv-value').value;
      if (key) {
        variables[key] = value;
      }
    });

    if (id) {
      await placeholderManager.updateEnvironment(id, name, variables);
    } else {
      await placeholderManager.createEnvironment(name, variables);
    }

    this.renderEnvironmentManager();
    this.renderEnvironments();
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }

  async exportCollections() {
    try {
      const collections = await collectionsManager.getAllCollections();
      const requests = await collectionsManager.getAllRequests();
      
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        collections: collections,
        requests: requests
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `rest-client-collections-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Collections exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export collections');
    }
  }

  triggerImport() {
    document.getElementById('importFileInput').click();
  }

  async importCollections(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      let importedCollections = 0;
      let importedRequests = 0;
      
      // Check if it's Postman format
      if (data.info && data.item) {
        // Postman Collection v2.1.0 format
        const result = await this.importPostmanCollection(data);
        importedCollections = result.collections;
        importedRequests = result.requests;
      } else if (data.collections && data.requests) {
        // Our own format
        const existingCollections = await collectionsManager.getAllCollections();
        const existingRequests = await collectionsManager.getAllRequests();
        
        for (const collection of data.collections) {
          const exists = existingCollections.some(c => c.id === collection.id);
          if (!exists) {
            await collectionsManager.createCollection(collection.name, collection.id);
            importedCollections++;
          }
        }
        
        for (const request of data.requests) {
          const exists = existingRequests.some(r => r.id === request.id);
          if (!exists) {
            await collectionsManager.importRequest(request);
            importedRequests++;
          }
        }
      } else {
        throw new Error('Unrecognized file format. Supported: Postman Collection, REST Client export');
      }
      
      this.renderCollections();
      this.showNotification(`Imported ${importedCollections} collections, ${importedRequests} requests`);
      
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import: ' + error.message);
    }
    
    // Reset file input
    event.target.value = '';
  }

  async importPostmanCollection(data) {
    let importedCollections = 0;
    let importedRequests = 0;
    
    // Process each folder/collection in Postman export
    for (const folder of data.item) {
      if (!folder.item || folder.item.length === 0) continue;
      
      // Create collection for folder
      const collection = await collectionsManager.createCollection(folder.name);
      importedCollections++;
      
      // Process requests in folder
      for (const item of folder.item) {
        if (!item.request) continue;
        
        const request = item.request;
        
        // Convert Postman headers to our format
        const headers = (request.header || []).map(h => ({
          enabled: true,
          key: h.key,
          value: h.value
        }));
        
        // Add default Content-Type if not present
        if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
          headers.unshift({ enabled: true, key: 'Content-Type', value: 'application/json' });
        }
        
        // Extract params from URL
        const params = this.extractParamsFromUrl(request.url);
        
        // Get body
        let body = '';
        let bodyType = 'none';
        if (request.body) {
          if (request.body.mode === 'raw') {
            body = request.body.raw || '';
            bodyType = 'json';
          } else if (request.body.mode === 'formdata') {
            bodyType = 'form-data';
          }
        }
        
        // Save request
        await collectionsManager.saveRequest({
          name: item.name || 'Imported Request',
          method: request.method || 'GET',
          url: typeof request.url === 'string' ? request.url : request.url.raw || '',
          headers: headers,
          params: params,
          bodyType: bodyType,
          body: body,
          auth: null
        }, collection.id);
        
        importedRequests++;
      }
    }
    
    return { collections: importedCollections, requests: importedRequests };
  }

  extractParamsFromUrl(url) {
    const params = [];
    const urlStr = typeof url === 'string' ? url : url.raw || '';
    
    // Extract path parameters like {param}
    const pathParamRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = pathParamRegex.exec(urlStr)) !== null) {
      params.push({ enabled: true, key: match[1], value: '' });
    }
    
    // Extract query parameters
    try {
      const urlObj = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      urlObj.searchParams.forEach((value, key) => {
        // Don't add if it's a path param placeholder
        if (!params.some(p => p.key === key)) {
          params.push({ enabled: true, key, value });
        }
      });
    } catch (e) {
      // URL parse failed, skip query params
    }
    
    // Add empty row if no params
    if (params.length === 0) {
      params.push({ enabled: true, key: '', value: '' });
    }
    
    return params;
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

