// ---------------------------------------------------------
// 🌐 SAFE ISOLATED NAMESPACES (PREVENTS SCRIPT CONFLICTS)
// ---------------------------------------------------------
window.DJ_API_URL = "https://dj-grey.onrender.com/api";
window.DJ_DEFAULT_ARTWORK = "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";
window.djCatalog = [];
window.djCurrentTab = "home";

// ---------------------------------------------------------
// 🔄 FETCH MIXES & INITIALIZE CATALOG
// ---------------------------------------------------------
async function loadMixes() {
  const grid = document.getElementById("mixes-grid");
  if (!grid) return;

  try {
    const token = localStorage.getItem("dj_grey_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};
    
    const res = await fetch(`${window.DJ_API_URL}/mixes`, { headers });
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);

    const data = await res.json();
    window.djCatalog = Array.isArray(data) ? data : [];
    renderGrid(window.djCatalog);
  } catch (error) {
    console.error("Error loading mixes:", error);
    grid.innerHTML = `
        <div style="padding: 25px; text-align: center; background: rgba(255, 77, 77, 0.08); border: 1px solid var(--danger); border-radius: 12px; margin-top: 20px;">
            <p style="color: #ff4d4d; font-weight: bold; margin-bottom: 8px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Unable to connect to music catalog
            </p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">${error.message || 'Network error'}</p>
            <button onclick="loadMixes()" style="padding: 8px 18px; background: var(--primary); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                <i class="fa-solid fa-rotate-right"></i> Retry Connection
            </button>
        </div>
    `;
  }
}

