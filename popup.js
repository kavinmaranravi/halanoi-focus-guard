document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load Settings from Storage
  const settings = await chrome.storage.local.get([
    'blockYoutube', 
    'blockSocial', 
    'blockEntertainment', 
    'dopamineShield',
    'totalBlocks'
  ]);

  // 2. Update Toggle UI (Default to TRUE for blocking, FALSE for Shield)
  document.getElementById('toggle-youtube').checked = settings.blockYoutube !== false;
  document.getElementById('toggle-social').checked = settings.blockSocial !== false;
  document.getElementById('toggle-entertainment').checked = settings.blockEntertainment !== false;
  document.getElementById('toggle-shield').checked = settings.dopamineShield === true;

  // 3. Update Stats
  const blocks = settings.totalBlocks || 0;
  document.getElementById('block-count').textContent = blocks;
  
  // Calculate Time Saved (5 mins per block)
  const minutesSaved = blocks * 5;
  
  let timeString = "";
  if (minutesSaved < 60) {
      timeString = `${minutesSaved}m`;
  } else {
      const hours = (minutesSaved / 60).toFixed(1);
      timeString = `${hours}h`;
  }

  document.getElementById('time-saved').textContent = timeString;

  // 4. Add Listeners to Save Changes
  const toggles = [
    { id: 'toggle-youtube', key: 'blockYoutube' },
    { id: 'toggle-social', key: 'blockSocial' },
    { id: 'toggle-entertainment', key: 'blockEntertainment' },
    { id: 'toggle-shield', key: 'dopamineShield' }
  ];

  toggles.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        chrome.storage.local.set({ [key]: e.target.checked });
      });
    }
  });

  // --- Custom Blocklist Logic ---
  const input = document.getElementById('custom-site-input');
  const addBtn = document.getElementById('add-site-btn');
  const list = document.getElementById('custom-site-list');

  // 1. Load existing sites
  chrome.storage.local.get(['customSites'], (data) => {
    const sites = data.customSites || [];
    renderList(sites);
  });

  // 2. Function to Add Site
  const addSite = () => {
    let rawInput = input.value.trim();
    
    if (!rawInput) return; // Don't add empty lines

    // Add protocol if missing to make the URL parser happy
    if (!rawInput.startsWith('http')) {
        rawInput = 'https://' + rawInput;
    }

    try {
        const urlObj = new URL(rawInput);
        const domain = urlObj.hostname.replace('www.', ''); // Clean it

        // Check for duplicates
        chrome.storage.local.get(['customSites'], (data) => {
            const sites = data.customSites || [];
            
            if (sites.includes(domain)) {
                // ⚠️ IT WAS A DUPLICATE
                // Just clear the input so the user feels heard
                input.value = '';
                // Optional: Flash the input red or console log
                console.log("Site already exists:", domain);
                return;
            }

            // ✅ NEW SITE - Add it
            const newSites = [...sites, domain];
            chrome.storage.local.set({ customSites: newSites }, () => {
                renderList(newSites);
                input.value = ''; // Clear input
            });
        });

    } catch (e) {
        alert("Please enter a valid website (e.g., example.com)");
    }
  };

  // 3. Render the List UI
  function renderList(sites) {
    if (!list) return;
    list.innerHTML = '';
    sites.forEach(site => {
      const li = document.createElement('li');
      li.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px; font-size: 0.85rem; color: #cbd5e1; background: rgba(255,255,255,0.05); margin-bottom: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);";
      
      const span = document.createElement('span');
      span.textContent = site;
      
      const delBtn = document.createElement('button');
      delBtn.innerHTML = '✕';
      delBtn.style.cssText = "background: none; border: none; color: #ff4444; cursor: pointer; font-weight: bold; padding: 4px 8px; border-radius: 4px;";
      delBtn.onmouseover = () => delBtn.style.background = "rgba(255, 68, 68, 0.1)";
      delBtn.onmouseout = () => delBtn.style.background = "transparent";
      delBtn.onclick = () => removeSite(site);

      li.appendChild(span);
      li.appendChild(delBtn);
      list.appendChild(li);
    });
  }

  // 4. Remove Site Function
  function removeSite(siteToRemove) {
    chrome.storage.local.get(['customSites'], (data) => {
      const sites = data.customSites || [];
      const newSites = sites.filter(s => s !== siteToRemove);
      chrome.storage.local.set({ customSites: newSites }, () => renderList(newSites));
    });
  }

  // 5. Event Listeners
  if (addBtn) {
      addBtn.addEventListener('click', addSite);
  }

  // 🔥 NEW: Allow pressing "Enter" key
  if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addSite();
        }
      });
  }
});