# Security & Privacy Policy 🛡️

This document details the security model, configuration instructions, and privacy terms for **Halanoi Focus Guard**. 

---

## 🛠️ Developer Setup & API Security

To protect our production infrastructure from credentials scraping, the endpoint URLs in this public repository are configured with placeholders (e.g. `VERIFY_ENDPOINT`).

If you are cloning or forking this repository to run it locally or deploy your own version:

1. **Deploy Your Own Backend**: Set up a Google Cloud Project (GCP) or Firebase project with a Cloud Function to handle the AI safety classification.
2. **Configure Your Endpoint**: Replace the dummy backend endpoints in the extension code (such as in `background.js` or `content.js`) with your own deployed Cloud Function URL.
3. **Production Security**: Note that the official production versions of Halanoi Focus Guard published on the Chrome Web Store / Microsoft Edge Add-ons store are compiled with cryptographically secured, production-only endpoints protected by strict origin and backend access policies.

---

## 🔒 Privacy Declaration (Web Store Audits)

Halanoi Focus Guard is designed to be lightweight, secure, and privacy-respecting. It complies with the privacy policies of the Google Chrome Web Store and Microsoft Partner Center.

### 1. Data Minimization
* The extension only reads the active tab's domain structure and YouTube video titles in order to run its focus-blocking rules. It does not inspect other tabs, history, bookmarks, or system information.

### 2. Zero Browsing Tracking
* We do **not** log, store, track, or sell your browsing history, search queries, cookies, or personal credentials. 

### 3. Secure Processing
* To perform AI safety classification, YouTube video titles are sent securely over **HTTPS** to our dedicated Firebase Cloud Function endpoint.
* This processing happens in real-time. Video titles are processed instantaneously to return a block/allow score and are **never persistently stored** or logged on the server.
