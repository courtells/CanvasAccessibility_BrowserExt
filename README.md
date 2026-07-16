# Canvas Accessibility Checker (browser extension)

Checks the Canvas page you're currently viewing against WCAG 2.1 AA and walks you through fixing what it finds. Lives in Chrome's side panel, so it stays docked next to the page instead of closing every time you click away.

## Install (unpacked, for testing/personal use)

1. Unzip this folder somewhere permanent (don't delete it after installing — Chrome loads the extension from these files).
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Pin the extension icon (puzzle piece icon in the toolbar → pin "Canvas Accessibility Checker").

## Use it

1. Open a Canvas page.
2. Click the extension icon — the side panel opens and docks next to the page.
3. Click **Scan this page**.
4. Review the summary, or click **Walk me through the fixes** to step through each issue one at a time. Each step highlights the exact element on the page and tells you how to fix it in the Canvas editor.
5. **Remember to rescan on each new page.** The panel stays open as you navigate, but each page needs its own scan — it clears stale results automatically when it detects you've moved to a different page, but you'll need to click Scan again to check the new one.

If you switch tabs or navigate and the Scan button doesn't seem to do anything, click the extension's toolbar icon once to re-grant it access to the tab you're now on, then click Scan again — this is a deliberate limitation (see Privacy below), not a bug.

## Privacy

- Uses only the `activeTab` permission — the extension can only read the page you're currently viewing, and only after you click its icon. Switching tabs while the panel is open does **not** automatically extend that access to the new tab.
- The `sidePanel` permission only lets the extension register and open its docked UI — it doesn't grant any additional access to page content.
- No `host_permissions` and no `tabs` permission, so it can't read the URL or title of tabs you haven't explicitly activated it on, and it isn't running in the background on every site.
- Results are kept in `chrome.storage.session`, which is cleared automatically when the browser closes. Nothing persists across browser restarts, and nothing is ever sent off your machine.
- The panel detects when the current tab's URL has changed (new page or new tab) and clears the stale scan automatically, but it will only auto re-run the scan if it still has permission for that tab — otherwise it prompts you to click the icon again first.

## What it checks automatically vs. flags for manual review

Automatic pass/fail: page title, heading structure, link text, image alt text, table headers, and **real computed color contrast** (using the page's actual rendered colors).

Flagged for manual review (can't be fully verified from the DOM alone): reading order, long descriptions for complex images, captions/transcripts/audio description for media, and flashing/auto-motion content.

