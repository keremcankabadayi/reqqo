class CollectionsManager {
  constructor() {
    this.collections = [];
  }

  async loadCollections() {
    this.collections = await storage.getAll(STORES.COLLECTIONS);
    return this.collections.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCollection(name, customId = null, parentId = null) {
    // Get max order for siblings
    const siblings = parentId 
      ? await this.getChildCollections(parentId)
      : (await this.getAllCollections()).filter(c => !c.parentId);
    const maxOrder = siblings.reduce((max, c) => Math.max(max, c.order || 0), 0);
    
    const collection = {
      name,
      parentId: parentId,
      order: maxOrder + 1,
      createdAt: Date.now()
    };
    
    if (customId) {
      collection.id = customId;
    }

    const saved = await storage.add(STORES.COLLECTIONS, collection);
    this.collections.push(saved);
    return saved;
  }

  async getChildCollections(parentId) {
    const all = await this.getAllCollections();
    return all.filter(c => c.parentId === parentId);
  }

  async getRootCollections() {
    const all = await this.getAllCollections();
    return all.filter(c => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAllCollections() {
    return await storage.getAll(STORES.COLLECTIONS);
  }

  async importRequest(requestData) {
    const request = {
      id: requestData.id,
      name: requestData.name,
      method: requestData.method,
      url: requestData.url,
      headers: requestData.headers || [],
      params: requestData.params || [],
      bodyType: requestData.bodyType || 'none',
      body: requestData.body || '',
      auth: requestData.auth,
      collectionId: requestData.collectionId,
      createdAt: requestData.createdAt || Date.now()
    };

    return await storage.add(STORES.REQUESTS, request);
  }

  async updateCollection(id, name) {
    const collection = await storage.get(STORES.COLLECTIONS, id);
    if (collection) {
      collection.name = name;
      await storage.update(STORES.COLLECTIONS, collection);
      
      const index = this.collections.findIndex(c => c.id === id);
      if (index !== -1) {
        this.collections[index] = collection;
      }
    }
  }

  async updateCollectionParent(id, newParentId) {
    const collection = await storage.get(STORES.COLLECTIONS, id);
    if (collection) {
      // Set parentId (null for root, or the new parent's id)
      collection.parentId = newParentId || null;
      
      // Get max order for new siblings
      const siblings = newParentId 
        ? await this.getChildCollections(newParentId)
        : (await this.getAllCollections()).filter(c => !c.parentId && c.id !== id);
      const maxOrder = siblings.reduce((max, c) => Math.max(max, c.order || 0), 0);
      collection.order = maxOrder + 1;
      
      await storage.update(STORES.COLLECTIONS, collection);
      
      // Update in-memory cache
      const index = this.collections.findIndex(c => c.id === id);
      if (index !== -1) {
        this.collections[index] = { ...collection };
      }
    }
  }

  async reorderCollection(collectionId, targetCollectionId, position) {
    // position: 'before' or 'after'
    const collection = await storage.get(STORES.COLLECTIONS, collectionId);
    const target = await storage.get(STORES.COLLECTIONS, targetCollectionId);
    
    if (!collection || !target) {
      console.error('reorderCollection: collection or target not found', { collectionId, targetCollectionId });
      return;
    }
    
    // Only reorder within same parent level (normalize null/undefined)
    const collectionParent = collection.parentId || null;
    const targetParent = target.parentId || null;
    
    if (collectionParent !== targetParent) {
      console.log('reorderCollection: different parents, skipping', { collectionParent, targetParent });
      return;
    }
    
    // Get all siblings (normalize parentId check for root collections)
    const allCollections = await this.getAllCollections();
    const siblings = collectionParent 
      ? allCollections.filter(c => c.parentId === collectionParent)
      : allCollections.filter(c => !c.parentId);
    
    // Sort by current order
    siblings.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Remove the dragged collection from list
    const filtered = siblings.filter(c => c.id !== collectionId);
    
    // Find target index
    const targetIndex = filtered.findIndex(c => c.id === targetCollectionId);
    
    if (targetIndex === -1) {
      console.error('reorderCollection: target not found in siblings', { targetCollectionId, siblings: filtered.map(c => c.id) });
      return;
    }
    
    // Insert at correct position
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    filtered.splice(insertIndex, 0, collection);
    
    // Update order for all siblings
    for (let i = 0; i < filtered.length; i++) {
      const col = filtered[i];
      col.order = i + 1;
      await storage.update(STORES.COLLECTIONS, col);
      
      const index = this.collections.findIndex(c => c.id === col.id);
      if (index !== -1) {
        this.collections[index] = col;
      }
    }
    
    console.log('reorderCollection: success', { collectionId, position, newOrder: collection.order });
    return collection;
  }

  async deleteCollection(id) {
    // First delete all child collections recursively
    const children = await this.getChildCollections(id);
    for (const child of children) {
      await this.deleteCollection(child.id);
    }
    
    // Delete all requests in this collection
    const requests = await this.getRequestsInCollection(id);
    for (const request of requests) {
      await storage.delete(STORES.REQUESTS, request.id);
    }

    await storage.delete(STORES.COLLECTIONS, id);
    this.collections = this.collections.filter(c => c.id !== id);
  }

  async getCollection(id) {
    return await storage.get(STORES.COLLECTIONS, id);
  }

  async saveRequest(requestData, collectionId = null) {
    // Get max order for requests in this collection
    const siblings = await this.getRequestsInCollection(collectionId);
    const maxOrder = siblings.reduce((max, r) => Math.max(max, r.order || 0), 0);
    
    const request = {
      name: requestData.name,
      method: requestData.method,
      url: requestData.url,
      headers: requestData.headers,
      params: requestData.params,
      bodyType: requestData.bodyType,
      body: requestData.body,
      auth: requestData.auth,
      collectionId,
      order: maxOrder + 1,
      createdAt: Date.now()
    };

    return await storage.add(STORES.REQUESTS, request);
  }

  async reorderRequest(requestId, targetRequestId, position) {
    // position: 'before' or 'after'
    const request = await storage.get(STORES.REQUESTS, requestId);
    const target = await storage.get(STORES.REQUESTS, targetRequestId);
    
    if (!request || !target) return;
    
    // Only reorder within same collection
    if (request.collectionId !== target.collectionId) return;
    
    // Get all requests in collection
    const siblings = await this.getRequestsInCollection(request.collectionId);
    
    // Sort by current order
    siblings.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Remove the dragged request from list
    const filtered = siblings.filter(r => r.id !== requestId);
    
    // Find target index
    const targetIndex = filtered.findIndex(r => r.id === targetRequestId);
    
    // Insert at correct position
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    filtered.splice(insertIndex, 0, request);
    
    // Update order for all requests
    for (let i = 0; i < filtered.length; i++) {
      const req = filtered[i];
      req.order = i + 1;
      await storage.update(STORES.REQUESTS, req);
    }
  }

  async updateRequest(id, requestData) {
    const request = await storage.get(STORES.REQUESTS, id);
    if (request) {
      Object.assign(request, {
        name: requestData.name,
        method: requestData.method,
        url: requestData.url,
        headers: requestData.headers,
        params: requestData.params,
        bodyType: requestData.bodyType,
        body: requestData.body,
        auth: requestData.auth,
        collectionId: requestData.collectionId
      });
      await storage.update(STORES.REQUESTS, request);
    }
    return request;
  }

  async deleteRequest(id) {
    return await storage.delete(STORES.REQUESTS, id);
  }

  async getRequest(id) {
    return await storage.get(STORES.REQUESTS, id);
  }

  async getRequestsInCollection(collectionId) {
    return await storage.getByIndex(STORES.REQUESTS, 'collectionId', collectionId);
  }

  async getUncategorizedRequests() {
    const allRequests = await storage.getAll(STORES.REQUESTS);
    return allRequests.filter(r => !r.collectionId);
  }

  async getAllRequests() {
    return await storage.getAll(STORES.REQUESTS);
  }

  async moveRequestToCollection(requestId, collectionId) {
    const request = await storage.get(STORES.REQUESTS, requestId);
    if (request) {
      // Get max order in new collection
      const siblings = await this.getRequestsInCollection(collectionId);
      const maxOrder = siblings.reduce((max, r) => Math.max(max, r.order || 0), 0);
      
      request.collectionId = collectionId;
      request.order = maxOrder + 1;
      await storage.update(STORES.REQUESTS, request);
    }
    return request;
  }

  async duplicateRequest(requestId) {
    const original = await storage.get(STORES.REQUESTS, requestId);
    if (original) {
      const duplicate = { ...original };
      delete duplicate.id;
      delete duplicate.createdAt;
      duplicate.name = `${original.name} (Copy)`;
      return await storage.add(STORES.REQUESTS, duplicate);
    }
    return null;
  }

  async searchRequests(query) {
    const allRequests = await this.getAllRequests();
    const lowerQuery = query.toLowerCase();
    
    return allRequests.filter(request =>
      request.name.toLowerCase().includes(lowerQuery) ||
      request.url.toLowerCase().includes(lowerQuery)
    );
  }

  async exportCollection(collectionId) {
    const collection = await this.getCollection(collectionId);
    const requests = await this.getRequestsInCollection(collectionId);
    
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      collection: {
        name: collection.name,
        requests: requests.map(r => ({
          name: r.name,
          method: r.method,
          url: r.url,
          headers: r.headers,
          params: r.params,
          bodyType: r.bodyType,
          body: r.body
        }))
      }
    };
  }

  async importCollection(data) {
    if (!data.collection || !data.collection.name) {
      throw new Error('Invalid collection data');
    }

    const collection = await this.createCollection(data.collection.name);
    
    if (data.collection.requests && Array.isArray(data.collection.requests)) {
      for (const reqData of data.collection.requests) {
        await this.saveRequest({
          name: reqData.name || 'Imported Request',
          method: reqData.method || 'GET',
          url: reqData.url || '',
          headers: reqData.headers || [],
          params: reqData.params || [],
          bodyType: reqData.bodyType || 'none',
          body: reqData.body || ''
        }, collection.id);
      }
    }

    return collection;
  }
}

const collectionsManager = new CollectionsManager();