// ---------------------------------------------------------
// 🎨 RENDER GRID
// ---------------------------------------------------------
function renderGrid(mixes) {
  const grid = document.getElementById("mixes-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!mixes || mixes.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted); padding: 20px;">No mixes found in this section.</p>`;
    return;
  }

  mixes.forEach((mix, index) => {
    const art = mix.artwork_url || window.DJ_DEFAULT_ARTWORK;
    
    const likeClass = mix.is_liked ? "liked" : "";
    const likeStyle = mix.is_liked ? "color: var(--danger);" : "";
    const saveClass = mix.is_saved ? "saved" : "";
    const saveStyle = mix.is_saved ? "color: var(--success);" : "";

    grid.innerHTML += `
        <div class="card">
            <img src="${art}" class="card-img" alt="Artwork" onerror="this.src='${window.DJ_DEFAULT_ARTWORK}'">
            <div class="card-content">
                <h3 class="card-title">${mix.title}</h3>
                <div class="card-actions">
                    <button class="btn-play" onclick="playMix(${index})">
                        <i class="fa-solid fa-play"></i> PLAY
                    </button>
                    <div class="stats">
                        <span class="${likeClass}" onclick="likeMix(${mix.id}, this)" title="Like">
                            <i class="fa-solid fa-heart" style="${likeStyle}"></i> ${mix.likes_count || 0}
                        </span>
                        <span class="${saveClass}" onclick="downloadMix(${mix.id}, this)" title="Add to Playlist">
                            <i class="fa-solid fa-download" style="${saveStyle}"></i> ${mix.downloads_count || 0}
                        </span>
                    </div>
                </div>
                <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <button class="comments-toggle-btn" onclick="openCommentsSidebar(${mix.id}, '${mix.title.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-comments"></i> View Comments
                    </button>
                </div>
            </div>
        </div>
    `;
  });
}

// ---------------------------------------------------------
// 🔀 NAVIGATION & TAB SWITCHER
// ---------------------------------------------------------
function switchTab(tab) {
  window.djCurrentTab = tab;
  const titleEl = document.getElementById("page-section-title");

  document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.remove("active");
      if (el.getAttribute("onclick") && el.getAttribute("onclick").includes(tab)) {
          el.classList.add("active");
      }
  });

  if (tab === "home") {
    if (titleEl) titleEl.innerText = "LATEST DROPS";
    renderGrid(window.djCatalog);
  } else if (tab === "trending") {
    if (titleEl) titleEl.innerText = "🔥 TRENDING DROPS";
    const sorted = [...window.djCatalog].sort((a, b) => ((b.likes_count || 0) + (b.downloads_count || 0)) - ((a.likes_count || 0) + (a.downloads_count || 0)));
    renderGrid(sorted);
  } else if (tab === "liked") {
    if (titleEl) titleEl.innerText = "❤️ LIKED MIXES";
    const liked = window.djCatalog.filter((m) => m.is_liked || m.likes_count > 0);
    renderGrid(liked);
  } else if (tab === "history") {
    if (titleEl) titleEl.innerText = "🕒 WATCH & LISTEN HISTORY";
    renderGrid(window.djCatalog);
  } else if (tab === "hearthis") {
    if (titleEl) titleEl.innerText = "💿 DJ GREY'S HEARTHIS HUB";
    fetchHearthisMixes();
  } else if (tab === "spotify") {
    if (titleEl) titleEl.innerText = "🎧 DJ GREY'S SPOTIFY HUB";
    loadSpotifyHub(); 
  } else if (tab === "livestream") {
    if (titleEl) titleEl.innerText = "🔴 LIVE STREAM & REALTIME CHAT";
    checkLiveStream();
  }

  if (window.innerWidth <= 768) {
      const leftNav = document.getElementById("left-nav");
      if (leftNav) leftNav.classList.remove("open");
  }
}

// Bind to window for global inline onclick access
window.switchTab = switchTab;
window.loadMixes = loadMixes;

// ---------------------------------------------------------
// 💿 EXTERNAL HUBS (HEARTHIS & SPOTIFY)
// ---------------------------------------------------------
async function fetchHearthisMixes() {
    const grid = document.getElementById("mixes-grid");
    if (!grid) return;
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Syncing directly with DJ Grey's Hearthis.at account...</p>`;
    try {
        const res = await fetch(`${window.DJ_API_URL}/hearthis/sync/grey-george`); 
        const data = await res.json();
        if (data.success && data.mixes.length > 0) {
            window.djCatalog = data.mixes; 
            renderGrid(window.djCatalog);
        } else {
            grid.innerHTML = `<p style="color: var(--text-muted);">No public mixes found on Hearthis.at.</p>`;
        }
    } catch(e) {
        console.error(e);
        grid.innerHTML = `<p style="color: #ff4d4d;">Failed to establish connection to Hearthis.at.</p>`;
    }
}

async function loadSpotifyHub() {
    const grid = document.getElementById("mixes-grid");
    if (!grid) return;
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Syncing live with DJ Grey's Spotify Hub...</p>`;
    
    try {
        const targetSpotifyUrl = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"; 
        const customTitle = "All On Me - Spotify Drop";
        
        const res = await fetch(`${window.DJ_API_URL}/spotify/sync?url=${encodeURIComponent(targetSpotifyUrl)}&title=${encodeURIComponent(customTitle)}`);
        const data = await res.json();
        
        if (data.success && data.mix) {
            const mix = data.mix;
            grid.innerHTML = `
                <div style="width: 100%; max-width: 900px; margin: 0 auto; text-align: center; animation: fadeIn 0.5s;">
                    <div style="border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); margin-bottom: 25px;">
                        ${data.embed_html}
                    </div>
                    <div class="card" style="padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1.2rem;">${mix.title}</h3>
                        <div class="stats" style="display: flex; gap: 20px; align-items: center;">
                            <span onclick="likeMix(${mix.id}, this)" title="Like"><i class="fa-solid fa-heart"></i> ${mix.likes_count || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            grid.innerHTML = `<p style="color: var(--text-muted);">Unable to load Spotify Hub right now.</p>`;
        }
    } catch (e) {
        grid.innerHTML = `<p style="color: #ff4d4d;">Failed to establish live connection with Spotify.</p>`;
    }
}

// ---------------------------------------------------------
// 📺 WEBRTC LIVESTREAM WATCHER & CHAT
// ---------------------------------------------------------
async function checkLiveStream() {
    const container = document.getElementById("mixes-grid");
    if (!container) return;

    try {
        const res = await fetch(`${window.DJ_API_URL}/livestream/active`);
        const data = await res.json();

        if (data.active) {
            container.innerHTML = `
                <div style="background: var(--panel-bg); border-radius: 12px; padding: 20px; margin-top: 20px; width: 100%;">
                    <h3 style="margin-top: 0; color: var(--danger);"><i class="fa-solid fa-circle-dot"></i> LIVE NOW: ${data.stream ? data.stream.title : 'DJ GREY SESSION'}</h3>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 15px;">
                        <div style="background: #000; border-radius: 8px; overflow: hidden; height: 400px;">
                            <video id="remote-video" autoplay playsinline controls style="width: 100%; height: 100%; object-fit: cover;"></video>
                        </div>
                        <div style="display: flex; flex-direction: column; height: 400px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                            <h4 style="margin-top:0;"><i class="fa-solid fa-comments"></i> Live Chat</h4>
                            <div id="chat-messages" style="flex: 1; overflow-y: auto; margin-bottom: 10px; font-size: 0.9rem;"></div>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="chat-input" placeholder="Type a message..." style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: #fff;">
                                <button onclick="sendChatMessage()" style="padding: 8px 12px; background: var(--primary); border: none; border-radius: 6px; color: #fff; cursor: pointer;">Send</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            loadLiveChat();
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; width: 100%;">
                    <i class="fa-solid fa-tower-broadcast" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 15px;"></i>
                    <h3>No Active Livestream Right Now</h3>
                    <p style="color: var(--text-muted);">DJ Grey is currently offline. Check back soon!</p>
                </div>
            `;
        }
    } catch (e) {
        console.error("Failed to check livestream status", e);
    }
}

async function loadLiveChat() {
    try {
        const res = await fetch(`${window.DJ_API_URL}/livestream/chat`);
        const messages = await res.json();
        const box = document.getElementById("chat-messages");
        if (box) {
            box.innerHTML = messages.map(m => `<div style="margin-bottom:6px;"><strong style="color: var(--primary);">${m.username}:</strong> ${m.message}</div>`).join("");
            box.scrollTop = box.scrollHeight;
        }
    } catch (e) {}
}

async function sendChatMessage() {
    const input = document.getElementById("chat-input");
    if (!input || !input.value.trim()) return;
    const token = localStorage.getItem("dj_grey_token");
    if (!token) return Swal.fire({ icon: 'warning', title: 'Login Required', text: 'Log in to chat live!', background: 'var(--glass-bg)', color: 'var(--text-main)' });

    try {
        await fetch(`${window.DJ_API_URL}/livestream/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ message: input.value.trim() })
        });
        input.value = "";
        loadLiveChat();
    } catch (e) {}
}

