<div align="center">
  <img src="icons/highlighter.svg" width="200" alt="Ash Highlight icon">
  <h1>Ash Highlight</h1>
  <p><strong>Highlight, annotate, and manage text on any web page.</strong></p>
</div>

Highlight text on any web page with colors, notes, and tooltips. Manage your highlights from the toolbar popup. Your highlights stay on your device.

Version: 0.1.0

## Install (Chrome, Edge, or other Chromium browsers)

1. Download `highlight-0.1.0.zip` from the Releases page and unzip it. Keep the folder somewhere permanent, because the browser reads it from there.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the unzipped `highlight` folder.

To update, download the new zip, replace the folder's contents, and click the reload icon on the extension card.

Chromium browsers block extensions installed from outside their store unless loaded this way, so this method is the supported option.

## Permissions

Ash Highlight asks for two things, and nothing else:

- **Storage** (`storage`): saves your highlights, notes, palette, and settings on your device. Nothing is uploaded.
- **Access to all websites** (`<all_urls>`): lets the highlighter run on any page you open, so you can highlight there. It reads the text on the page you're viewing and doesn't send it anywhere.

It doesn't read your browsing history, use your tabs list, or make network requests of its own.

**Your data remains on your computer.** Highlights are kept in your browser's local extension storage (`chrome.storage.local`), which lives on this computer only. It isn't synced to other devices, and websites and other extensions can't read it. Removing the extension deletes it. The only time data leaves the browser is when you choose Export, and then the file is saved wherever you pick.

## Bug reports and feedback

Found a bug, or have a complaint or suggestion? Open an issue in the **Issues** tab of this repository. The more detail you give, the faster it can be fixed:

- What you did, and what you expected to happen.
- What happened instead, including any error message.
- Your browser and its version, and the extension version (shown on `chrome://extensions`).
- The website where it happened, if it's not private.

Please don't post private information, such as passwords or personal highlights, in an issue. Screenshots are welcome, but crop out anything sensitive.

## Use

- Select text to see the highlight popup. Choose a color to highlight.
- Click a highlight to open its popup, add a note with `+`, or resize it with the blue handles.
- Ctrl+K highlights the selection with the default color.
- Click the toolbar icon to see, search, and manage all highlights.

## Backup

Chrome deletes an extension's data when it is removed. Use **Export** in the toolbar popup regularly, and keep the file somewhere safe.

## Privacy

Highlights, notes, and settings are stored only in this browser. Nothing is sent to any server.

## License

Ash Highlight is released under the MIT License. See [LICENSE](LICENSE) for the full text.

Third-party assets:

- **Icons:** [Heroicons](https://heroicons.com), MIT License.
- **Colors:** the [Catppuccin](https://catppuccin.com) palette, MIT License.
