// background.js
// VERSION: 1.0 (Vanilla JS - No SDK required)

// 🌍 FOR PRODUCTION: Replace this dummy URL with your deployed Firebase/GCP Cloud Function endpoint
const VERIFY_ENDPOINT = "https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/verifyYouTubeVideo";

// 1. Listen for messages from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // ==========================================
  // CASE A: Record a Block (Save Locally)
  // ==========================================
  if (request.action === "RECORD_BLOCK") {
    // We save this to Chrome Local Storage so the Popup can read it instantly.
    // No need for Firebase SDK here.
    chrome.storage.local.get(['totalBlocks'], (result) => {
      const current = result.totalBlocks || 0;
      const newCount = current + 1;
      
      chrome.storage.local.set({ totalBlocks: newCount });
      console.log("🚫 Block Recorded! Total:", newCount);
    });

    // Optional: If you really want to sync to DB, send a fetch() to a Cloud Function here instead.
    // But for V1, local stats are faster and safer.
  }

  // ==========================================
  // CASE B: Verify Video with AI (The Brain)
  // ==========================================
  if (request.action === "VERIFY_VIDEO") {
    
    console.log("🔍 Verifying Video:", request.title);

    // CALL THE CLOUD FUNCTION (Native Fetch - No SDK needed)
    fetch(VERIFY_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            data: { title: request.title } // Firebase Functions expects "data"
        })
    })
    .then(res => res.json())
    .then(json => {
        const result = json.result; 
        console.log("✅ AI Verdict:", result);
        sendResponse(result);
    })
    .catch(err => {
        console.error("❌ Verification Failed:", err);
        sendResponse({ status: "ERROR", message: "AI is offline." });
    });

    return true; // ⚠️ CRITICAL: Keeps the channel open for async response
  }
});

// ==========================================
// 🚀 ONBOARDING TRIGGER
// ==========================================
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open the Welcome Page
    chrome.tabs.create({ url: "https://halanoi.com/extension-welcome" });
  }
});