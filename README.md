# ClipAI

A Chrome extension that makes it easy to bookmark entire pages or clip specific elements from web pages. Perfect for research, saving articles, collecting design inspiration, or building a personal knowledge base.

![Image](https://github.com/user-attachments/assets/df96135f-454c-416a-b415-f0266ed41123)

## Features

### 🔖 Page Bookmarking
- Save entire web pages with a single click
- Automatically extracts metadata including:
  - Page title
  - Keywords
  - Featured images
  - Page description

### ✂️ Element Clipping
- Hover over any element to highlight it
- Click to save specific parts of a webpage:
  - Text blocks
  - Images
  - Articles
  - Any HTML element
- Visual highlighting shows exactly what will be clipped
- Save elements with original formatting preserved

### 🔍 Smart Organization
- Search through your saved clips
- Sort by newest or oldest
- Automatic keyword extraction
- Preview saved content directly in the extension

## Installation

1. Visit the [Chrome Web Store](#) (coming soon)
2. Click "Add to Chrome"
3. The ClipAI icon will appear in your Chrome toolbar

## Development

```bash
# Clone the repository
git clone https://github.com/addyosmani/clipai.git

# Install dependencies
npm install

# Build the extension
npm run build

# Load into Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` directory
```

### Create a Consistent Key

The Chrome extension ID may change between sessions, making it difficult to use origin trial tokens. To create a consistent key:

1. Load the extension as described above.
2. Click "Pack extension" and select the `dist` directory. This will generate a `dist.pem` file.
3. Run the following to output a public key:
    ```shell
    openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
    ```
4. Copy the output into the `key` key of `manifest.json`.
5. Run `npm run build`.
6. Reload the extension in Chrome.

The ID assigned to your extension will now remain consistent.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development Flow

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Project Structure

```
clipai/
├── manifest.json     # Extension manifest
├── background.js     # Service worker
├── content.js        # Content script for page interaction
├── content.css      # Styles for page interaction
├── sidebar.js       # Extension UI logic
├── sidebar.html     # Extension UI layout
└── styles.css       # Extension UI styles
```

### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Write unit tests for new features
- Follow Chrome extension best practices

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Security

If you discover any security-related issues, please email security@example.com instead of using the issue tracker.

## Support

- [GitHub Issues](https://github.com/addyosmani/clipai/issues)

## Acknowledgments

- Built with [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/)
- Icons from [Heroicons](https://heroicons.com/)
