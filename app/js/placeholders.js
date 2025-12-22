class PlaceholderManager {
  constructor() {
    this.activeEnvironment = null;
    this.environments = [];
  }

  async loadEnvironments() {
    this.environments = await storage.getAll(STORES.ENVIRONMENTS);
    return this.environments;
  }

  async setActiveEnvironment(envId) {
    if (envId) {
      this.activeEnvironment = await storage.get(STORES.ENVIRONMENTS, envId);
    } else {
      this.activeEnvironment = null;
    }
    return this.activeEnvironment;
  }

  async createEnvironment(name, variables = {}) {
    const env = {
      name,
      variables,
      createdAt: Date.now()
    };
    const saved = await storage.add(STORES.ENVIRONMENTS, env);
    this.environments.push(saved);
    return saved;
  }

  async updateEnvironment(id, name, variables) {
    const env = await storage.get(STORES.ENVIRONMENTS, id);
    if (env) {
      env.name = name;
      env.variables = variables;
      await storage.update(STORES.ENVIRONMENTS, env);
      
      const index = this.environments.findIndex(e => e.id === id);
      if (index !== -1) {
        this.environments[index] = env;
      }
      
      if (this.activeEnvironment && this.activeEnvironment.id === id) {
        this.activeEnvironment = env;
      }
    }
    return env;
  }

  async deleteEnvironment(id) {
    await storage.delete(STORES.ENVIRONMENTS, id);
    this.environments = this.environments.filter(e => e.id !== id);
    
    if (this.activeEnvironment && this.activeEnvironment.id === id) {
      this.activeEnvironment = null;
    }
  }

  replacePlaceholders(text) {
    if (!text || !this.activeEnvironment) {
      return text;
    }

    const variables = this.activeEnvironment.variables || {};
    
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      if (variables.hasOwnProperty(trimmedKey)) {
        return variables[trimmedKey];
      }
      return match;
    });
  }

  replaceInObject(obj) {
    if (!obj || !this.activeEnvironment) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.replacePlaceholders(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceInObject(item));
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const key of Object.keys(obj)) {
        result[key] = this.replaceInObject(obj[key]);
      }
      return result;
    }

    return obj;
  }

  extractPlaceholders(text) {
    if (!text) return [];
    
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
  }

  getVariableValue(key) {
    if (!this.activeEnvironment || !this.activeEnvironment.variables) {
      return undefined;
    }
    return this.activeEnvironment.variables[key];
  }

  getAllVariables() {
    if (!this.activeEnvironment) {
      return {};
    }
    return this.activeEnvironment.variables || {};
  }
}

const placeholderManager = new PlaceholderManager();

