let requestBodyEditor = null;
let responseBodyEditor = null;

function initEditors() {
  const requestContainer = document.getElementById('requestBodyEditor');
  if (requestContainer && typeof JSONEditor !== 'undefined') {
    requestBodyEditor = new JSONEditor(requestContainer, {
      mode: 'code',
      modes: ['code', 'tree'],
      search: true,
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
      search: true,
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
  
  // Fix search box frame background
  setTimeout(() => {
    const frames = document.querySelectorAll('.jsoneditor-frame');
    frames.forEach(frame => {
      frame.style.backgroundColor = 'transparent';
    });
  }, 100);
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
  if (!responseBodyEditor) return;
  
  try {
    // Clear the editor completely for empty values
    if (value === null || value === undefined || value === '') {
      try {
        responseBodyEditor.set({});
        responseBodyEditor.setMode('code');
        responseBodyEditor.setText('');
      } catch (e) {
        // If set fails, just update the text content directly
        const editorContent = responseBodyEditor.aceEditor || responseBodyEditor;
        if (editorContent && editorContent.setValue) {
          editorContent.setValue('');
        }
      }
      return;
    }

    if (typeof value === 'object') {
      try {
        responseBodyEditor.set(value);
        responseBodyEditor.setMode('view');
      } catch (e) {
        responseBodyEditor.setText(JSON.stringify(value, null, 2));
        responseBodyEditor.setMode('code');
      }
    } else if (typeof value === 'string') {
      const trimmedValue = value.trim();
      
      if (trimmedValue === '') {
        try {
          responseBodyEditor.set({});
          responseBodyEditor.setMode('code');
          responseBodyEditor.setText('');
        } catch (e) {
          const editorContent = responseBodyEditor.aceEditor || responseBodyEditor;
          if (editorContent && editorContent.setValue) {
            editorContent.setValue('');
          }
        }
        return;
      }

      if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
        try {
          const json = JSON.parse(trimmedValue);
          responseBodyEditor.set(json);
          responseBodyEditor.setMode('view');
          return;
        } catch (e) {
          console.log('Not valid JSON, displaying as text');
        }
      }
      
      responseBodyEditor.setText(value);
      responseBodyEditor.setMode('code');
    } else {
      responseBodyEditor.setText(String(value));
      responseBodyEditor.setMode('code');
    }
  } catch (e) {
    console.error('Error setting response body:', e);
    // Last resort: try to set empty object
    try {
      responseBodyEditor.set({});
      responseBodyEditor.setMode('code');
    } catch (e2) {
      console.error('Failed to clear response body:', e2);
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
