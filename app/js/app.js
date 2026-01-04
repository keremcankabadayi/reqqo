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
    this.collapsedCollections = new Set();
    this.initialRenderDone = false;
    this.isSyncingUrl = false;
    this.isSyncingParams = false;
    this.syncUrlDebounceTimer = null;
    this.tabManager = window.tabManager;
  }

  async init() {
    await storage.ensureDB();
    await placeholderManager.loadEnvironments();
    await collectionsManager.loadCollections();

    this.tabManager.loadFromLocalStorage();
    
    this.bindEvents();
    this.bindTabEvents();
    this.setupResizers();
    this.renderCollections();
    this.renderHistory();
    // this.renderEnvironments();
    
    this.renderTabs();
    this.loadActiveTab();
  }

  setupResizers() {
    // Request/Response resizer
    const resizeHandle = document.getElementById('resizeHandle');
    const requestSection = document.querySelector('.request-section');
    const responseSection = document.querySelector('.response-section');
    
    let isResizing = false;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizeHandle.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const container = document.querySelector('.content-columns');
      const containerRect = container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const percentage = (newWidth / containerRect.width) * 100;
      
      if (percentage >= 20 && percentage <= 70) {
        requestSection.style.width = `${percentage}%`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizeHandle.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
    
    // Sidebar resizer
    const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');
    const sidebar = document.querySelector('.sidebar');
    
    let isSidebarResizing = false;
    
    sidebarResizeHandle.addEventListener('mousedown', (e) => {
      isSidebarResizing = true;
      sidebarResizeHandle.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isSidebarResizing) return;
      
      const newWidth = e.clientX;
      
      if (newWidth >= 200 && newWidth <= 500) {
        sidebar.style.width = `${newWidth}px`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isSidebarResizing) {
        isSidebarResizing = false;
        sidebarResizeHandle.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  bindEvents() {
    document.getElementById('sendBtn').addEventListener('click', () => this.sendRequest());
    document.getElementById('cancelBtn').addEventListener('click', () => this.cancelRequest());
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
    document.getElementById('newRequestBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleNewDropdown();
    });
    
    document.getElementById('newRequestOption').addEventListener('click', () => {
      this.closeNewDropdown();
      this.newRequest();
    });
    
    document.getElementById('newCollectionOption').addEventListener('click', () => {
      this.closeNewDropdown();
      this.showNewCollectionModal();
    });
    
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('newDropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        this.closeNewDropdown();
      }
    });
    
    document.getElementById('requestMethod').addEventListener('change', (e) => {
      this.currentRequest.method = e.target.value;
      this.updateMethodColor();
      this.markTabDirty();
    });

    document.getElementById('requestUrl').addEventListener('input', (e) => {
      this.currentRequest.url = e.target.value;
      this.markTabDirty();
    });

    document.getElementById('requestUrl').addEventListener('blur', (e) => {
      this.syncParamsFromUrl();
    });

    document.getElementById('requestUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendRequest();
      }
    });

    document.getElementById('requestUrl').addEventListener('paste', async (e) => {
      const pastedText = e.clipboardData.getData('text').trim();
      
      if (pastedText.startsWith('curl')) {
        e.preventDefault();
        const parsed = this.parseCurlCommand(pastedText);
        if (parsed) {
          this.loadFromCurl(parsed);
        }
      } else if (this.isSwaggerUrl(pastedText)) {
        e.preventDefault();
        const confirmed = confirm('Swagger/OpenAPI document detected!\n\nDo you want to import all endpoints as a new collection?');
        if (confirmed) {
          this.importSwaggerFromUrl(pastedText);
        } else {
          document.getElementById('requestUrl').value = pastedText;
          this.currentRequest.url = pastedText;
          this.syncParamsFromUrl();
        }
      } else {
        setTimeout(() => {
          this.currentRequest.url = document.getElementById('requestUrl').value;
          this.syncParamsFromUrl();
        }, 10);
      }
    });

    document.getElementById('openInTabBtn').addEventListener('click', () => this.openInNewTab());
    document.getElementById('showCurlBtn').addEventListener('click', () => this.showCurlCommand());
    document.getElementById('copyCurlBtn').addEventListener('click', () => this.copyCurlCommand());

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
        this.markTabDirty();
      });
    });
    
    this.bindKeyValueEvents('formDataRows');
    
    document.querySelector('.add-row-btn[data-target="formDataRows"]')?.addEventListener('click', () => {
      this.addKeyValueRow('formDataRows');
    });
    
    document.getElementById('rawBodyEditor')?.addEventListener('input', (e) => {
      this.currentRequest.rawBody = e.target.value;
      this.markTabDirty();
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
    
    document.getElementById('selectAllParams')?.addEventListener('change', (e) => {
      this.toggleAllRows('paramsRows', 'params', e.target.checked);
    });
    
    document.getElementById('selectAllHeaders')?.addEventListener('change', (e) => {
      this.toggleAllRows('headersRows', 'headers', e.target.checked);
    });

    document.getElementById('createCollectionBtn').addEventListener('click', () => this.openCreateCollectionModal());
    document.getElementById('confirmCreateCollection').addEventListener('click', () => this.createCollection());
    document.getElementById('confirmSaveRequest').addEventListener('click', () => this.saveRequest());
    
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
    document.getElementById('exportCollectionBtnSettings').addEventListener('click', () => this.exportCollections());
    document.getElementById('importCollectionBtnSettings').addEventListener('click', () => this.triggerImport());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.importCollections(e));

    document.getElementById('addCollectionInModal').addEventListener('click', () => this.showNewCollectionInput());
    document.getElementById('confirmNewCollection').addEventListener('click', () => this.createCollectionInModal());

    document.getElementById('historySearch').addEventListener('input', (e) => this.searchHistory(e.target.value));
    document.getElementById('clearHistoryBtn').addEventListener('click', () => this.confirmClearHistory());
    document.getElementById('cancelNewCollection').addEventListener('click', () => this.hideNewCollectionInput());

    // document.getElementById('manageEnvsBtn').addEventListener('click', () => this.openEnvironmentModal());
    // document.getElementById('addEnvironmentBtn').addEventListener('click', () => this.addEnvironment());
    // document.getElementById('saveEnvironment').addEventListener('click', () => this.saveEnvironment());

    // document.getElementById('activeEnvironment').addEventListener('change', async (e) => {
    //   await placeholderManager.setActiveEnvironment(e.target.value);
    // });

    document.getElementById('copyResponseBtn').addEventListener('click', () => this.copyResponse());

    document.getElementById('expandAllBtn').addEventListener('click', () => this.expandAllCollections());
    document.getElementById('collapseAllBtn').addEventListener('click', () => this.collapseAllCollections());

    document.querySelectorAll('.modal-close, .modal-cancel, .modal-overlay').forEach(el => {
      el.addEventListener('click', () => this.closeModals());
    });

    document.querySelectorAll('.modal-content').forEach(modal => {
      modal.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  bindTabEvents() {
    document.getElementById('newTabBtn').addEventListener('click', () => this.createNewTab());
    
    document.addEventListener('click', (e) => {
      const contextMenu = document.getElementById('tabContextMenu');
      if (!contextMenu.contains(e.target) && !e.target.closest('.tab-item')) {
        this.closeContextMenu();
      }
    });
  }

  renderTabs() {
    const tabsList = document.getElementById('tabsList');
    tabsList.innerHTML = '';

    const tabs = this.tabManager.getAllTabs();
    tabs.forEach(tab => {
      const tabEl = this.createTabElement(tab);
      tabsList.appendChild(tabEl);
    });
  }

  createTabElement(tab) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab-item';
    if (tab.id === this.tabManager.activeTabId) {
      tabEl.classList.add('active');
    }
    if (tab.isDirty) {
      tabEl.classList.add('dirty');
    }
    tabEl.dataset.tabId = tab.id;
    tabEl.draggable = true;
    
    const isNewTab = tab.id === this.tabManager.nextTabId - 1;
    if (isNewTab) {
      tabEl.classList.add('new');
      setTimeout(() => tabEl.classList.remove('new'), 200);
    }

    const displayName = this.tabManager.getDisplayName(tab);
    const tooltip = this.generateTabTooltip(tab);
    tabEl.title = tooltip;

    tabEl.innerHTML = `
      <span class="tab-name">${this.escapeHtml(displayName)}</span>
      <input class="tab-name-input" type="text" value="${this.escapeHtml(displayName)}" />
      <button class="tab-edit-btn" title="Edit tab name"></button>
      <button class="tab-close-btn" title="Close tab"></button>
    `;

    tabEl.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-edit-btn') && !e.target.closest('.tab-close-btn')) {
        this.switchToTab(tab.id);
      }
    });

    tabEl.querySelector('.tab-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.startEditingTabName(tab.id);
    });

    tabEl.querySelector('.tab-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTabById(tab.id);
    });

    tabEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, tab.id);
    });

    const input = tabEl.querySelector('.tab-name-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.finishEditingTabName(tab.id, input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelEditingTabName(tab.id);
      }
    });

    input.addEventListener('blur', () => {
      this.finishEditingTabName(tab.id, input.value);
    });

    this.setupDragAndDrop(tabEl, tab);

    return tabEl;
  }

  setupDragAndDrop(tabEl, tab) {
    tabEl.addEventListener('dragstart', (e) => {
      tabEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id.toString());
    });

    tabEl.addEventListener('dragend', (e) => {
      tabEl.classList.remove('dragging');
      document.querySelectorAll('.tab-item').forEach(el => {
        el.classList.remove('drag-over');
      });
    });

    tabEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggingEl = document.querySelector('.tab-item.dragging');
      if (draggingEl && draggingEl !== tabEl) {
        tabEl.classList.add('drag-over');
      }
    });

    tabEl.addEventListener('dragleave', (e) => {
      tabEl.classList.remove('drag-over');
    });

    tabEl.addEventListener('drop', (e) => {
      e.preventDefault();
      tabEl.classList.remove('drag-over');
      
      const draggedTabId = parseInt(e.dataTransfer.getData('text/plain'));
      if (draggedTabId === tab.id) return;

      const tabs = this.tabManager.getAllTabs();
      const fromIndex = tabs.findIndex(t => t.id === draggedTabId);
      const toIndex = tabs.findIndex(t => t.id === tab.id);

      if (fromIndex !== -1 && toIndex !== -1) {
        this.tabManager.reorderTabs(fromIndex, toIndex);
        this.renderTabs();
      }
    });
  }

  generateTabTooltip(tab) {
    const parts = [];
    
    if (tab.originalCollectionName && tab.originalRequestName) {
      parts.push(`${tab.originalCollectionName}/${tab.originalRequestName}`);
    } else if (tab.originalRequestName) {
      parts.push(tab.originalRequestName);
    }
    
    if (tab.request.url) {
      parts.push(tab.request.url);
    }
    
    if (tab.request.method) {
      parts.push(`[${tab.request.method}]`);
    }
    
    if (tab.isDirty) {
      parts.push('(Unsaved)');
    }
    
    return parts.join(' • ');
  }

  createNewTab() {
    const tab = this.tabManager.createTab();
    this.renderTabs();
    this.loadActiveTab();
    this.scrollToActiveTab();
  }

  switchToTab(tabId) {
    this.saveCurrentTabState();
    this.tabManager.switchTab(tabId);
    this.renderTabs();
    this.loadActiveTab();
    this.scrollToActiveTab();
  }

  scrollToActiveTab() {
    const activeTabEl = document.querySelector('.tab-item.active');
    const tabsContainer = document.getElementById('tabsContainer');
    if (activeTabEl && tabsContainer) {
      const containerRect = tabsContainer.getBoundingClientRect();
      const tabRect = activeTabEl.getBoundingClientRect();
      
      if (tabRect.top < containerRect.top || tabRect.bottom > containerRect.bottom) {
        activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  closeTabById(tabId) {
    const success = this.tabManager.closeTab(tabId);
    if (success) {
      this.renderTabs();
      this.loadActiveTab();
    }
  }

  saveCurrentTabState() {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) return;

    const body = typeof getRequestBody === 'function' ? getRequestBody() : this.currentRequest.body;
    const rawBody = document.getElementById('rawBodyEditor')?.value || this.currentRequest.rawBody;

    // Get current response from UI
    const responseBody = typeof getResponseBody === 'function' ? getResponseBody() : '';
    const currentResponse = {
      ...activeTab.response,
      body: responseBody
    };

    this.tabManager.updateTab(activeTab.id, {
      request: {
        ...this.currentRequest,
        body: body,
        rawBody: rawBody
      },
      response: currentResponse,
      isDirty: this.currentRequest.id !== null && this.hasUnsavedChanges()
    });
  }

  hasUnsavedChanges() {
    return true;
  }

  async loadActiveTab() {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab) {
      this.newRequest();
      return;
    }

    this.currentRequest = { ...activeTab.request };
    await this.loadRequest(activeTab.request);
    
    // Always load the tab's response state
    if (activeTab.response && activeTab.response.status) {
      this.displayResponse({
        success: true,
        ...activeTab.response
      });
    } else {
      this.clearResponse();
    }
  }

  clearResponse() {
    const statusBadge = document.querySelector('.status-badge');
    const responseTime = document.getElementById('responseTime');
    const responseSize = document.getElementById('responseSize');
    const responseHeadersList = document.getElementById('responseHeadersList');

    statusBadge.className = 'status-badge';
    statusBadge.textContent = 'Ready';
    responseTime.textContent = '--';
    responseSize.textContent = '--';
    
    if (typeof setResponseBody === 'function') {
      setResponseBody('');
    }
    
    responseHeadersList.innerHTML = '';
  }

  startEditingTabName(tabId) {
    const tabEl = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    tabEl.classList.add('editing');
    const input = tabEl.querySelector('.tab-name-input');
    input.focus();
    input.select();
  }

  finishEditingTabName(tabId, newName) {
    const tabEl = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!tabEl || !tabEl.classList.contains('editing')) return;

    tabEl.classList.remove('editing');
    
    if (newName && newName.trim()) {
      this.tabManager.updateTabName(tabId, newName.trim());
      this.renderTabs();
    }
  }

  cancelEditingTabName(tabId) {
    const tabEl = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    tabEl.classList.remove('editing');
    const tab = this.tabManager.getTabById(tabId);
    if (tab) {
      const input = tabEl.querySelector('.tab-name-input');
      input.value = this.tabManager.getDisplayName(tab);
    }
  }

  showContextMenu(event, tabId) {
    const menu = document.getElementById('tabContextMenu');
    const tab = this.tabManager.getTabById(tabId);
    if (!tab) return;

    menu.dataset.tabId = tabId;
    
    const resetBtn = document.getElementById('contextResetName');
    if (tab.customName) {
      resetBtn.style.display = 'flex';
    } else {
      resetBtn.style.display = 'none';
    }

    const closeOthersBtn = document.getElementById('contextCloseOthers');
    closeOthersBtn.disabled = this.tabManager.getAllTabs().length <= 1;

    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.classList.add('show');

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }

    this.bindContextMenuEvents(tabId);
  }

  bindContextMenuEvents(tabId) {
    const unbindAll = () => {
      document.getElementById('contextEditName').replaceWith(document.getElementById('contextEditName').cloneNode(true));
      document.getElementById('contextResetName').replaceWith(document.getElementById('contextResetName').cloneNode(true));
      document.getElementById('contextDuplicate').replaceWith(document.getElementById('contextDuplicate').cloneNode(true));
      document.getElementById('contextClose').replaceWith(document.getElementById('contextClose').cloneNode(true));
      document.getElementById('contextCloseOthers').replaceWith(document.getElementById('contextCloseOthers').cloneNode(true));
      document.getElementById('contextCloseAll').replaceWith(document.getElementById('contextCloseAll').cloneNode(true));
    };

    unbindAll();

    document.getElementById('contextEditName').addEventListener('click', () => {
      this.closeContextMenu();
      this.startEditingTabName(tabId);
    });

    document.getElementById('contextResetName').addEventListener('click', () => {
      this.closeContextMenu();
      this.tabManager.resetTabName(tabId);
      this.renderTabs();
    });

    document.getElementById('contextDuplicate').addEventListener('click', () => {
      this.closeContextMenu();
      this.tabManager.duplicateTab(tabId);
      this.renderTabs();
      this.loadActiveTab();
    });

    document.getElementById('contextClose').addEventListener('click', () => {
      this.closeContextMenu();
      this.closeTabById(tabId);
    });

    document.getElementById('contextCloseOthers').addEventListener('click', () => {
      this.closeContextMenu();
      const success = this.tabManager.closeOtherTabs(tabId);
      if (success) {
        this.renderTabs();
        this.loadActiveTab();
      }
    });

    document.getElementById('contextCloseAll').addEventListener('click', () => {
      this.closeContextMenu();
      const success = this.tabManager.closeAllTabs();
      if (success) {
        this.renderTabs();
        this.loadActiveTab();
      }
    });
  }

  closeContextMenu() {
    const menu = document.getElementById('tabContextMenu');
    menu.classList.remove('show');
  }

  markTabDirty() {
    const activeTab = this.tabManager.getActiveTab();
    if (activeTab && !activeTab.isDirty) {
      this.tabManager.updateTab(activeTab.id, { isDirty: true });
      this.renderTabs();
    }
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
    const selectAllId = containerId === 'paramsRows' ? 'selectAllParams' : 
                        containerId === 'headersRows' ? 'selectAllHeaders' : null;
    
    container.addEventListener('input', (e) => {
      if (e.target.classList.contains('kv-key') || e.target.classList.contains('kv-value')) {
        this.syncKeyValueData(containerId);
      }
    });

    container.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        this.syncKeyValueData(containerId);
        if (selectAllId) {
          this.updateSelectAllCheckbox(containerId, selectAllId);
        }
      }
    });

    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete')) {
        e.target.closest('.kv-row').remove();
        this.syncKeyValueData(containerId);
        if (selectAllId) {
          this.updateSelectAllCheckbox(containerId, selectAllId);
        }
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
      this.syncUrlFromParams();
    } else if (containerId === 'headersRows') {
      this.currentRequest.headers = data;
    } else if (containerId === 'formDataRows') {
      this.currentRequest.formData = data;
    }
    
    this.markTabDirty();
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

  toggleAllRows(containerId, dataKey, checked) {
    const container = document.getElementById(containerId);
    const checkboxes = container.querySelectorAll('.kv-row input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
    });
    
    if (this.currentRequest[dataKey]) {
      this.currentRequest[dataKey].forEach(item => {
        item.enabled = checked;
      });
    }
    
    this.markTabDirty();
  }

  updateSelectAllCheckbox(containerId, selectAllId) {
    const container = document.getElementById(containerId);
    const selectAll = document.getElementById(selectAllId);
    if (!container || !selectAll) return;
    
    const checkboxes = container.querySelectorAll('.kv-row input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);
    
    selectAll.checked = allChecked;
    selectAll.indeterminate = someChecked && !allChecked;
  }

  openInNewTab() {
    let url = document.getElementById('requestUrl').value.trim();
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    const finalUrl = requestManager.buildUrl(
      placeholderManager.replacePlaceholders(url),
      this.currentRequest.params
    );
    
    window.open(finalUrl, '_blank');
  }

  showCurlCommand() {
    const url = document.getElementById('requestUrl').value.trim();
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    const curlCommand = this.generateCurlCommand();
    document.getElementById('curlCommand').textContent = curlCommand;
    document.getElementById('curlModal').classList.add('active');
  }

  generateCurlCommand() {
    const method = this.currentRequest.method;
    const url = document.getElementById('requestUrl').value.trim();
    
    const finalUrl = requestManager.buildUrl(
      placeholderManager.replacePlaceholders(url),
      this.currentRequest.params
    );

    let curl = `curl -X ${method} \\\n  "${finalUrl}"`;
    
    // Add headers
    const enabledHeaders = this.currentRequest.headers.filter(h => h.enabled && h.key);
    enabledHeaders.forEach(header => {
      const key = placeholderManager.replacePlaceholders(header.key);
      const value = placeholderManager.replacePlaceholders(header.value);
      curl += ` \\\n  -H "${key}: ${value}"`;
    });

    // Add auth
    const auth = authManager.getAuth();
    if (auth && auth.type !== 'none') {
      if (auth.type === 'basic' && auth.data.username) {
        curl += ` \\\n  -u "${auth.data.username}:${auth.data.password || ''}"`;
      } else if (auth.type === 'bearer' && auth.data.token) {
        curl += ` \\\n  -H "Authorization: Bearer ${auth.data.token}"`;
      }
    }

    // Add body (including for GET requests, as some APIs like Elasticsearch support it)
    if (this.currentRequest.bodyType === 'json') {
      const body = typeof getRequestBody === 'function' ? getRequestBody() : this.currentRequest.body;
      if (body && body.trim()) {
        curl += ` \\\n  -d '${body}'`;
      }
    } else if (this.currentRequest.bodyType === 'raw') {
      const rawBody = document.getElementById('rawBodyEditor')?.value || this.currentRequest.rawBody;
      if (rawBody && rawBody.trim()) {
        curl += ` \\\n  -d '${rawBody}'`;
      }
    } else if (this.currentRequest.bodyType === 'form-data' && method !== 'GET' && method !== 'HEAD') {
      const enabledFormData = this.currentRequest.formData.filter(f => f.enabled && f.key);
      enabledFormData.forEach(field => {
        const key = placeholderManager.replacePlaceholders(field.key);
        const value = placeholderManager.replacePlaceholders(field.value);
        curl += ` \\\n  -F "${key}=${value}"`;
      });
    }

    return curl;
  }

  async copyCurlCommand() {
    const curlCommand = document.getElementById('curlCommand').textContent;
    
    try {
      await navigator.clipboard.writeText(curlCommand);
      const btn = document.getElementById('copyCurlBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 8 7 12 13 4"/>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  }

  cancelRequest() {
    requestManager.abort();
    this.setLoading(false);
  }

  async sendRequest() {
    const url = document.getElementById('requestUrl').value.trim();
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    this.setLoading(true);
    
    const body = this.getBodyForCurrentType();

    let collectionName = null;
    if (this.currentRequest.collectionId) {
      const collection = await collectionsManager.getCollection(this.currentRequest.collectionId);
      if (collection) {
        collectionName = collection.name;
      }
    }

    try {
      const result = await requestManager.send({
        method: this.currentRequest.method,
        url: url,
        headers: this.currentRequest.headers,
        params: this.currentRequest.params,
        bodyType: this.currentRequest.bodyType,
        body: body,
        formData: this.currentRequest.formData,
        collectionId: this.currentRequest.collectionId,
        collectionName: collectionName,
        requestName: this.currentRequest.name
      });

      this.setLoading(false);
      this.displayResponse(result);
      this.renderHistory();
      
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab) {
        this.tabManager.updateTab(activeTab.id, {
          response: {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
            body: result.body,
            duration: result.duration,
            size: result.size
          }
        });
        this.renderTabs();
      }
    } catch (error) {
      this.setLoading(false);
      this.displayResponse({
        success: false,
        error: error.message || 'Unknown error',
        duration: 0
      });
    }
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
    const sendBtn = document.getElementById('sendBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (loading) {
      sendBtn.style.display = 'none';
      cancelBtn.style.display = 'inline-flex';
    } else {
      sendBtn.style.display = 'inline-flex';
      cancelBtn.style.display = 'none';
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
      if (result.body === null || result.body === undefined) {
        bodyText = '';
      } else if (typeof result.body === 'object') {
        try {
          bodyText = JSON.stringify(result.body, null, 2);
        } catch (e) {
          bodyText = String(result.body);
        }
      } else {
        bodyText = String(result.body);
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

  extractUrlParameters(url) {
    if (!url) return [];
    
    const paramNames = new Set();
    const regex = /\{([^}]+)\}/g;
    let match;
    
    while ((match = regex.exec(url)) !== null) {
      paramNames.add(match[1]);
    }
    
    return Array.from(paramNames);
  }

  updateUrlWithParams(url, params) {
    if (!url) return url;
    
    const enabledParams = params.filter(p => p.enabled && p.key && p.key.trim());
    const pathParamNames = this.extractUrlParameters(url);
    
    let baseUrl = this.getBaseUrlWithoutQuery(url);
    
    const pathParamPattern = /\{([^}]+)\}/g;
    const originalPathPart = url.split('?')[0];
    baseUrl = originalPathPart;
    
    const queryParams = [];
    
    for (const param of enabledParams) {
      const paramKey = param.key.trim();
      
      if (pathParamNames.includes(paramKey)) {
        continue;
      }
      
      const value = param.value || '';
      queryParams.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(value)}`);
    }
    
    let updatedUrl = baseUrl;
    if (queryParams.length > 0) {
      updatedUrl += '?' + queryParams.join('&');
    }
    
    return updatedUrl;
  }

  extractQueryParams(url) {
    const queryParams = [];
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      urlObj.searchParams.forEach((value, key) => {
        queryParams.push({ key, value });
      });
    } catch (e) {
      const queryMatch = url.match(/\?(.+?)(?:#|$)/);
      if (queryMatch) {
        const queryString = queryMatch[1];
        queryString.split('&').forEach(pair => {
          const [key, ...valueParts] = pair.split('=');
          const value = valueParts.join('=');
          if (key) {
            queryParams.push({ 
              key: decodeURIComponent(key), 
              value: value ? decodeURIComponent(value) : '' 
            });
          }
        });
      }
    }
    return queryParams;
  }

  getBaseUrlWithoutQuery(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.origin + urlObj.pathname;
    } catch (e) {
      return url.split('?')[0];
    }
  }

  syncParamsFromUrl() {
    if (this.isSyncingParams) return;
    
    this.isSyncingUrl = true;
    
    const url = document.getElementById('requestUrl').value;
    const pathParamNames = this.extractUrlParameters(url);
    const queryParams = this.extractQueryParams(url);
    
    const currentParams = this.currentRequest.params.filter(p => p.key && p.key.trim());
    
    const urlParamKeys = new Set([
      ...pathParamNames,
      ...queryParams.map(qp => qp.key)
    ]);
    
    const newParams = [];
    const addedKeys = new Set();
    
    for (const paramName of pathParamNames) {
      const existingParam = currentParams.find(p => p.key.trim() === paramName);
      if (existingParam) {
        newParams.push(existingParam);
      } else {
        newParams.push({ enabled: true, key: paramName, value: '' });
      }
      addedKeys.add(paramName);
    }
    
    for (const qp of queryParams) {
      if (!addedKeys.has(qp.key)) {
        const existingParam = currentParams.find(p => p.key.trim() === qp.key);
        if (existingParam) {
          if (!existingParam.value && qp.value) {
            existingParam.value = qp.value;
          }
          newParams.push(existingParam);
        } else {
          newParams.push({ enabled: true, key: qp.key, value: qp.value });
        }
        addedKeys.add(qp.key);
      }
    }
    
    if (newParams.length === 0) {
      newParams.push({ enabled: true, key: '', value: '' });
    }
    
    this.currentRequest.params = newParams;
    this.renderKeyValueRows('paramsRows', newParams);
    
    this.isSyncingUrl = false;
  }

  syncUrlFromParams() {
    if (this.isSyncingUrl) return;
    
    if (this.syncUrlDebounceTimer) {
      clearTimeout(this.syncUrlDebounceTimer);
    }
    
    this.syncUrlDebounceTimer = setTimeout(() => {
      this.isSyncingParams = true;
      
      const currentUrl = document.getElementById('requestUrl').value;
      const updatedUrl = this.updateUrlWithParams(currentUrl, this.currentRequest.params);
      
      if (updatedUrl !== currentUrl) {
        document.getElementById('requestUrl').value = updatedUrl;
        this.currentRequest.url = updatedUrl;
      }
      
      this.isSyncingParams = false;
      this.syncUrlDebounceTimer = null;
    }, 500);
  }

  async copyResponse() {
    const text = typeof getResponseBody === 'function' ? getResponseBody() : '';
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('copyResponseBtn');
      const originalTitle = btn.title;
      btn.title = 'Copied!';
      btn.style.color = 'var(--success)';
      setTimeout(() => { 
        btn.title = originalTitle;
        btn.style.color = '';
      }, 2000);
    } catch {
      alert('Failed to copy to clipboard');
    }
  }

  newRequest() {
    this.saveCurrentTabState();
    this.createNewTab();
  }

  toggleNewDropdown() {
    const dropdown = document.getElementById('newDropdown');
    dropdown.classList.toggle('open');
  }

  closeNewDropdown() {
    const dropdown = document.getElementById('newDropdown');
    dropdown.classList.remove('open');
  }

  async showNewCollectionModal() {
    const name = prompt('Enter collection name:');
    if (name && name.trim()) {
      await collectionsManager.createCollection(name.trim());
      await this.renderCollections();
    }
  }

  async showNewSubcollectionModal() {
    const collections = await collectionsManager.getAllCollections();
    
    if (collections.length === 0) {
      alert('Please create a collection first before adding subcollections.');
      return;
    }
    
    // Build select options for parent collection
    const options = collections.map(c => `<option value="${c.id}">${c.name}${c.parentId ? ' (sub)' : ''}</option>`).join('');
    
    const modalHtml = `
      <div class="modal-overlay" id="subcollectionModal">
        <div class="modal" style="width: 400px;">
          <div class="modal-header">
            <h3>New Subcollection</h3>
            <button class="btn-icon modal-close" onclick="document.getElementById('subcollectionModal').remove()">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="parentCollection" style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Parent Collection</label>
              <select id="parentCollection" style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); color: var(--text-primary);">
                ${options}
              </select>
            </div>
            <div class="form-group">
              <label for="subcollectionName" style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Subcollection Name</label>
              <input type="text" id="subcollectionName" placeholder="Enter name..." style="width: 100%; padding: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); color: var(--text-primary);">
            </div>
          </div>
          <div class="modal-footer" style="padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-primary);">
            <button class="btn btn-secondary" onclick="document.getElementById('subcollectionModal').remove()">Cancel</button>
            <button class="btn btn-primary" id="createSubcollectionBtn">Create</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('subcollectionName').focus();
    
    document.getElementById('createSubcollectionBtn').addEventListener('click', async () => {
      const name = document.getElementById('subcollectionName').value.trim();
      const parentId = document.getElementById('parentCollection').value;
      
      if (name) {
        await collectionsManager.createCollection(name, null, parentId);
        this.renderCollections();
        document.getElementById('subcollectionModal').remove();
      }
    });
    
    document.getElementById('subcollectionName').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        document.getElementById('createSubcollectionBtn').click();
      }
    });
  }

  isSwaggerUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    const swaggerPatterns = [
      'swagger.json',
      'swagger.yaml',
      'swagger.yml',
      'openapi.json',
      'openapi.yaml',
      'openapi.yml',
      'doc.json',
      'docs.json',
      'api-docs',
      '/v2/api-docs',
      '/v3/api-docs'
    ];
    return swaggerPatterns.some(pattern => lowerUrl.includes(pattern));
  }

  async importSwaggerFromUrl(url) {
    try {
      const response = await fetch(url.trim());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const swaggerJson = await response.json();
      const result = this.parseSwaggerJson(swaggerJson, url.trim());
      
      if (result.requests.length === 0) {
        alert('No endpoints found in the Swagger document.');
        return;
      }
      
      const importDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const baseName = result.title || this.extractHostFromUrl(url);
      const collectionName = `${baseName} (imported ${importDate})`;
      const collection = await collectionsManager.createCollection(collectionName);
      
      for (const request of result.requests) {
        await collectionsManager.saveRequest(request, collection.id);
      }
      
      this.renderCollections();
      alert(`Successfully imported ${result.requests.length} endpoints into "${baseName}" collection.`);
      
    } catch (error) {
      console.error('Swagger import error:', error);
      alert(`Failed to import Swagger:\n${error.message}`);
    }
  }

  async showImportSwaggerModal() {
    const url = prompt('Enter Swagger JSON URL:\n\nExample: https://api.example.com/swagger/doc.json');
    if (!url || !url.trim()) return;
    
    try {
      const response = await fetch(url.trim());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const swaggerJson = await response.json();
      const result = this.parseSwaggerJson(swaggerJson, url.trim());
      
      if (result.requests.length === 0) {
        alert('No endpoints found in the Swagger document.');
        return;
      }
      
      const importDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const baseName = result.title || this.extractHostFromUrl(url);
      const collectionName = `${baseName} (imported ${importDate})`;
      const collection = await collectionsManager.createCollection(collectionName);
      
      for (const request of result.requests) {
        await collectionsManager.saveRequest(request, collection.id);
      }
      
      this.renderCollections();
      alert(`Successfully imported ${result.requests.length} endpoints into "${baseName}" collection.`);
      
    } catch (error) {
      console.error('Swagger import error:', error);
      alert(`Failed to import Swagger:\n${error.message}`);
    }
  }

  extractHostFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.split('.')[0] || 'Imported API';
    } catch {
      return 'Imported API';
    }
  }

  parseSwaggerJson(swagger, sourceUrl) {
    const requests = [];
    let baseUrl = '';
    let title = '';
    
    if (swagger.openapi && swagger.openapi.startsWith('3')) {
      title = swagger.info?.title || '';
      if (swagger.servers && swagger.servers.length > 0) {
        baseUrl = swagger.servers[0].url || '';
      }
      if (!baseUrl) {
        try {
          const urlObj = new URL(sourceUrl);
          baseUrl = urlObj.origin;
        } catch {}
      }
      
      if (swagger.paths) {
        for (const [path, methods] of Object.entries(swagger.paths)) {
          for (const [method, details] of Object.entries(methods)) {
            if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
              const request = this.createRequestFromSwagger(method, path, details, baseUrl);
              requests.push(request);
            }
          }
        }
      }
    } else if (swagger.swagger && swagger.swagger.startsWith('2')) {
      title = swagger.info?.title || '';
      const scheme = swagger.schemes?.[0] || 'https';
      const host = swagger.host || '';
      const basePath = swagger.basePath || '';
      baseUrl = host ? `${scheme}://${host}${basePath}` : '';
      
      if (!baseUrl) {
        try {
          const urlObj = new URL(sourceUrl);
          baseUrl = urlObj.origin;
        } catch {}
      }
      
      if (swagger.paths) {
        for (const [path, methods] of Object.entries(swagger.paths)) {
          for (const [method, details] of Object.entries(methods)) {
            if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())) {
              const request = this.createRequestFromSwagger(method, path, details, baseUrl);
              requests.push(request);
            }
          }
        }
      }
    }
    
    return { requests, title };
  }

  createRequestFromSwagger(method, path, details, baseUrl) {
    const swaggerPath = path.replace(/\{([^}]+)\}/g, '{$1}');
    const url = `${baseUrl}${swaggerPath}`.replace(/([^:])\/\//g, '$1/');
    
    const params = [];
    const headers = [{ enabled: true, key: '', value: '' }];
    let body = '';
    let bodyType = 'none';
    
    if (details.parameters) {
      for (const param of details.parameters) {
        if (param.in === 'path' || param.in === 'query') {
          params.push({
            enabled: true,
            key: param.name,
            value: param.example || param.default || ''
          });
        } else if (param.in === 'header' && param.name.toLowerCase() !== 'authorization') {
          headers.unshift({
            enabled: true,
            key: param.name,
            value: param.example || param.default || ''
          });
        } else if (param.in === 'body' && param.schema) {
          bodyType = 'json';
          body = this.generateExampleFromSchema(param.schema);
        }
      }
    }
    
    if (details.requestBody?.content) {
      const jsonContent = details.requestBody.content['application/json'];
      if (jsonContent?.schema) {
        bodyType = 'json';
        body = this.generateExampleFromSchema(jsonContent.schema);
      }
    }
    
    if (params.length === 0) {
      params.push({ enabled: true, key: '', value: '' });
    }
    
    const name = details.summary || details.operationId || `${method.toUpperCase()} ${path}`;
    
    return {
      name: name.substring(0, 50),
      method: method.toUpperCase(),
      url,
      params,
      headers,
      bodyType,
      body
    };
  }

  generateExampleFromSchema(schema) {
    if (!schema) return '';
    
    if (schema.example) {
      return JSON.stringify(schema.example, null, 2);
    }
    
    if (schema.type === 'object' || schema.properties) {
      const obj = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = this.getExampleValue(prop);
        }
      }
      return JSON.stringify(obj, null, 2);
    }
    
    if (schema.type === 'array' && schema.items) {
      return JSON.stringify([this.getExampleValue(schema.items)], null, 2);
    }
    
    return '';
  }

  getExampleValue(prop) {
    if (prop.example !== undefined) return prop.example;
    if (prop.default !== undefined) return prop.default;
    
    switch (prop.type) {
      case 'string': return prop.format === 'date-time' ? '2024-01-01T00:00:00Z' : 'string';
      case 'integer': return 0;
      case 'number': return 0.0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      default: return null;
    }
  }

  renderKeyValueRows(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!Array.isArray(data)) {
      console.warn('renderKeyValueRows: data is not an array', containerId, data);
      data = [];
    }

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

  async loadRequestFromCollection(request) {
    this.saveCurrentTabState();
    
    let collectionName = null;
    if (request.collectionId) {
      const collection = await collectionsManager.getCollection(request.collectionId);
      if (collection) {
        collectionName = collection.name;
      }
    }

    const tab = this.tabManager.createTab({
      request: {
        ...request,
        collectionName: collectionName,
        formData: request.formData || [{ enabled: true, key: '', value: '' }],
        rawBody: request.rawBody || ''
      }
    });

    this.renderTabs();
    await this.loadActiveTab();
    this.scrollToActiveTab();
  }

  async loadRequest(request) {
    let collectionName = null;
    if (request.collectionId) {
      const collection = await collectionsManager.getCollection(request.collectionId);
      if (collection) {
        collectionName = collection.name;
      }
    }

    this.currentRequest = { 
      ...request,
      collectionName: collectionName,
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
    
    const activeTab = this.tabManager.getActiveTab();
    if (activeTab) {
      this.tabManager.updateTab(activeTab.id, {
        request: {
          ...this.currentRequest,
          collectionName: request.collectionName || null,
          name: request.name || null
        }
      });
      this.renderTabs();
    }
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

  toggleCollection(collectionId) {
    const collectionEl = document.querySelector(`.collection-group .collection-header[data-id="${collectionId}"]`).parentElement;
    
    if (this.collapsedCollections.has(collectionId)) {
      this.collapsedCollections.delete(collectionId);
      collectionEl.classList.remove('collapsed');
    } else {
      this.collapsedCollections.add(collectionId);
      collectionEl.classList.add('collapsed');
    }
  }

  async expandAllCollections() {
    const allCollections = await collectionsManager.getAllCollections();
    this.collapsedCollections.clear();
    
    document.querySelectorAll('.collection-group').forEach(el => {
      el.classList.remove('collapsed');
    });
  }

  async collapseAllCollections() {
    const allCollections = await collectionsManager.getAllCollections();
    
    allCollections.forEach(collection => {
      this.collapsedCollections.add(collection.id);
    });
    
    document.querySelectorAll('.collection-group').forEach(el => {
      el.classList.add('collapsed');
    });
  }

  async renderCollections() {
    const container = document.getElementById('collectionsList');
    const allCollections = await collectionsManager.loadCollections();

    if (allCollections.length === 0) {
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
    
    // Build hierarchy map
    const childrenMap = new Map();
    const rootCollections = [];
    const allIds = new Set(allCollections.map(c => c.id));
    
    for (const collection of allCollections) {
      // Check if it's a root collection or orphan (parent doesn't exist)
      if (!collection.parentId || !allIds.has(collection.parentId)) {
        rootCollections.push(collection);
      } else {
        if (!childrenMap.has(collection.parentId)) {
          childrenMap.set(collection.parentId, []);
        }
        childrenMap.get(collection.parentId).push(collection);
      }
    }
    
    // Sort by order
    rootCollections.sort((a, b) => (a.order || 0) - (b.order || 0));
    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    
    // Recursive function to render collection and its children
    const renderCollectionItem = async (collection, depth = 0) => {
      const requests = await collectionsManager.getRequestsInCollection(collection.id);
      
      // On first render, collapse all collections by default
      if (!this.initialRenderDone && !this.collapsedCollections.has(collection.id)) {
        this.collapsedCollections.add(collection.id);
      }
      
      const isCollapsed = this.collapsedCollections.has(collection.id);
      
      const collectionEl = document.createElement('div');
      collectionEl.className = `collection-group ${isCollapsed ? 'collapsed' : ''} depth-${depth}`;
      collectionEl.style.marginLeft = `${depth * 16}px`;
      
      const childCount = (childrenMap.get(collection.id) || []).length;
      const totalCount = requests.length + childCount;
      
      collectionEl.innerHTML = `
        <div class="collection-header" data-id="${collection.id}" data-depth="${depth}">
          <button class="expand-toggle">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 5 6 8 9 5"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            ${depth === 0 ? '<path d="M2 3h10M2 7h10M2 11h10"/>' : '<path d="M1 2h12v9H1zM1 2l2-1h8l2 1"/>'}
          </svg>
          <span class="collection-name">${this.escapeHtml(collection.name)}</span>
          <span class="badge">${totalCount}</span>
          <div class="collection-actions">
            ${collection.parentId ? `
            <button class="action-btn move-root" title="Move to Root" data-collection-id="${collection.id}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 9V3M3 5l3-3 3 3"/>
              </svg>
            </button>
            ` : ''}
            <button class="action-btn add-sub" title="Add Subcollection" data-collection-id="${collection.id}">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 3v6M3 6h6"/>
              </svg>
            </button>
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

      const headerEl = collectionEl.querySelector('.collection-header');
      
      // Make collection draggable
      headerEl.draggable = true;
      
      headerEl.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'collection',
          id: collection.id
        }));
        e.dataTransfer.effectAllowed = 'move';
        collectionEl.classList.add('dragging');
      });
      
      headerEl.addEventListener('dragend', () => {
        collectionEl.classList.remove('dragging');
      });
      
      headerEl.addEventListener('click', (e) => {
        if (!e.target.closest('.collection-actions')) {
          this.toggleCollection(collection.id);
        }
      });

      // Move to root button (only for subcollections)
      const moveRootBtn = collectionEl.querySelector('.action-btn.move-root');
      if (moveRootBtn) {
        moveRootBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveCollectionToRoot(collection.id);
        });
      }

      collectionEl.querySelector('.action-btn.add-sub').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addSubcollection(collection.id);
      });

      collectionEl.querySelector('.action-btn.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.editCollection(collection);
      });

      collectionEl.querySelector('.action-btn.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteCollection(collection.id);
      });

      const requestsContainer = collectionEl.querySelector('.collection-requests');
      
      // Add drop zone events to collection
      headerEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Determine drop zone: top edge, center, or bottom edge
        const rect = headerEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const edgeZone = rect.height * 0.25; // 25% top and bottom for reorder
        
        headerEl.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
        
        if (relativeY < edgeZone) {
          headerEl.classList.add('drag-over-top');
        } else if (relativeY > rect.height - edgeZone) {
          headerEl.classList.add('drag-over-bottom');
        } else {
          headerEl.classList.add('drag-over-center');
        }
        headerEl.classList.add('drag-over');
      });
      
      headerEl.addEventListener('dragleave', (e) => {
        headerEl.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
      });
      
      headerEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        headerEl.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-over-center');
        
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data.type === 'request') {
            await this.moveRequestToCollection(data.id, collection.id);
          } else if (data.type === 'collection' && data.id !== collection.id) {
            const draggedCollection = await collectionsManager.getCollection(data.id);
            if (!draggedCollection) {
              console.error('Dragged collection not found:', data.id);
              return;
            }
            
            // Determine drop zone
            const rect = headerEl.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const edgeZone = rect.height * 0.25;
            
            // Check if dropping on edges (reorder) or center (make subcollection)
            if (relativeY < edgeZone || relativeY > rect.height - edgeZone) {
              // Edge drop - reorder if same parent, otherwise move to same parent level
              const sameParent = (draggedCollection.parentId || null) === (collection.parentId || null);
              
              if (sameParent) {
                const position = relativeY < edgeZone ? 'before' : 'after';
                await collectionsManager.reorderCollection(data.id, collection.id, position);
                this.renderCollections();
                this.showNotification('Collection reordered');
              } else {
                // Move to same parent level first, then reorder
                await collectionsManager.updateCollectionParent(data.id, collection.parentId);
                const position = relativeY < edgeZone ? 'before' : 'after';
                await collectionsManager.reorderCollection(data.id, collection.id, position);
                this.renderCollections();
                this.showNotification('Collection moved');
              }
            } else {
              // Center drop - make subcollection
              await this.moveCollectionToParent(data.id, collection.id);
            }
          }
        } catch (err) {
          console.error('Drop error:', err);
          // Fallback for old format
          const requestId = e.dataTransfer.getData('text/plain');
          if (requestId) {
            await this.moveRequestToCollection(requestId, collection.id);
          }
        }
      });
      
      requestsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        requestsContainer.classList.add('drag-over');
      });
      
      requestsContainer.addEventListener('dragleave', (e) => {
        if (!requestsContainer.contains(e.relatedTarget)) {
          requestsContainer.classList.remove('drag-over');
        }
      });
      
      requestsContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        requestsContainer.classList.remove('drag-over');
        
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data.type === 'request') {
            await this.moveRequestToCollection(data.id, collection.id);
          } else if (data.type === 'collection' && data.id !== collection.id) {
            await this.moveCollectionToParent(data.id, collection.id);
          }
        } catch (err) {
          // Fallback for old format
          const requestId = e.dataTransfer.getData('text/plain');
          if (requestId) {
            await this.moveRequestToCollection(requestId, collection.id);
          }
        }
      });
      
      // Sort requests by order
      requests.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      requests.forEach(req => {
        const reqEl = document.createElement('div');
        reqEl.className = 'request-item';
        reqEl.dataset.id = req.id;
        reqEl.dataset.collectionId = collection.id;
        reqEl.draggable = true;
        reqEl.innerHTML = `
          <span class="drag-handle" title="Drag to move">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="3" cy="2" r="1"/><circle cx="7" cy="2" r="1"/>
              <circle cx="3" cy="5" r="1"/><circle cx="7" cy="5" r="1"/>
              <circle cx="3" cy="8" r="1"/><circle cx="7" cy="8" r="1"/>
            </svg>
          </span>
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
        
        // Drag events
        reqEl.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'request',
            id: req.id
          }));
          e.dataTransfer.effectAllowed = 'move';
          reqEl.classList.add('dragging');
        });
        
        reqEl.addEventListener('dragend', () => {
          reqEl.classList.remove('dragging');
        });
        
        // Drag over for reordering requests
        reqEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const rect = reqEl.getBoundingClientRect();
          const isTopHalf = e.clientY < rect.top + rect.height / 2;
          
          reqEl.classList.remove('drag-over-top', 'drag-over-bottom');
          reqEl.classList.add(isTopHalf ? 'drag-over-top' : 'drag-over-bottom');
        });
        
        reqEl.addEventListener('dragleave', (e) => {
          reqEl.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        
        reqEl.addEventListener('drop', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          reqEl.classList.remove('drag-over-top', 'drag-over-bottom');
          
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type === 'request' && data.id !== req.id) {
              const draggedRequest = await collectionsManager.getRequest(data.id);
              if (draggedRequest && draggedRequest.collectionId === req.collectionId) {
                // Same collection - reorder
                const rect = reqEl.getBoundingClientRect();
                const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                await collectionsManager.reorderRequest(data.id, req.id, position);
                this.renderCollections();
              } else {
                // Different collection - move to this collection
                await this.moveRequestToCollection(data.id, req.collectionId);
              }
            }
          } catch (err) {
            console.error('Drop error:', err);
          }
        });
        
        reqEl.addEventListener('click', async (e) => {
          if (!e.target.closest('.request-actions') && !e.target.closest('.drag-handle')) {
            await this.loadRequestFromCollection(req);
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
      
      // Render child collections (subcollections) inside this collection
      const children = childrenMap.get(collection.id) || [];
      for (const child of children) {
        const childEl = await renderCollectionItem(child, depth + 1);
        if (childEl) {
          requestsContainer.appendChild(childEl);
        }
      }

      // Only append to main container if this is a root collection
      if (depth === 0) {
        container.appendChild(collectionEl);
      }
      
      return collectionEl;
    };
    
    // Render all root collections
    for (const rootCollection of rootCollections) {
      await renderCollectionItem(rootCollection, 0);
    }

    // Add drop zone for moving collections to root (only once)
    if (!container.dataset.dropListenerAttached) {
      container.dataset.dropListenerAttached = 'true';
      
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      
      container.addEventListener('drop', async (e) => {
        // Only handle if dropped directly on container (not on a collection)
        if (e.target === container || e.target.classList.contains('empty-state')) {
          e.preventDefault();
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data.type === 'collection') {
              await this.moveCollectionToParent(data.id, null);
            }
          } catch (err) {
            // Ignore
          }
        }
      });
    }
    
    this.updateSaveRequestCollectionSelect();
    this.initialRenderDone = true;
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

  async moveRequestToCollection(requestId, collectionId) {
    await collectionsManager.moveRequestToCollection(requestId, collectionId);
    this.renderCollections();
    this.showNotification('Request moved successfully');
  }

  async moveCollectionToParent(collectionId, newParentId) {
    // Prevent moving collection into itself or its children
    if (collectionId === newParentId) {
      return;
    }
    
    // Check if newParentId is a descendant of collectionId (would create circular reference)
    const isDescendant = async (parentId, checkId) => {
      if (!checkId) return false; // null means root, can't be a descendant
      const children = await collectionsManager.getChildCollections(parentId);
      for (const child of children) {
        if (child.id === checkId) return true;
        if (await isDescendant(child.id, checkId)) return true;
      }
      return false;
    };
    
    if (newParentId && await isDescendant(collectionId, newParentId)) {
      this.showNotification('Cannot move collection into its own subcollection', 'error');
      return;
    }
    
    await collectionsManager.updateCollectionParent(collectionId, newParentId);
    this.renderCollections();
    this.showNotification('Collection moved successfully');
  }

  async moveCollectionToRoot(collectionId) {
    await collectionsManager.updateCollectionParent(collectionId, null);
    this.renderCollections();
    this.showNotification('Collection moved to root');
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

  async addSubcollection(parentId) {
    const name = prompt('Enter subcollection name:');
    if (name && name.trim()) {
      await collectionsManager.createCollection(name.trim(), null, parentId);
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
        
        const statusCode = item.response?.status || 0;
        const statusClass = statusCode >= 200 && statusCode < 300 ? 'status-2xx' :
                           statusCode >= 400 && statusCode < 500 ? 'status-4xx' :
                           statusCode >= 500 ? 'status-5xx' : 'status-other';
        
        const collectionInfo = item.collectionName && item.requestName 
          ? `${item.collectionName} / ${item.requestName}`
          : item.requestName || 'Kaydedilmemiş';
        
        const timestamp = historyManager.formatFullTimestamp(item.timestamp);
        
        const fullUrl = this.buildFullUrlFromHistory(item);
        
        itemEl.innerHTML = `
          <div class="history-item-header">
            <span class="method-badge ${item.method.toLowerCase()}">${item.method}</span>
            <span class="history-status ${statusClass}">${statusCode}</span>
            <span class="history-timestamp">${timestamp}</span>
          </div>
          <div class="history-item-body">
            <span class="history-collection">${this.escapeHtml(collectionInfo)}</span>
            <span class="history-url" title="${this.escapeHtml(fullUrl)}">${this.escapeHtml(fullUrl)}</span>
          </div>
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
        
        itemEl.addEventListener('click', async (e) => {
          if (!e.target.closest('.history-actions')) {
            await this.loadHistoryItem(item.id);
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

  async loadHistoryItem(historyId) {
    const item = await historyManager.getHistoryItem(historyId);
    if (!item) return;
    
    this.saveCurrentTabState();
    
    let baseUrl = item.url;
    let urlParams = item.requestParams || [];
    
    if (baseUrl.includes('?') && urlParams.length === 0) {
      try {
        const urlObj = new URL(baseUrl);
        baseUrl = urlObj.origin + urlObj.pathname;
        
        urlParams = [];
        urlObj.searchParams.forEach((value, key) => {
          urlParams.push({ enabled: true, key, value });
        });
      } catch (e) {
        baseUrl = baseUrl.split('?')[0];
      }
    }
    
    let headers = [];
    if (Array.isArray(item.requestHeaders)) {
      headers = item.requestHeaders;
    } else if (typeof item.requestHeaders === 'object' && item.requestHeaders !== null) {
      headers = Object.entries(item.requestHeaders).map(([key, value]) => ({
        enabled: true,
        key,
        value
      }));
    }
    
    const requestData = {
      id: null,
      name: '',
      method: item.method,
      url: baseUrl,
      headers: headers,
      params: Array.isArray(urlParams) ? urlParams : [],
      bodyType: item.bodyType || 'json',
      body: item.requestBody || '',
      formData: Array.isArray(item.formData) ? item.formData : [{ enabled: true, key: '', value: '' }],
      rawBody: item.rawBody || '',
      collectionId: null
    };

    const tab = this.tabManager.createTab({
      request: requestData,
      response: item.response || {}
    });

    this.renderTabs();
    await this.loadActiveTab();
    this.scrollToActiveTab();
  }

  async searchHistory(query) {
    const container = document.getElementById('historyList');
    
    if (!query.trim()) {
      await this.renderHistory();
      return;
    }
    
    const results = await historyManager.searchHistory(query);
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No results found</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    results.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      
      const statusCode = item.response?.status || 0;
      const statusClass = statusCode >= 200 && statusCode < 300 ? 'status-2xx' :
                         statusCode >= 400 && statusCode < 500 ? 'status-4xx' :
                         statusCode >= 500 ? 'status-5xx' : 'status-other';
      
      const collectionInfo = item.collectionName && item.requestName 
        ? `${item.collectionName} / ${item.requestName}`
        : item.requestName || 'Kaydedilmemiş';
      
      const timestamp = historyManager.formatFullTimestamp(item.timestamp);
      
      const fullUrl = this.buildFullUrlFromHistory(item);
      
      itemEl.innerHTML = `
        <div class="history-item-header">
          <span class="method-badge ${item.method.toLowerCase()}">${item.method}</span>
          <span class="history-status ${statusClass}">${statusCode}</span>
          <span class="history-timestamp">${timestamp}</span>
        </div>
        <div class="history-item-body">
          <span class="history-collection">${this.escapeHtml(collectionInfo)}</span>
          <span class="history-url" title="${this.escapeHtml(fullUrl)}">${this.escapeHtml(fullUrl)}</span>
        </div>
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
      
      itemEl.addEventListener('click', async (e) => {
        if (!e.target.closest('.history-actions')) {
          await this.loadHistoryItem(item.id);
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

      container.appendChild(itemEl);
    });
  }

  confirmClearHistory() {
    if (confirm('Tüm geçmişi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      this.clearAllHistory();
    }
  }

  async clearAllHistory() {
    await historyManager.clearHistory();
    document.getElementById('historySearch').value = '';
    await this.renderHistory();
  }

  async deleteHistoryItem(historyId) {
    await historyManager.deleteHistoryItem(historyId);
    const searchQuery = document.getElementById('historySearch').value;
    if (searchQuery.trim()) {
      await this.searchHistory(searchQuery);
    } else {
      await this.renderHistory();
    }
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

  buildFullUrlFromHistory(item) {
    let fullUrl = item.url;
    
    if (item.requestParams && item.requestParams.length > 0) {
      const enabledParams = item.requestParams.filter(p => p.enabled && p.key);
      if (enabledParams.length > 0) {
        try {
          const urlObj = new URL(fullUrl);
          enabledParams.forEach(param => {
            urlObj.searchParams.append(param.key, param.value || '');
          });
          fullUrl = urlObj.toString();
        } catch (e) {
          const paramString = enabledParams
            .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
            .join('&');
          fullUrl = fullUrl + (fullUrl.includes('?') ? '&' : '?') + paramString;
        }
      }
    }
    
    return fullUrl;
  }

  truncateUrl(url) {
    if (url.length <= 80) return url;
    return url.substring(0, 77) + '...';
  }

  truncateUrlOld(url) {
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

  openSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
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
    
    // Build hierarchy
    const childrenMap = new Map();
    const rootCollections = [];
    const allIds = new Set(collectionsManager.collections.map(c => c.id));
    
    collectionsManager.collections.forEach(col => {
      // Check if it's a root collection or orphan (parent doesn't exist)
      if (!col.parentId || !allIds.has(col.parentId)) {
        rootCollections.push(col);
      } else {
        if (!childrenMap.has(col.parentId)) {
          childrenMap.set(col.parentId, []);
        }
        childrenMap.get(col.parentId).push(col);
      }
    });
    
    // Recursive function to add options with indentation
    const addOptions = (collections, depth = 0) => {
      collections.forEach(col => {
        const option = document.createElement('option');
        option.value = col.id;
        option.textContent = '\u00A0\u00A0'.repeat(depth) + (depth > 0 ? '└ ' : '') + col.name;
        select.appendChild(option);
        
        // Add children
        const children = childrenMap.get(col.id) || [];
        if (children.length > 0) {
          addOptions(children, depth + 1);
        }
      });
    };
    
    addOptions(rootCollections);
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

    const activeTab = this.tabManager.getActiveTab();
    if (activeTab) {
      this.tabManager.updateTab(activeTab.id, {
        isDirty: false,
        request: {
          ...this.currentRequest
        }
      });
      this.renderTabs();
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
      document.getElementById('settingsModal').classList.remove('active');
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
      
      // Check if it's Swagger/OpenAPI format
      if (data.openapi || data.swagger) {
        // Swagger/OpenAPI format
        const result = this.parseSwaggerJson(data, file.name);
        
        if (result.requests.length === 0) {
          throw new Error('No endpoints found in the Swagger document.');
        }
        
        const importDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const baseName = result.title || file.name.replace(/\.(json|yaml|yml)$/i, '');
        const collectionName = `${baseName} (imported ${importDate})`;
        const collection = await collectionsManager.createCollection(collectionName);
        importedCollections++;
        
        for (const request of result.requests) {
          await collectionsManager.saveRequest(request, collection.id);
          importedRequests++;
        }
      } else if (data.info && data.item) {
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
        throw new Error('Unrecognized file format. Supported: Swagger/OpenAPI, Postman Collection, Reqqo export');
      }
      
      this.renderCollections();
      this.showNotification(`Imported ${importedCollections} collections, ${importedRequests} requests`);
      document.getElementById('settingsModal').classList.remove('active');
      
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
    
    // Recursive function to process folders and subfolders
    const processFolder = async (items, parentId = null) => {
      for (const item of items) {
        // Check if this is a folder (has items but no request)
        if (item.item && !item.request) {
          // Create collection/subcollection for folder
          const collection = await collectionsManager.createCollection(item.name, null, parentId);
          importedCollections++;
          
          // Recursively process items in this folder
          await processFolder(item.item, collection.id);
        } else if (item.request) {
          // This is a request
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
          
          // Save request to parent collection
          if (parentId) {
            await collectionsManager.saveRequest({
              name: item.name || 'Imported Request',
              method: request.method || 'GET',
              url: typeof request.url === 'string' ? request.url : request.url.raw || '',
              headers: headers,
              params: params,
              bodyType: bodyType,
              body: body,
              auth: null
            }, parentId);
            
            importedRequests++;
          }
        }
      }
    };
    
    // First create the root collection from Postman collection name with import date
    const importDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const baseName = data.info?.name || 'Imported Collection';
    const rootCollectionName = `${baseName} (imported ${importDate})`;
    const rootCollection = await collectionsManager.createCollection(rootCollectionName, null, null);
    importedCollections++;
    
    // Process all items under the root collection
    await processFolder(data.item, rootCollection.id);
    
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

  parseCurlCommand(curlString) {
    try {
      const parsed = {
        method: 'GET',
        url: '',
        headers: [],
        body: null
      };

      // Normalize line breaks and spaces
      const normalized = curlString
        .replace(/\\\r?\n/g, ' ')  // Remove line continuations
        .replace(/\s+/g, ' ')      // Normalize spaces
        .trim();
      
      // Extract URL first (before modifying the string)
      // Look for quoted strings that look like URLs (start with http:// or https://)
      const quotedUrlMatch = normalized.match(/(['"])(https?:\/\/[^'"]+)\1/);
      if (quotedUrlMatch) {
        parsed.url = quotedUrlMatch[2];
      } else {
        // Try to find unquoted URL
        const unquotedUrlMatch = normalized.match(/(https?:\/\/[^\s'"]+)/);
        if (unquotedUrlMatch) {
          parsed.url = unquotedUrlMatch[1];
        }
      }

      // Extract method
      const methodMatch = normalized.match(/(?:-X|--request)\s+(['"]?)(\w+)\1/);
      if (methodMatch) {
        parsed.method = methodMatch[2].toUpperCase();
      }

      // Extract headers
      const headerRegex = /(?:-H|--header)\s+(['"])([^'"]+)\1/g;
      let headerMatch;
      while ((headerMatch = headerRegex.exec(normalized)) !== null) {
        const headerValue = headerMatch[2];
        const colonIndex = headerValue.indexOf(':');
        if (colonIndex > 0) {
          const key = headerValue.substring(0, colonIndex).trim();
          const value = headerValue.substring(colonIndex + 1).trim();
          parsed.headers.push({ enabled: true, key, value });
        }
      }

      // Extract body - support multi-line bodies with single quotes or double quotes
      let bodyMatch = normalized.match(/(?:-d|--data|--data-raw|--data-binary)\s+'([\s\S]*?)(?:'(?:\s|$))/);
      if (!bodyMatch) {
        bodyMatch = normalized.match(/(?:-d|--data|--data-raw|--data-binary)\s+"([\s\S]*?)(?:"(?:\s|$))/);
      }
      if (bodyMatch) {
        parsed.body = bodyMatch[1].trim();
      }

      return parsed.url ? parsed : null;
    } catch (error) {
      console.error('Failed to parse curl command:', error);
      return null;
    }
  }

  loadFromCurl(parsed) {
    // Set URL
    document.getElementById('requestUrl').value = parsed.url;
    this.currentRequest.url = parsed.url;

    // Set method
    this.currentRequest.method = parsed.method;
    const methodSelect = document.getElementById('requestMethod');
    if (methodSelect) {
      methodSelect.value = parsed.method;
    }
    this.updateMethodColor();

    // Set headers (add empty row for editing)
    if (parsed.headers.length > 0) {
      this.currentRequest.headers = [...parsed.headers, { enabled: true, key: '', value: '' }];
      this.renderKeyValueRows('headersRows', this.currentRequest.headers);
    }

    // Extract and set params from URL
    this.syncParamsFromUrl();

    // Set body
    if (parsed.body) {
      this.currentRequest.bodyType = 'json';
      this.currentRequest.body = parsed.body;
      
      // Select JSON radio and switch body type
      const jsonRadio = document.querySelector('[name="bodyType"][value="json"]');
      if (jsonRadio) {
        jsonRadio.checked = true;
        this.switchBodyType('json');
      }

      // Set body in editor with a small delay to ensure editor is ready
      setTimeout(() => {
        if (typeof setRequestBody === 'function') {
          try {
            const jsonObj = JSON.parse(parsed.body);
            setRequestBody(jsonObj);
          } catch {
            setRequestBody(parsed.body);
          }
        }
      }, 100);
    }

    this.markTabDirty();
    this.showNotification('✓ Curl komutu yüklendi!');
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

