// halanoi-extension/content.js
// VERSION: 3.0 (Aggressive SPA Blocking)

// ==========================================
// 1. CONFIGURATION & LISTS
// ==========================================

const SOCIAL_LIST = ["twitter.com", "x.com", "instagram.com", "facebook.com", "linkedin.com", "tiktok.com"];
const ENTERTAINMENT_LIST = ["netflix.com", "reddit.com", "primevideo.com", "twitch.tv", "hulu.com", "disneyplus.com"];

// The Dopamine Shield (Top 50 Adult Sites + Keywords)
const ADULT_DOMAINS = [
  "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "onlyfans.com",
  "chaturbate.com", "brazzers.com", "youporn.com", "redtube.com", "tube8.com",
  "spankbang.com", "youjizz.com", "eporner.com", "hqporner.com", "beeg.com",
  "porntrex.com", "thumbzilla.com", "tnaflix.com", "drtuber.com", "kink.com",
  "adultfriendfinder.com", "livejasmin.com", "myfreecams.com", "camsoda.com",
  "bongacams.com", "stripchat.com", "cam4.com", "fancentro.com", "manyvids.com",
  "clips4sale.com", "naughtyamerica.com", "realitykings.com", "bangbros.com",
  "teamskeet.com", "mofos.com", "babepedia.com", "booble.com", "hentaihaven.red",
  "hanime.tv", "nhentai.net", "gelbooru.com", "rule34.xxx", "yandere.com"
];

const RISKY_KEYWORDS = ["porn", "xxx", "hentai", "sexvideos"];

// YouTube Content Filtering
const LEARNING_KEYWORDS = [
  "tutorial", "course", "learn", "study", "lecture", 
  "guide", "how to", "explained", "training", "lesson", 
  "introduction", "basics", "advanced", "coding", "programming", 
  "physics", "math", "history", "science", "development", 
  "doc", "documentation", "tips"
];

const ENTERTAINMENT_KEYWORDS = [
  "movie", "review", "reaction", "prank", "vlog", "challenge", 
  "funny", "compilation", "gaming", "gameplay", "stream", 
  "trailer", "teaser", "shorts", "tiktok", "bloopers",
  "dubbed", "scene", "cinema", "episode", "full video"
];

// ==========================================
// 2. MAIN LOGIC CONTROLLER
// ==========================================

// Run immediately on load
runHalanoiCheck();

// Run continuously for SPAs (Instagram, YouTube, etc)
// This watches for URL changes even if page doesn't reload
let lastUrl = window.location.href;
new MutationObserver(() => {
  const url = window.location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    runHalanoiCheck(); // Re-run check on navigation
  }
}).observe(document, { subtree: true, childList: true });


