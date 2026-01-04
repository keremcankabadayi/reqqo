# Reqqo

A powerful REST API testing tool for your browser. The perfect Postman alternative as a Chrome extension.

<img width="1919" height="959" alt="SCR-20260104-mjdo" src="https://github.com/user-attachments/assets/0daa02d0-f8bf-4d6c-a6b8-a85274603108" />

## Features

### Request Building
- **HTTP Methods** - Support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS
- **Request Builder** - Headers, query parameters, and body editor
- **Multiple Body Types** - JSON, Form Data, Raw, or None
- **Authentication** - Basic Auth, Bearer Token, and OAuth 2.0 support
- **cURL Generation** - Generate cURL command from any request
- **Open in Browser** - Open GET requests directly in a new browser tab

### Multi-Tab Interface
- **Multiple Tabs** - Work on multiple requests simultaneously
- **Drag & Drop Reordering** - Organize tabs by dragging
- **Tab Context Menu** - Right-click for rename, duplicate, close options
- **Session Persistence** - Tabs automatically saved and restored on reload
- **Smart Tab Naming** - Auto-generates names from URL or collection path

### JSON Editor
- **Rich JSON Editor** - Powered by JSONEditor library
- **Multiple Modes** - Switch between Code, Tree, and View modes
- **Syntax Highlighting** - Dracula-themed dark syntax colors
- **Search & Navigate** - Find and navigate through JSON data
- **Format & Compact** - One-click JSON formatting

### Collections & History
- **Collections** - Organize your API requests into collections
- **Collection Search** - Quick search with expand/collapse all
- **History** - Automatically saves your request history
- **Import/Export** - Import Postman collections and export your data

### Environments
- **Environment Variables** - Manage variables with `{{placeholder}}` support
- **Multiple Environments** - Switch between dev, staging, production
- **Variable Replacement** - Automatic placeholder substitution in URLs, headers, and body

### Response Viewer
- **Response Info** - Status code, response time, and size display
- **Response Headers** - View all response headers
- **Copy Response** - One-click copy of response body
- **Tree View** - Expand/collapse JSON structure

### UI/UX
- **Modern Dark Theme** - Clean, Dracula-inspired interface
- **Resizable Panels** - Adjust sidebar and request/response panel sizes
- **Responsive Layout** - Adapts to different window sizes
- **Keyboard Shortcuts** - Quick actions for common operations

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the project folder
5. Click the Reqqo icon in your extensions to start

## Usage

### Basic Request
1. Enter a URL in the URL bar
2. Select the HTTP method (GET, POST, etc.)
3. Click "Send" to execute the request

### Working with Tabs
- Click **+** to create a new tab
- **Right-click** a tab for context menu (rename, duplicate, close)
- **Drag tabs** to reorder them
- Double-click tab name to edit

### Adding Headers & Params
- Switch to "Headers" or "Params" tab
- Add key-value pairs
- Toggle checkboxes to enable/disable

### Request Body
- Switch to "Body" tab
- Select body type: JSON, Form Data, Raw, or None
- Use the JSON editor for structured data

### Saving Requests
- Click "Save" dropdown
- Choose "Save as New" or "Update Current"
- Select or create a collection

### Using Environment Variables
1. Create an environment with variables
2. Use `{{variableName}}` syntax in URLs, headers, or body
3. Variables are replaced automatically when sending

### Generating cURL
- Click the terminal icon in the URL bar
- Copy the generated cURL command

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` (in URL field) | Send request |
| `Ctrl/Cmd + S` | Save request |
| `Ctrl/Cmd + I` | Format JSON |
| `Ctrl/Cmd + Shift + I` | Compact JSON |
| `Ctrl/Cmd + Z` | Undo (in editor) |
| `Ctrl/Cmd + Shift + Z` | Redo (in editor) |

## Project Structure

```
reqqo/
├── app/
│   ├── css/
│   │   ├── styles.css       # Main application styles
│   │   ├── tabs.css         # Tab system styles
│   │   └── editor.css       # JSON Editor customizations
│   ├── js/
│   │   ├── app.js           # Main application logic
│   │   ├── auth.js          # Authentication handling
│   │   ├── collections.js   # Collection management
│   │   ├── editor.js        # JSON Editor setup
│   │   ├── history.js       # Request history
│   │   ├── placeholders.js  # Environment variable handling
│   │   ├── request.js       # HTTP request handling
│   │   ├── storage.js       # IndexedDB storage
│   │   └── tabs.js          # Tab management
│   ├── lib/
│   │   ├── jsoneditor.min.js   # JSONEditor library
│   │   ├── jsoneditor.min.css  # JSONEditor styles
│   │   └── vs/                 # Monaco Editor (optional)
│   └── index.html           # Main application page
├── icons/                   # Extension icons
├── background.js            # Service worker
├── manifest.json            # Chrome extension manifest
└── README.md
```

## Technologies

- **Manifest V3** - Latest Chrome extension architecture
- **JSONEditor** - Rich JSON editing with tree/code views
- **IndexedDB** - Client-side storage for collections and history
- **LocalStorage** - Tab session persistence
- **Vanilla JavaScript** - No framework dependencies

## Browser Compatibility

- Google Chrome (recommended)
- Microsoft Edge
- Brave Browser
- Other Chromium-based browsers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Author

Created by [@keremcankabadayi](https://github.com/keremcankabadayi)

---

**Reqqo** - Making API testing simple and accessible.

Built with ❤️ using [Cursor AI](https://cursor.com)
