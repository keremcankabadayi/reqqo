class AuthManager {
  constructor() {
    this.currentAuth = {
      type: 'none',
      data: {}
    };
  }

  setAuth(type, data = {}) {
    this.currentAuth = { type, data };
  }

  getAuth() {
    return this.currentAuth;
  }

  clearAuth() {
    this.currentAuth = { type: 'none', data: {} };
  }

  generateBasicAuthHeader(username, password) {
    const credentials = btoa(`${username}:${password}`);
    return `Basic ${credentials}`;
  }

  generateBearerHeader(token) {
    return `Bearer ${token}`;
  }

  applyAuthToHeaders(headers = {}) {
    const { type, data } = this.currentAuth;

    switch (type) {
      case 'basic':
        if (data.username && data.password) {
          headers['Authorization'] = this.generateBasicAuthHeader(data.username, data.password);
        }
        break;

      case 'bearer':
        if (data.token) {
          headers['Authorization'] = this.generateBearerHeader(data.token);
        }
        break;

      case 'oauth2':
        if (data.accessToken) {
          headers['Authorization'] = this.generateBearerHeader(data.accessToken);
        }
        break;
    }

    return headers;
  }

  async fetchOAuth2Token(config) {
    const { grantType, tokenUrl, clientId, clientSecret, scope, authCode, redirectUri } = config;

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    if (grantType === 'client_credentials') {
      params.append('grant_type', 'client_credentials');
      if (scope) {
        params.append('scope', scope);
      }
    } else if (grantType === 'authorization_code') {
      params.append('grant_type', 'authorization_code');
      params.append('code', authCode);
      if (redirectUri) {
        params.append('redirect_uri', redirectUri);
      }
    }

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        this.currentAuth = {
          type: 'oauth2',
          data: {
            accessToken: data.access_token,
            tokenType: data.token_type || 'Bearer',
            expiresIn: data.expires_in,
            refreshToken: data.refresh_token,
            scope: data.scope,
            obtainedAt: Date.now()
          }
        };
        return { success: true, data: this.currentAuth.data };
      } else {
        return { 
          success: false, 
          error: data.error_description || data.error || 'Failed to obtain token' 
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  isTokenExpired() {
    if (this.currentAuth.type !== 'oauth2') return false;
    
    const { expiresIn, obtainedAt } = this.currentAuth.data;
    if (!expiresIn || !obtainedAt) return false;

    const expirationTime = obtainedAt + (expiresIn * 1000);
    return Date.now() >= expirationTime;
  }

  serializeAuth() {
    return JSON.stringify(this.currentAuth);
  }

  deserializeAuth(json) {
    try {
      this.currentAuth = JSON.parse(json);
    } catch {
      this.clearAuth();
    }
  }

  async saveAuth(name) {
    const authData = {
      name,
      ...this.currentAuth,
      savedAt: Date.now()
    };
    return await storage.add(STORES.AUTH, authData);
  }

  async loadSavedAuths() {
    return await storage.getAll(STORES.AUTH);
  }

  async deleteSavedAuth(id) {
    return await storage.delete(STORES.AUTH, id);
  }
}

const authManager = new AuthManager();