async function runHalanoiCheck() {
  const currentUrlObj = new URL(window.location.href);
  const fullHostname = currentUrlObj.hostname; 

  // 🛡️ SAFETY: Never block the Halanoi Dashboard or localhost
  if (fullHostname.includes("halanoi.com") || fullHostname.includes("localhost")) {
    return; 
  }

  const cleanDomain = fullHostname.replace(/^www\./, '').replace(/^m\./, '');
  
  // Step 1: Check for Hall Pass (Allow Logic)
  const passParam = currentUrlObj.searchParams.get("halanoi_pass");
  const durationParam = currentUrlObj.searchParams.get("duration");

  if (passParam === "true") {
    // Get duration from URL or default to 15 minutes
    const minutes = parseInt(durationParam) || 15;
    const expiryTime = Date.now() + (minutes * 60 * 1000);

    // Save the SPECIFIC expiry time for this domain
    chrome.storage.local.set({ [`expiry_${cleanDomain}`]: expiryTime }, () => {
      // Clean the URL so they can't bookmark the pass
      window.location.href = window.location.href.split('?')[0];
    });
    return;
  }

  // Step 2: Load Settings & Build Blocklist
  const settings = await chrome.storage.local.get([
    'blockYoutube', 
    'blockSocial', 
    'blockEntertainment', 
    'dopamineShield',
    'customSites'
  ]);

  const config = {
    youtube: settings.blockYoutube !== false, // Default ON
    social: settings.blockSocial !== false,   // Default ON
    entertainment: settings.blockEntertainment !== false, // Default ON
    shield: settings.dopamineShield === true
  };

  // 3. CHECK DOPAMINE SHIELD
  if (config.shield && isAdultContent(cleanDomain)) {
    incrementStats();
    nukePage(cleanDomain, "DOPAMINE SHIELD");
    return;
  }

  // 4. BUILD ACTIVE BLOCKLIST
  let activeBlocklist = [];
  if (config.social) activeBlocklist = [...activeBlocklist, ...SOCIAL_LIST];
  if (config.entertainment) activeBlocklist = [...activeBlocklist, ...ENTERTAINMENT_LIST];

  // 🔥 ADD CUSTOM SITES TO BLOCKLIST
  if (settings.customSites && settings.customSites.length > 0) {
    activeBlocklist = [...activeBlocklist, ...settings.customSites];
  }

  // 5. CHECK IF BLOCKED
  // FIX: Check against both full hostname (www.instagram.com) AND clean domain (instagram.com)
  const isListed = activeBlocklist.some(d => 
    fullHostname.includes(d) || cleanDomain.includes(d)
  );
  
  const isYoutube = cleanDomain.includes("youtube.com");

  if (isListed || (isYoutube && config.youtube)) {
    try {
      // Check for Active Timer
      const result = await chrome.storage.local.get([`expiry_${cleanDomain}`]);
      const expiryTime = result[`expiry_${cleanDomain}`];

      if (expiryTime) {
        const remaining = expiryTime - Date.now();
        if (remaining > 0) {
          // ✅ ALLOWED (Timer Running)
          showTimer(remaining);
          
          if (isYoutube) {
            activateYouTubeSafeMode(); 
            monitorYouTubeVideo(); 
          }
          return; 
        } else {
          // ❌ EXPIRED
          await chrome.storage.local.remove(`expiry_${cleanDomain}`);
        }
      }

      // 🚫 BLOCKED
      incrementStats();
      nukePage(cleanDomain, "FOCUS GUARD");
      
    } catch (e) {
      console.error("Halanoi Error:", e);
    }
  }
}

// ==========================================
// 4. BLOCKING & UI FUNCTIONS
// ==========================================

function isAdultContent(domain) {
  if (ADULT_DOMAINS.some(d => domain.includes(d))) return true;
  if (RISKY_KEYWORDS.some(k => domain.includes(k))) return true;
  return false;
}

function incrementStats() {
  chrome.storage.local.get(['totalBlocks'], (data) => {
    const newCount = (data.totalBlocks || 0) + 1;
    chrome.storage.local.set({ totalBlocks: newCount });
  });
}

