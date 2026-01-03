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
  
  // Fix search box frame background and input styling
  function fixSearchInputStyles() {
    const inputs = document.querySelectorAll('.jsoneditor-frame input[type="text"], .jsoneditor-search input, .jsoneditor-frame input, .jsoneditor-search input[type="text"]');
    
    inputs.forEach(input => {
      // Break the color inheritance chain - start from input itself and go up
      let el = input;
      while (el && el !== document.body) {
        el.style.setProperty('color', 'inherit', 'important');
        el.style.setProperty('-webkit-text-fill-color', 'inherit', 'important');
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('mix-blend-mode', 'normal', 'important');
        el = el.parentElement;
      }
      
      // Now set the input's own color to black
      input.style.setProperty('color', 'black', 'important');
      input.style.setProperty('-webkit-text-fill-color', 'black', 'important');
      input.style.setProperty('background', 'white', 'important');
      input.style.setProperty('background-color', 'white', 'important');
      input.style.setProperty('caret-color', 'black', 'important');
      input.style.setProperty('border', '1px solid #ccc', 'important');
      input.style.setProperty('padding', '6px 8px', 'important');
      input.style.setProperty('font-size', '14px', 'important');
      input.style.setProperty('font-family', 'Arial, sans-serif', 'important');
      input.style.setProperty('width', '180px', 'important');
      input.style.setProperty('height', '28px', 'important');
      input.style.setProperty('box-sizing', 'border-box', 'important');
      input.style.setProperty('opacity', '1', 'important');
      input.style.setProperty('visibility', 'visible', 'important');
      
      if (!input.dataset.listenerAttached) {
        const forceBlackText = function() {
          // Re-apply the fix on every interaction
          let el = input;
          while (el && el !== document.body) {
            el.style.setProperty('color', 'inherit', 'important');
            el.style.setProperty('-webkit-text-fill-color', 'inherit', 'important');
            el.style.setProperty('filter', 'none', 'important');
            el.style.setProperty('mix-blend-mode', 'normal', 'important');
            el = el.parentElement;
          }
          input.style.setProperty('color', 'black', 'important');
          input.style.setProperty('-webkit-text-fill-color', 'black', 'important');
          input.style.setProperty('caret-color', 'black', 'important');
          input.style.setProperty('background-color', 'white', 'important');
        };
        
        input.addEventListener('input', forceBlackText);
        input.addEventListener('focus', forceBlackText);
        input.addEventListener('keydown', forceBlackText);
        input.addEventListener('keyup', forceBlackText);
        input.addEventListener('keypress', forceBlackText);
        input.addEventListener('change', forceBlackText);
        input.addEventListener('blur', forceBlackText);
        
        input.dataset.listenerAttached = 'true';
      }
    });
    
    const frames = document.querySelectorAll('.jsoneditor-frame');
    frames.forEach(frame => {
      frame.style.setProperty('background-color', 'transparent', 'important');
    });
  }
  
  setTimeout(fixSearchInputStyles, 100);
  setTimeout(fixSearchInputStyles, 500);
  setTimeout(fixSearchInputStyles, 1000);
  
  // Continuous check
  setInterval(fixSearchInputStyles, 2000);
  
  // Observer for dynamic changes
  const observer = new MutationObserver(fixSearchInputStyles);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
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
