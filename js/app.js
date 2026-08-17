const API_URL = "https://dj-grey.onrender.com/api";
const DEFAULT_ARTWORK = "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";
let playlist = [];
let currentTab = "home";

// Premium Success Toast Timer Configuration
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: 'rgba(20, 20, 28, 0.95)',
  color: '#fff'
});

// ---------------------------------------------------------
// 🔄 FETCH MIXES WITH AUTH (PERSISTENT SAVES & LIKES)
// ---------------------------------------------------------
async function loadMixes() {
  try {
    const token = localStorage.getItem("dj_grey_token");
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};
    
    const res = await fetch(`${API_URL}/mixes`, { headers });
    playlist = await res.json();
    renderGrid(playlist);
  } catch (error) {
    console.error("Error loading mixes:", error);
  }
}

// ---------------------------------------------------------
// 🎨 RENDER GRID (WITH PERSISTENT BUTTON STYLES)
// ---------------------------------------------------------
function renderGrid(mixes) {
  const grid = document.getElementById("mixes-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (mixes.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">No mixes found in this section.</p>`;
    return;
  }

  mixes.forEach((mix, index) => {
    const art = mix.artwork_url || DEFAULT_ARTWORK;
    
    const likeClass = mix.is_liked ? "liked" : "";
    const likeStyle = mix.is_liked ? "color: var(--danger);" : "";
    const saveClass = mix.is_saved ? "saved" : "";
    const saveStyle = mix.is_saved ? "color: var(--success);" : "";

    grid.innerHTML += `
        <div class="card">
            <img src="${art}" class="card-img" alt="Artwork" onerror="this.src='${DEFAULT_ARTWORK}'">
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
  currentTab = tab;
  const titleEl = document.getElementById("page-section-title");

  document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.remove("active");
      if (el.getAttribute("onclick") && el.getAttribute("onclick").includes(tab)) {
          el.classList.add("active");
      }
  });

  if (tab === "home") {
    if (titleEl) titleEl.innerText = "LATEST DROPS";
    renderGrid(playlist);
  } else if (tab === "trending") {
    if (titleEl) titleEl.innerText = "🔥 TRENDING DROPS";
    const sorted = [...playlist].sort((a, b) => ((b.likes_count || 0) + (b.downloads_count || 0)) - ((a.likes_count || 0) + (a.downloads_count || 0)));
    renderGrid(sorted);
  } else if (tab === "liked") {
    if (titleEl) titleEl.innerText = "❤️ LIKED MIXES";
    const liked = playlist.filter((m) => m.is_liked || m.likes_count > 0);
    renderGrid(liked);
  } else if (tab === "history") {
    if (titleEl) titleEl.innerText = "🕒 WATCH & LISTEN HISTORY";
    renderGrid(playlist);
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
      if(leftNav) leftNav.classList.remove("open");
  }
}

