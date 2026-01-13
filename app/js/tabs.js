class TabManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.nextTabId = 1;
    this.debounceTimer = null;
  }

  createTab(initialData = {}) {
    const tabId = this.nextTabId++;
    
    const defaultRequest = {
      id: null,
      name: '',
      collectionId: null,
      collectionName: null,
      method: 'GET',
      url: '',
      headers: [{ enabled: true, key: 'Content-Type', value: 'application/json' }],
      params: [{ enabled: true, key: '', value: '' }],
      bodyType: 'json',
      body: '',
      formData: [{ enabled: true, key: '', value: '' }],
      rawBody: '',
      auth: null
    };

    const request = { ...defaultRequest, ...initialData.request };
    
    const tab = {
      id: tabId,
      customName: null,
      originalCollectionName: request.collectionName || null,
      originalRequestName: request.name || null,
      request: request,
      response: initialData.response || {
        status: null,
        statusText: null,
        headers: {},
        body: null,
        duration: 0,
        size: 0
      },
      isDirty: false
    };

    this.tabs.push(tab);
    this.activeTabId = tabId;
    
    this.debouncedSave();
    return tab;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return false;

    const tab = this.tabs[index];
    
    if (tab.isDirty) {
      const confirmed = confirm('This tab has unsaved changes. Are you sure you want to close it?');
      if (!confirmed) return false;
    }

    this.tabs.splice(index, 1);

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.activeTabId = this.tabs[newIndex].id;
      } else {
        this.activeTabId = null;
      }
    }

    if (this.tabs.length === 0) {
      this.createTab();
    }

    this.debouncedSave();
    return true;
  }

  closeAllTabs() {
    const hasUnsaved = this.tabs.some(t => t.isDirty);
    if (hasUnsaved) {
      const confirmed = confirm('Some tabs have unsaved changes. Are you sure you want to close all?');
      if (!confirmed) return false;
    }

    this.tabs = [];
    this.activeTabId = null;
    this.createTab();
    
    this.debouncedSave();
    return true;
  }

  closeOtherTabs(tabId) {
    const keepTab = this.tabs.find(t => t.id === tabId);
    if (!keepTab) return false;

    const otherTabsHaveUnsaved = this.tabs.some(t => t.id !== tabId && t.isDirty);
    if (otherTabsHaveUnsaved) {
      const confirmed = confirm('Other tabs have unsaved changes. Are you sure you want to close them?');
      if (!confirmed) return false;
    }

    this.tabs = [keepTab];
    this.activeTabId = tabId;
    
    this.debouncedSave();
    return true;
  }

  duplicateTab(tabId) {
    const originalTab = this.tabs.find(t => t.id === tabId);
    if (!originalTab) return null;

    const duplicatedTab = this.createTab({
      request: JSON.parse(JSON.stringify(originalTab.request)),
      response: JSON.parse(JSON.stringify(originalTab.response))
    });

    if (originalTab.customName) {
      duplicatedTab.customName = `${originalTab.customName} (Copy)`;
    }
    duplicatedTab.isDirty = originalTab.isDirty;

    this.debouncedSave();
    return duplicatedTab;
  }

  switchTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    this.activeTabId = tabId;
    this.debouncedSave();
    return tab;
  }

  updateTab(tabId, data) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    if (data.request) {
      tab.request = { ...tab.request, ...data.request };
      
      if (data.request.collectionName !== undefined) {
        tab.originalCollectionName = data.request.collectionName;
      }
      if (data.request.name !== undefined) {
        tab.originalRequestName = data.request.name;
      }
    }

    if (data.response) {
      tab.response = { ...tab.response, ...data.response };
    }

    if (data.isDirty !== undefined) {
      tab.isDirty = data.isDirty;
    }

    this.debouncedSave();
    return tab;
  }

  updateTabName(tabId, customName) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    tab.customName = customName && customName.trim() ? customName.trim() : null;
    
    this.debouncedSave();
    return tab;
  }

  resetTabName(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    tab.customName = null;
    
    this.debouncedSave();
    return tab;
  }

  reorderTabs(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.tabs.length) return false;
    if (toIndex < 0 || toIndex >= this.tabs.length) return false;
    if (fromIndex === toIndex) return false;

    const [movedTab] = this.tabs.splice(fromIndex, 1);
    this.tabs.splice(toIndex, 0, movedTab);

    this.debouncedSave();
    return true;
  }

  generateTabName(request) {
    if (request.collectionName && request.name) {
      return `${request.collectionName}/${request.name}`;
    }
    
    if (request.name) {
      return request.name;
    }
    
    if (request.url) {
      return this.extractNameFromUrl(request.url);
    }
    
    return this.generateUniqueNewName();
  }

  extractNameFromUrl(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      let pathname = urlObj.pathname || '/';
      
      pathname = decodeURIComponent(pathname);
      
      const parts = pathname.split('/').filter(p => p);
      if (parts.length > 0) {
        if (parts.length > 1) {
          return parts.slice(-2).join('/');
        }
        return parts[parts.length - 1];
      }
      
      return urlObj.hostname || 'New Request';
    } catch {
      return 'New Request';
    }
  }

  generateUniqueNewName() {
    const existingNewRequestNames = [];
    
    for (const tab of this.tabs) {
      let name;
      if (tab.customName) {
        name = tab.customName;
      } else if (tab.originalRequestName) {
        if (tab.originalCollectionName) {
          name = `${tab.originalCollectionName}/${tab.originalRequestName}`;
        } else {
          name = tab.originalRequestName;
        }
      } else if (tab.request && tab.request.url) {
        name = this.extractNameFromUrl(tab.request.url);
      } else {
        continue;
      }
      
      if (name.startsWith('New Request')) {
        existingNewRequestNames.push(name);
      }
    }
    
    if (existingNewRequestNames.length === 0 || !existingNewRequestNames.includes('New Request')) {
      return 'New Request';
    }

    let counter = 2;
    while (existingNewRequestNames.includes(`New Request (${counter})`)) {
      counter++;
    }
    
    return `New Request (${counter})`;
  }

  getDisplayName(tab) {
    if (tab.customName) {
      return tab.customName;
    }
    
    return this.generateTabName(tab.request);
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  }

  getAllTabs() {
    return this.tabs;
  }

  getTabById(tabId) {
    return this.tabs.find(t => t.id === tabId);
  }

  debouncedSave() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.saveToLocalStorage();
    }, 500);
  }

  saveToLocalStorage() {
    try {
      const data = {
        tabs: this.tabs,
        activeTabId: this.activeTabId,
        nextTabId: this.nextTabId
      };
      
      localStorage.setItem('reqqo_tabs', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save tabs to localStorage:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const savedData = localStorage.getItem('reqqo_tabs');
      if (!savedData) {
        this.createTab();
        return false;
      }

      const data = JSON.parse(savedData);
      
      if (data.tabs && Array.isArray(data.tabs) && data.tabs.length > 0) {
        this.tabs = data.tabs;
        this.activeTabId = data.activeTabId || data.tabs[0].id;
        this.nextTabId = data.nextTabId || (Math.max(...data.tabs.map(t => t.id)) + 1);
        return true;
      } else {
        this.createTab();
        return false;
      }
    } catch (error) {
      console.error('Failed to load tabs from localStorage:', error);
      this.createTab();
      return false;
    }
  }

  clearLocalStorage() {
    try {
      localStorage.removeItem('reqqo_tabs');
    } catch (error) {
      console.error('Failed to clear tabs from localStorage:', error);
    }
  }
}

window.tabManager = new TabManager();

