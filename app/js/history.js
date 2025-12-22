class HistoryManager {
  constructor() {
    this.maxHistoryItems = 100;
  }

  async addToHistory(requestData) {
    const historyItem = {
      method: requestData.method,
      url: requestData.url,
      requestHeaders: requestData.requestHeaders,
      requestBody: requestData.requestBody,
      response: {
        status: requestData.response.status,
        statusText: requestData.response.statusText,
        duration: requestData.response.duration,
        size: requestData.response.size
      },
      timestamp: Date.now()
    };

    await storage.add(STORES.HISTORY, historyItem);
    await this.pruneHistory();

    return historyItem;
  }

  async pruneHistory() {
    const history = await this.getHistory();
    
    if (history.length > this.maxHistoryItems) {
      const itemsToRemove = history.slice(this.maxHistoryItems);
      for (const item of itemsToRemove) {
        await storage.delete(STORES.HISTORY, item.id);
      }
    }
  }

  async getHistory() {
    const history = await storage.getAll(STORES.HISTORY);
    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getHistoryItem(id) {
    return await storage.get(STORES.HISTORY, id);
  }

  async deleteHistoryItem(id) {
    return await storage.delete(STORES.HISTORY, id);
  }

  async clearHistory() {
    return await storage.clear(STORES.HISTORY);
  }

  async searchHistory(query) {
    const history = await this.getHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.filter(item => 
      item.url.toLowerCase().includes(lowerQuery) ||
      item.method.toLowerCase().includes(lowerQuery)
    );
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  groupHistoryByDate(history) {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    history.forEach(item => {
      const itemDate = new Date(item.timestamp);
      
      if (itemDate >= today) {
        groups.today.push(item);
      } else if (itemDate >= yesterday) {
        groups.yesterday.push(item);
      } else if (itemDate >= weekAgo) {
        groups.thisWeek.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  }
}

const historyManager = new HistoryManager();