// ---------------------------------------------------------
// 💿 EXTERNAL HUBS (HEARTHIS & SPOTIFY)
// ---------------------------------------------------------
async function fetchHearthisMixes() {
    const grid = document.getElementById("mixes-grid");
    if (!grid) return;
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Syncing directly with DJ Grey's Hearthis.at account...</p>`;
    try {
        const res = await fetch(`${API_URL}/hearthis/sync/grey-george`); 
        const data = await res.json();
        if(data.success && data.mixes.length > 0) {
            playlist = data.mixes; 
            renderGrid(playlist);
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
        
        const res = await fetch(`${API_URL}/spotify/sync?url=${encodeURIComponent(targetSpotifyUrl)}&title=${encodeURIComponent(customTitle)}`);
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
// 📺 WEBRTC LIVESTREAM WATCHER & LIVE CHAT
// ---------------------------------------------------------
const socket = (typeof io !== "undefined") ? io("https://dj-grey.onrender.com") : null;
let peerConnection;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function checkLiveStream() {
    const container = document.getElementById("livestream-container") || document.getElementById("mixes-grid");
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/livestream/active`);
        const data = await res.json();

        if (data.active) {
            container.innerHTML = `
                <div style="background: var(--panel-bg); border-radius: 12px; padding: 20px; margin-top: 20px;">
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
            initWebRTCWatcher();
            loadLiveChat();
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
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

function initWebRTCWatcher() {
    if (!socket) return;
    socket.emit("watcher");

    socket.on("offer", (id, description) => {
        peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnection
            .setRemoteDescription(description)
            .then(() => peerConnection.createAnswer())
            .then(sdp => peerConnection.setLocalDescription(sdp))
            .then(() => socket.emit("answer", id, peerConnection.localDescription));

        peerConnection.ontrack = event => {
            const remoteVideo = document.getElementById("remote-video");
            if (remoteVideo) remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) socket.emit("candidate", id, event.candidate);
        };
    });

    socket.on("candidate", (id, candidate) => {
        if (peerConnection) peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("broadcaster", () => socket.emit("watcher"));
    socket.on("disconnectPeer", () => {
        if (peerConnection) peerConnection.close();
    });
}

async function loadLiveChat() {
    try {
        const res = await fetch(`${API_URL}/livestream/chat`);
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
        await fetch(`${API_URL}/livestream/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ message: input.value.trim() })
        });
        input.value = "";
        loadLiveChat();
    } catch (e) {}
}

// ---------------------------------------------------------
// 🔴 TIKTOK STYLE BANNER
// ---------------------------------------------------------
async function checkLiveStatusBanner() {
    try {
        const res = await fetch(`${API_URL}/livestream/active`);
        const data = await res.json();
        
        const existingBanner = document.getElementById("live-alert-banner");
        if (existingBanner) existingBanner.remove();

        if (data.active && data.stream) {
            const container = document.querySelector(".main-content .container");
            if (container) {
                const banner = document.createElement("div");
                banner.id = "live-alert-banner";
                banner.className = "live-alert-banner";
                banner.onclick = () => switchTab('livestream');
                banner.innerHTML = `
                    <div>
                        <span class="live-dot-pulse"></span>
                        <strong>DJ GREY IS LIVE NOW!</strong> - ${data.stream.title}
                    </div>
                    <span style="font-weight: bold; background: rgba(0,0,0,0.3); padding: 5px 12px; border-radius: 20px;">
                        WATCH STREAM <i class="fa-solid fa-chevron-right"></i>
                    </span>
                `;
                container.prepend(banner);
            }
        }
    } catch (e) {}
}

// ---------------------------------------------------------
// 💸 FLUTTERWAVE DJ PREMIUM UPLOAD
// ---------------------------------------------------------
function openSubmissionModal() {
    const currentToken = localStorage.getItem("dj_grey_token");
    if (!currentToken) {
        return Swal.fire({ icon: 'warning', title: 'Login Required', text: 'You must log in before submitting a mix.' });
    }
    const modal = document.getElementById("upload-modal");
    if(modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("show"), 10);
    }
}

function closeUploadModal() {
    const modal = document.getElementById("upload-modal");
    if(modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.style.display = "none", 400);
    }
}

async function submitMixToGateway(e) {
    if (e) e.preventDefault();
    const currentToken = localStorage.getItem("dj_grey_token");
    const title = document.getElementById("up-title") ? document.getElementById("up-title").value : "";
    const audio_url = document.getElementById("up-audio") ? document.getElementById("up-audio").value : "";
    const artwork_url = document.getElementById("up-artwork") ? document.getElementById("up-artwork").value : "";
    
    if (!title || !audio_url) {
        return Swal.fire({ icon: 'error', title: 'Missing Info', text: 'Please provide a Title and Audio Link.' });
    }

    const btnFlw = document.getElementById("pay-flw-btn");
    if (btnFlw) {
        btnFlw.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securely Loading...';
        btnFlw.disabled = true;
    }

    try {
        const res = await fetch(`${API_URL}/submissions/flutterwave/create`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentToken}`
            },
            body: JSON.stringify({ 
                title, 
                audio_url: audio_url.includes('spotify.com') ? '' : audio_url, 
                spotify_url: audio_url.includes('spotify.com') ? audio_url : '', 
                artwork_url 
            })
        });
        
        const data = await res.json();
        
        if (data.url) {
            window.location.href = data.url; 
        } else {
            Swal.fire({ icon: 'error', title: 'Checkout Failed', text: data.error || 'Gateway rejected request.' });
            if (btnFlw) resetGatewayButton(btnFlw);
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Could not connect to payment gateway.' });
        if (btnFlw) resetGatewayButton(btnFlw);
    }
}

function resetGatewayButton(btn) {
    if (!btn) return;
    btn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> Pay with M-Pesa / Card';
    btn.disabled = false;
}

// ---------------------------------------------------------
// ☀️ / 🌙 THEME TOGGLE LOGIC
// ---------------------------------------------------------
function toggleTheme() {
    const html = document.documentElement;
    const icon = document.querySelector("#theme-toggle i");
    
    if (html.getAttribute("data-theme") === "light") {
        html.setAttribute("data-theme", "dark");
        if (icon) {
            icon.classList.remove("fa-moon");
            icon.classList.add("fa-sun");
        }
        localStorage.setItem("dj_grey_theme", "dark");
    } else {
        html.setAttribute("data-theme", "light");
        if (icon) {
            icon.classList.remove("fa-sun");
            icon.classList.add("fa-moon");
        }
        localStorage.setItem("dj_grey_theme", "light");
    }
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
        await fetch(`${API_URL}/mixes/${id}/like`, { 
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
        await fetch(`${API_URL}/mixes/${id}/download`, { 
            method: 'POST',
            headers: { "Authorization": `Bearer ${token}` }
        });

        Swal.fire({
            icon: 'success', title: 'Added to Playlist! 🎧',
            text: 'This mix has been securely saved to your personal platform playlist. You can listen to it anytime from the "My Playlist" tab.',
            background: 'var(--glass-bg)', color: 'var(--text-main)', confirmButtonColor: 'var(--primary)',
            backdrop: `rgba(0,0,0,0.6)`
        });
    } catch (e) {
        console.error('Failed to save to playlist', e);
    }
}

// ---------------------------------------------------------
// 🚀 EVENT LISTENERS & DOM INITIALIZATION
// ---------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    // Check for payment redirect flags
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('upload') === 'success') {
        Swal.fire({
            icon: 'success', title: 'Payment Successful!', text: 'Your subscription is active and your mix is in the review queue.', background: 'rgba(30, 41, 59, 0.95)', color: '#fff'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('upload') === 'failed') {
         Swal.fire({
            icon: 'error', title: 'Payment Failed', text: 'Your transaction could not be completed. Please try again.', background: 'rgba(30, 41, 59, 0.95)', color: '#fff'
        });
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Apply saved theme
    const savedTheme = localStorage.getItem("dj_grey_theme");
    if (savedTheme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        const icon = document.querySelector("#theme-toggle i");
        if (icon) {
            icon.classList.remove("fa-sun");
            icon.classList.add("fa-moon");
        }
    }

    // Live status banner polling
    checkLiveStatusBanner();
    setInterval(checkLiveStatusBanner, 10000);

    // Sidebar navigation toggle
    const menuBtn = document.querySelector('.menu-toggle-btn');
    const leftNav = document.getElementById("left-nav");

    if (menuBtn && leftNav) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (window.innerWidth <= 768) {
                leftNav.classList.toggle("open");
            } else {
                leftNav.classList.toggle("collapsed");
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && leftNav && leftNav.classList.contains('open')) {
            if (!leftNav.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
                leftNav.classList.remove('open');
            }
        }
    });
});

window.onload = loadMixes;