// ---------------------------------------------------------
// ❤️ LIKE & 📥 PLAYLIST LOGIC
// ---------------------------------------------------------
async function likeMix(id, element) {
    const token = localStorage.getItem("dj_grey_token");
    if (!token) {
        return Swal.fire({ 
            icon: 'warning', title: 'Login Required', text: 'Please log in to like mixes!', 
            background: 'var(--glass-bg)', color: 'var(--text-main)', confirmButtonColor: 'var(--primary)'
        });
    }

    if (element.classList.contains('liked')) return; 

    element.classList.add('liked');
    const icon = element.querySelector('i');
    if (icon) icon.style.color = 'var(--danger)'; 
    const textNode = element.lastChild;
    const currentCount = parseInt(textNode.textContent) || 0;
    textNode.textContent = ` ${currentCount + 1}`;

    try {
        await fetch(`${window.DJ_API_URL}/mixes/${id}/like`, { 
            method: 'POST',
            headers: { "Authorization": `Bearer ${token}` }
        });
    } catch (e) { console.error('Failed to like mix', e); }
}

async function downloadMix(id, element) {
    const token = localStorage.getItem("dj_grey_token");
    
    if (!token) {
        return Swal.fire({ 
            icon: 'warning', title: 'Access Denied', text: 'Please log in to save mixes to your personal playlist!', 
            background: 'var(--glass-bg)', color: 'var(--text-main)', confirmButtonColor: 'var(--primary)'
        });
    }

    if (element.classList.contains('saved')) {
        return Swal.fire({
            icon: 'info', title: 'Already Saved', text: 'This mix is already securely stored in your playlist.',
            background: 'var(--glass-bg)', color: 'var(--text-main)', confirmButtonColor: 'var(--primary)'
        });
    }

    element.classList.add('saved');
    const icon = element.querySelector('i');
    if (icon) icon.style.color = 'var(--success)'; 
    const textNode = element.lastChild;
    const currentCount = parseInt(textNode.textContent) || 0;
    textNode.textContent = ` ${currentCount + 1}`;

    try {
        await fetch(`${window.DJ_API_URL}/mixes/${id}/download`, { 
            method: 'POST',
            headers: { "Authorization": `Bearer ${token}` }
        });

        Swal.fire({
            icon: 'success', title: 'Added to Playlist! 🎧',
            text: 'This mix has been securely saved to your personal platform playlist.',
            background: 'var(--glass-bg)', color: 'var(--text-main)', confirmButtonColor: 'var(--primary)',
            backdrop: `rgba(0,0,0,0.6)`
        });
    } catch (e) {
        console.error('Failed to save to playlist', e);
    }
}

window.likeMix = likeMix;
window.downloadMix = downloadMix;

// ---------------------------------------------------------
// 🚀 DIRECT INITIALIZATION EXECUTOR
// ---------------------------------------------------------
function startApp() {
    loadMixes();

    const menuBtn = document.querySelector('.menu-toggle-btn');
    const leftNav = document.getElementById("left-nav");

    if (menuBtn && leftNav) {
        menuBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (window.innerWidth <= 768) {
                leftNav.classList.toggle("open");
            } else {
                leftNav.classList.toggle("collapsed");
            }
        };
    }

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && leftNav && leftNav.classList.contains('open')) {
            if (!leftNav.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
                leftNav.classList.remove('open');
            }
        }
    });
}

// Execute immediately without relying on external window events
startApp();