const DB_NAME = 'RestClientDB';
const DB_VERSION = 1;

const STORES = {
  COLLECTIONS: 'collections',
  REQUESTS: 'requests',
  HISTORY: 'history',
  ENVIRONMENTS: 'environments',
  AUTH: 'auth'
};

class Storage {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.COLLECTIONS)) {
          const collectionsStore = db.createObjectStore(STORES.COLLECTIONS, { keyPath: 'id' });
          collectionsStore.createIndex('name', 'name', { unique: false });
          collectionsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.REQUESTS)) {
          const requestsStore = db.createObjectStore(STORES.REQUESTS, { keyPath: 'id' });
          requestsStore.createIndex('collectionId', 'collectionId', { unique: false });
          requestsStore.createIndex('name', 'name', { unique: false });
          requestsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          const historyStore = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
          historyStore.createIndex('url', 'url', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.ENVIRONMENTS)) {
          const envsStore = db.createObjectStore(STORES.ENVIRONMENTS, { keyPath: 'id' });
          envsStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.AUTH)) {
          db.createObjectStore(STORES.AUTH, { keyPath: 'id' });
        }
      };
    });
  }

  async ensureDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async add(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      if (!data.id) {
        data.id = this.generateId();
      }
      if (!data.createdAt) {
        data.createdAt = Date.now();
      }
      data.updatedAt = Date.now();

      const request = store.add(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async update(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      data.updatedAt = Date.now();

      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, id) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

const storage = new Storage();