function nukePage(site, reason) {
  // Check if we already nuked it to avoid loops
  if (document.getElementById("halanoi-overlay")) return;

  chrome.runtime.sendMessage({ action: "RECORD_BLOCK", site: site }); 
  
  const dashboardUrl = "https://halanoi.com/dashboard";
  const blockedUrl = `https://halanoi.com/blocked?site=${site}`;
  const fontUrl = chrome.runtime.getURL("fonts/Orbitron-Bold.ttf");

  const css = `
    @font-face {
      font-family: 'Orbitron';
      src: url('${fontUrl}') format('truetype');
      font-weight: 700; 
      font-style: normal;
    }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
    :root {
      --font-orbitron: 'Orbitron', sans-serif;
      --font-inter: 'Inter', sans-serif;
      --primary-gradient: linear-gradient(to right, #6366f1, #a855f7);
      --bg-color: #050508; 
    }
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: var(--bg-color) !important; }
    #halanoi-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; background: radial-gradient(circle at 50% 10%, #1e1b4b 0%, #020205 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-inter); color: white; }
    .glass-card { position: relative; z-index: 1; background: rgba(20, 20, 25, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); padding: 60px 40px; border-radius: 24px; text-align: center; max-width: 500px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); animation: floatIn 0.6s ease-out; }
    @keyframes floatIn { 0% { opacity: 0; transform: translateY(20px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }

    h1 { font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 2.8rem; margin: 0 0 10px 0; color: #ffffff; text-transform: none; letter-spacing: 1px; text-shadow: 0 0 30px rgba(99, 102, 241, 0.6); }
    h2 { font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 0.85rem; color: #a855f7; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 35px; opacity: 0.9; }
    p { font-size: 1.1rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 40px; }
    .btn { text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 1rem; transition: all 0.3s ease; width: 100%; max-width: 300px; display: block; box-sizing: border-box; margin-top: 15px; margin-left: auto; margin-right: auto; }
    .btn-primary { background-image: var(--primary-gradient); background-size: 200% auto; color: white; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); border: none; }
    .btn-primary:hover { background-position: right center; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6); }
    .btn-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #94a3b8; }
    .btn-secondary:hover { border-color: #6366f1; color: white; background: rgba(99, 102, 241, 0.1); }
  `;

  const html = `
    <div id="halanoi-overlay">
      <style>${css}</style>
      <div class="glass-card">
        <div style="font-size: 3.5rem; margin-bottom: 15px;">🛡️</div>
        <h1>Halanoi</h1>
        <h2 style="font-family: 'Orbitron'; color: #a855f7; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 35px;">${reason} Active</h2>
        <p style="font-size: 1.1rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 40px;">
          You tried to access <strong>${site}</strong>.<br>
          This site drains your energy. Protect your momentum.
        </p>
        <div>
          <a href="${dashboardUrl}" class="btn btn-primary">🔥 Go Back to Work</a>
          <a href="${blockedUrl}" class="btn btn-secondary">I really need this</a>
        </div>
      </div>
    </div>
  `;

  // We completely replace the document body to stop other scripts
  document.documentElement.innerHTML = html;
  window.stop();
}

