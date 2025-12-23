let requestBodyEditor = null;
let responseBodyEditor = null;

function initEditors() {
  const requestContainer = document.getElementById('requestBodyEditor');
  if (requestContainer && typeof JSONEditor !== 'undefined') {
    requestBodyEditor = new JSONEditor(requestContainer, {
      mode: 'code',
      modes: ['code', 'tree'],
      search: false,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
      onChange: function() {
        try {
          if (window.app) {
            window.app.currentRequest.body = requestBodyEditor.getText();
          }
        } catch (e) {
          // Invalid JSON, still update as text
          if (window.app) {
            window.app.currentRequest.body = requestBodyEditor.getText();
          }
        }
      }
    });
    
    // Set empty object initially
    requestBodyEditor.setText('');
  }
  
  const responseContainer = document.getElementById('responseBodyEditor');
  if (responseContainer && typeof JSONEditor !== 'undefined') {
    responseBodyEditor = new JSONEditor(responseContainer, {
      mode: 'view',
      modes: ['view', 'code', 'tree'],
      search: false,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
      onEditable: function() {
        return false; // Read-only
      }
    });
    
    // Set placeholder
    responseBodyEditor.setText('Send a request to see the response');
  }
  
}

// Helper functions for external access
function setRequestBody(value) {
  if (requestBodyEditor) {
    try {
      if (typeof value === 'object') {
        requestBodyEditor.set(value);
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const json = JSON.parse(value);
          requestBodyEditor.set(json);
        } catch {
          requestBodyEditor.setText(value);
        }
      } else {
        requestBodyEditor.setText(value || '');
      }
    } catch (e) {
      requestBodyEditor.setText(value || '');
    }
  }
}

function getRequestBody() {
  if (requestBodyEditor) {
    try {
      return requestBodyEditor.getText();
    } catch {
      return '';
    }
  }
  return '';
}

function setResponseBody(value) {
  if (responseBodyEditor) {
    try {
      if (typeof value === 'object') {
        responseBodyEditor.set(value);
        responseBodyEditor.setMode('view');
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const json = JSON.parse(value);
          responseBodyEditor.set(json);
          responseBodyEditor.setMode('view');
        } catch {
          responseBodyEditor.setText(value);
          responseBodyEditor.setMode('code');
        }
      } else {
        responseBodyEditor.setText(value || '');
      }
    } catch (e) {
      responseBodyEditor.setText(String(value) || '');
    }
  }
}

function getResponseBody() {
  if (responseBodyEditor) {
    try {
      return responseBodyEditor.getText();
    } catch {
      return '';
    }
  }
  return '';
}

document.addEventListener('DOMContentLoaded', initEditors);
