# Tillandsia Runtime

A Progressive Web App (PWA) designed to open local HTML files directly in your web browser.

This tool is especially useful for mobile browsers or restricted operating system environments that do not natively support opening local HTML files.

**Try the live PWA:** https://muhammedsaleem-brej.github.io/Tillandsia-Runtime/

The application reads the selected HTML file locally and runs it inside an embedded runtime frame using a Blob URL. Optional runtime controls allow the user to enable selected sandbox capabilities and browser permissions where the browser supports them.

## Features

### Local HTML Runtime

Open `.html` or `.htm` files directly from the browser's file picker or by dragging and dropping them into the application. The file is processed locally on the device.

### Advanced Runtime Mode

The runtime can configure iframe sandboxing and selected Permissions Policy features. This provides a controlled way to experiment with browser capabilities such as camera, microphone, geolocation, fullscreen, and display capture, subject to the browser's own security model and permission requirements.

### File Caching & Bookmarks / Shortcuts

An optional caching mode stores the selected HTML file in the browser's Cache Storage and gives it a stable application URL containing its unique file ID and runtime configuration.

The application intentionally runs in standard browser mode (`display: browser`) so the browser can retain the runtime URL when creating a bookmark or shortcut.

## Limitations

### Single-File Runtime

If the HTML file relies on local assets referenced by relative paths, such as:

```html
<link rel="stylesheet" href="./style.css">
<script src="./app.js"></script>
```

or local images, those assets will not be available from the selected device file.

### Browser Security Restrictions

Advanced capabilities are ultimately controlled by the browser. Enabling a capability in the runtime configuration does not bypass browser permission prompts, iframe restrictions, secure-context requirements, sandbox restrictions, or Permissions Policy. Support also varies between browsers and platforms.

## How to Use

1. Open the application from the live PWA or your own hosted copy.
2. Optionally enable **Cache file for bookmark or shortcut** if you want the file to remain available through a stable runtime URL.
3. Configure the runtime options if needed. Keep advanced permissions disabled unless the HTML application actually needs them.
4. Drag and drop an `.html` or `.htm` file into the drop zone, or use the file picker.
5. The HTML file will open inside the application's runtime frame.
6. If you cached the file, you can use the browser's normal **Bookmark** or **Add to Home Screen** controls at any time while the cached runtime URL is open.

## License

This project is licensed under the **Apache License 2.0**.

You are free to use, modify, and distribute this software under the terms of this license.