function showTimer(remainingMs) {
  const inject = () => {
    const existing = document.getElementById('halanoi-timer');
    if (existing) existing.remove();

    const timerDiv = document.createElement('div');
    timerDiv.id = 'halanoi-timer';
    timerDiv.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); color: #00ff00; border: 1px solid #00ff00; padding: 12px 20px; border-radius: 12px; font-family: monospace; font-weight: bold; font-size: 16px; z-index: 2147483647; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); pointer-events: none; user-select: none; display: flex; align-items: center; gap: 10px;`;
    
    const icon = document.createElement('span');
    icon.textContent = "🔓";
    timerDiv.appendChild(icon);
    
    const textSpan = document.createElement('span');
    timerDiv.appendChild(textSpan);
    document.body.appendChild(timerDiv);

    const interval = setInterval(() => {
        remainingMs -= 1000;
        if (remainingMs <= 0) {
            clearInterval(interval);
            textSpan.textContent = "TIME EXPIRED";
            timerDiv.style.color = "#ff4444";
            timerDiv.style.borderColor = "#ff4444";
            setTimeout(() => { window.location.reload(); }, 1500);
        } else {
            const mins = Math.floor(remainingMs / 60000);
            const secs = Math.floor((remainingMs % 60000) / 1000);
            textSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
  };
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
}

// ==========================================
// 5. YOUTUBE FEATURES (Monitor, Blockers, SafeMode)
// ==========================================

function activateYouTubeSafeMode() {
  const css = `
    ytd-rich-section-renderer, a[title="Shorts"], ytd-reel-shelf-renderer { display: none !important; }
    #secondary, #comments { display: none !important; }
    ytd-browse[page-subtype="home"] #primary { display: none !important; }
    #primary { max-width: 100% !important; margin: 0 auto !important; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// Global whitelist to remember approved videos
const approvedVideos = new Set(); 

function monitorYouTubeVideo() {
  const checkContent = () => {
    const currentUrl = window.location.href;

    // 🛑 1. CHECK WHITELIST (The "Chain Breaker")
    // If AI already approved this URL, stop checking immediately.
    if (approvedVideos.has(currentUrl)) {
        return; 
    }

    // 2. Shorts Block
    if (currentUrl.includes("/shorts/")) {
      blockShortsPlayer();
      return; 
    }

    // 3. Video Block
    if (currentUrl.includes("/watch")) {
      const titleElement = document.querySelector("h1.ytd-watch-metadata") || document.querySelector("#title h1");
      if (!titleElement) return;

      const titleText = titleElement.innerText.toLowerCase();
      const isLearning = LEARNING_KEYWORDS.some(word => titleText.includes(word));
      // const isEntertainment = ENTERTAINMENT_KEYWORDS.some(word => titleText.includes(word)); // Not needed if we trust the "Not Learning" logic

      if (!isLearning) {
        blockVideoPlayer("This video doesn't match your learning goals.");
      }
    }
  };

  if (!window.halanoiMonitorInterval) {
      checkContent(); 
      window.halanoiMonitorInterval = setInterval(checkContent, 1000);
  }
}

function blockVideoPlayer(reason) {
  const player = document.querySelector("#movie_player");
  if (player) {
    if (document.getElementById("halanoi-player-block")) return;
    
    // 1. Pause Video
    const video = document.querySelector("video");
    if (video) video.pause();

    const fontUrl = chrome.runtime.getURL("fonts/Orbitron-Bold.ttf");
    const cover = document.createElement("div");
    cover.id = "halanoi-player-block";
    
    const style = document.createElement("style");
    style.textContent = `
      @font-face { font-family: 'Orbitron'; src: url('${fontUrl}') format('truetype'); font-weight: 700; font-style: normal; }
      .halanoi-msg { font-family: 'Orbitron', sans-serif; text-transform: uppercase; letter-spacing: 2px; text-align: center; }
      .halanoi-btn { 
          padding: 10px 20px; 
          border-radius: 8px; 
          border: none; 
          cursor: pointer; 
          font-family: 'Inter', sans-serif; 
          font-weight: 600; 
          margin-top: 15px; 
          transition: all 0.2s;
      }
      .btn-verify { background: #6366f1; color: white; }
      .btn-verify:hover { background: #4f46e5; transform: scale(1.05); }
      .btn-verify:disabled { opacity: 0.7; cursor: wait; }
    `;
    cover.appendChild(style);

    cover.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000000; z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white;`;
    
    // 2. The Inner HTML (Added the Verify Button)
    cover.innerHTML += `
      <div style="font-size: 4rem; margin-bottom: 20px;">🛡️</div>
      <h2 class="halanoi-msg" style="font-size: 24px; color: #a855f7; margin-bottom: 10px; text-shadow: 0 0 20px rgba(168, 85, 247, 0.6);">Focus Guard</h2>
      <p id="halanoi-reason" style="font-family: 'Inter', sans-serif; font-size: 16px; color: #cbd5e1;">${reason}</p>
      
      <button id="ai-verify-btn" class="halanoi-btn btn-verify">
        ✨ This is Educational (Ask AI)
      </button>

      <p style="font-family: 'Inter', sans-serif; font-size: 13px; color: #64748b; margin-top: 20px;">Or search for "Tutorial" explicitly</p>
    `;
    
    player.appendChild(cover);

    // 3. Attach Logic to the Button
    document.getElementById("ai-verify-btn").addEventListener("click", async function() {
        const btn = this;
        const statusText = document.getElementById("halanoi-reason");
        // Grab the video title from the page
        const videoTitle = document.querySelector("h1.ytd-watch-metadata")?.innerText || "Unknown Video";

        // 1. UI Feedback (So user knows it's working)
        btn.innerText = "Analying content...";
        btn.disabled = true;
        btn.style.opacity = "0.7";

        // 2. SEND MESSAGE TO BACKGROUND
        chrome.runtime.sendMessage({ 
            action: "VERIFY_VIDEO", 
            title: videoTitle 
        }, (response) => {
            
            // 3. HANDLE RESPONSE
            if (response && response.status === "APPROVED") {
                // ✅ SUCCESS: Unblock
                statusText.style.color = "#4ade80"; // Green
                statusText.innerText = "AI Verification Passed. Unblocking...";
                btn.innerText = "Access Granted";
                
                // 🔥 CRITICAL: Add to Whitelist so it doesn't get blocked again!
                approvedVideos.add(window.location.href);

                setTimeout(() => {
                    document.getElementById("halanoi-player-block").remove(); // Remove overlay
                    const video = document.querySelector("video");
                    if (video) video.play();   // Resume video
                }, 1500);
            } else {
                // ❌ FAILED
                statusText.style.color = "#ef4444"; // Red
                statusText.innerText = response.message || "AI determined this is Entertainment.";
                btn.innerText = "Appeal Rejected";
                // Re-enable button after 3s so they can try again if they want
                setTimeout(() => { btn.disabled = false; btn.innerText = "✨ This is Educational (Ask AI)"; }, 3000);
            }
        });
    });
  }
}

function blockShortsPlayer() {
  const shortsContainer = document.querySelector("ytd-shorts") || document.querySelector("#shorts-container");
  if (shortsContainer) {
    if (document.getElementById("halanoi-shorts-block")) return;

    incrementStats(); // +1 Blocked
    const video = shortsContainer.querySelector("video");
    if (video) video.pause();

    const fontUrl = chrome.runtime.getURL("fonts/Orbitron-Bold.ttf");
    const cover = document.createElement("div");
    cover.id = "halanoi-shorts-block";
    
    const style = document.createElement("style");
    style.textContent = `
      @font-face { font-family: 'Orbitron'; src: url('${fontUrl}') format('truetype'); font-weight: 700; font-style: normal; }
      .halanoi-msg { font-family: 'Orbitron', sans-serif; text-transform: uppercase; letter-spacing: 2px; text-align: center; }
    `;
    cover.appendChild(style);

    cover.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000000; z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white;`;
    cover.innerHTML += `
      <div style="font-size: 3rem; margin-bottom: 15px;">⛔</div>
      <h2 class="halanoi-msg" style="font-size: 20px; color: #ff4444; margin-bottom: 10px;">Shorts Blocked</h2>
      <p style="font-family: 'Inter', sans-serif; font-size: 14px; color: #cbd5e1; text-align: center; padding: 0 20px;">Shorts are pure dopamine loops.<br>They are never deep work.</p>
      <a href="https://www.youtube.com" style="margin-top: 20px; padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 12px;">Go to Homepage</a>
    `;
    shortsContainer.appendChild(cover);
  }
}

// ==========================================
// 6. THE WEB BRIDGE (Sync Website -> Extension)
// ==========================================

// Only run this logic if we are on the Halanoi Website
if (window.location.hostname.includes("halanoi.com") || window.location.hostname.includes("localhost")) {
  
  console.log("🌉 Halanoi Bridge: Active and listening for website settings...");

  // Check for settings updates every second
  // (This waits for your Next.js app to save to localStorage)
  setInterval(() => {
    
    // A. Sync User ID (You already had this, keeping it)
    const uid = localStorage.getItem("halanoi_uid");
    if (uid) {
      chrome.storage.local.set({ halanoi_uid: uid });
    }

    // B. Sync Extension Settings (NEW!)
    const webSettings = localStorage.getItem("halanoi_extension_settings");
    
    if (webSettings) {
      // We found settings! Parse them.
      const parsed = JSON.parse(webSettings);
      
      // Save to Extension Storage
      chrome.storage.local.set({
        blockYoutube: parsed.blockYoutube,
        blockSocial: parsed.blockSocial,
        blockEntertainment: parsed.blockEntertainment,
        dopamineShield: parsed.dopamineShield
      }, () => {
        // Optional: Notify the console it worked
        // console.log("✅ Extension synced with Website settings!");
      });
    }

  }, 1000);
}

// ⚡ SAFETY CHECK: Re-run blocking every 2 seconds
// This catches sites like Instagram that try to "hydrate" or reload via Service Workers
setInterval(() => {
    runHalanoiCheck();
}, 2000);