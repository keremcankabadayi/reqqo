# Reqqo

A powerful REST API testing tool for your browser. The perfect Postman alternative as a Chrome extension.

![Reqqo Screenshot](screenshots/reqqo-preview.png)

## Features

- **HTTP Methods** - Support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS
- **Request Builder** - Headers, query parameters, and body editor with JSON syntax highlighting
- **Collections** - Organize your API requests into collections
- **History** - Automatically saves your request history
- **Environments** - Manage environment variables with placeholder support
- **Authentication** - Basic Auth, Bearer Token, and OAuth 2.0 support
- **Import/Export** - Import Postman collections and export your data
- **Monaco Editor** - VS Code-like JSON editing experience
- **Modern UI** - Clean, dark-themed interface

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

1. **Send a Request**: Enter a URL, select the HTTP method, and click "Send"
2. **Add Headers**: Switch to the "Headers" tab to add custom headers
3. **Add Body**: Use the "Body" tab for POST/PUT requests with JSON data
4. **Save to Collection**: Click "Save" to organize requests into collections
5. **Use Environments**: Create environments with variables like `{{baseUrl}}`

## Keyboard Shortcuts

- `Enter` in URL field - Send request
- `Ctrl/Cmd + S` - Save request

## Project Structure

```
reqqo/
├── app/
│   ├── css/          # Stylesheets
│   ├── js/           # Application logic
│   │   ├── app.js        # Main application
│   │   ├── auth.js       # Authentication handling
│   │   ├── collections.js # Collection management
│   │   ├── history.js    # Request history
│   │   ├── request.js    # HTTP request handling
│   │   └── storage.js    # IndexedDB storage
│   └── lib/          # Third-party libraries (Monaco, JSONEditor)
├── icons/            # Extension icons
├── background.js     # Service worker
└── manifest.json     # Chrome extension manifest
```

## Technologies

- **Manifest V3** - Latest Chrome extension architecture
- **Monaco Editor** - VS Code's editor component
- **IndexedDB** - Client-side storage for collections and history
- **Vanilla JavaScript** - No framework dependencies

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

