class CollectionsManager {
  constructor() {
    this.collections = [];
  }

  async loadCollections() {
    this.collections = await storage.getAll(STORES.COLLECTIONS);
    return this.collections.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCollection(name, customId = null) {
    const collection = {
      name,
      createdAt: Date.now()
    };
    
    if (customId) {
      collection.id = customId;
    }

    const saved = await storage.add(STORES.COLLECTIONS, collection);
    this.collections.push(saved);
    return saved;
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
    return collection;
  }

  async deleteCollection(id) {
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
      createdAt: Date.now()
    };

    return await storage.add(STORES.REQUESTS, request);
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
      request.collectionId = collectionId;
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

