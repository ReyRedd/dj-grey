let currentTab = "home";

// Premium Success Toast Timer
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: 'rgba(20, 20, 28, 0.95)',
  color: '#fff'
});

async function loadMixes() {
  try {
    const res = await fetch(`${API_URL}/mixes`);
    playlist = await res.json();
    renderGrid(playlist);
  } catch (error) {
    console.error("Error loading mixes:", error);
  }
}

function renderGrid(mixes) {
  const grid = document.getElementById("mixes-grid");
  grid.innerHTML = "";

  if (mixes.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">No mixes found in this section.</p>`;
    return;
  }

  mixes.forEach((mix, index) => {
    const art = DEFAULT_ARTWORK;
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
                        <span onclick="likeMix(${mix.id}, this)" title="Like"><i class="fa-solid fa-heart"></i> ${mix.likes_count || 0}</span>
                        <span onclick="downloadMix(${mix.id}, '${mix.audio_url}')" title="Download"><i class="fa-solid fa-download"></i> ${mix.downloads_count || 0}</span>
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
    titleEl.innerText = "LATEST DROPS";
    renderGrid(playlist);
  } else if (tab === "trending") {
    titleEl.innerText = "🔥 TRENDING DROPS";
    const sorted = [...playlist].sort((a, b) => (b.likes_count + b.downloads_count) - (a.likes_count + a.downloads_count));
    renderGrid(sorted);
  } else if (tab === "liked") {
    titleEl.innerText = "❤️ LIKED MIXES";
    const liked = playlist.filter((m) => m.likes_count > 0);
    renderGrid(liked);
  } else if (tab === "history") {
    titleEl.innerText = "🕒 WATCH & LISTEN HISTORY";
    renderGrid(playlist);
  } else if (tab === "hearthis") {
    titleEl.innerText = "💿 DJ GREY'S HEARTHIS HUB";
    fetchHearthisMixes();
  } else if (tab === "spotify") {
    titleEl.innerText = "🎧 DJ GREY'S SPOTIFY HUB";
    loadSpotifyHub(); 
  } else if (tab === "livestream") {
    titleEl.innerText = "🔴 LIVE STREAM & REALTME CHAT";
    loadLivestreamHub();
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
// 🔴 NATIVE WEBRTC VIEWER & LIVE CHAT (FAN SIDE)
// ---------------------------------------------------------
let viewerSocket = null;
let peerConnection = null;
let chatInterval = null;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function loadLivestreamHub() {
    const grid = document.getElementById("mixes-grid");
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Connecting to Live Stage...</p>`;

    try {
        const res = await fetch(`${API_URL}/livestream/active`);
        const data = await res.json();

        if (!data.active || !data.stream) {
            grid.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="fa-solid fa-tower-cell fa-3x" style="color: var(--text-muted); margin-bottom: 20px;"></i>
                    <h2>No Active Livestream Right Now</h2>
                    <p style="color: var(--text-muted);">DJ Grey is currently offline. Check back soon or stay tuned on socials!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = `
            <div style="display: flex; gap: 20px; flex-wrap: wrap; width: 100%;">
                <div style="flex: 2; min-width: 320px;">
                    <div style="position: relative; padding-bottom: 56.25%; height: 0; border-radius: 16px; overflow: hidden; background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
                        <video id="fan-broadcast-video" autoplay playsinline style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover;"></video>
                    </div>
                    <h2 style="margin-top: 15px; font-size: 1.4rem;">${data.stream.title}</h2>
                </div>

                <div style="flex: 1; min-width: 300px; height: 500px; background: rgba(20, 20, 28, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; display: flex; flex-direction: column; padding: 15px; backdrop-filter: blur(16px);">
                    <h3 style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; margin-top: 0; font-size: 1rem;"><i class="fa-solid fa-comments"></i> Live Chat</h3>
                    <div id="live-chat-box" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; padding-right: 5px;"></div>
                    
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="live-chat-input" placeholder="Say something..." style="flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; padding: 10px; border-radius: 8px; outline: none;">
                        <button onclick="sendLiveChatMessage()" style="background: var(--primary); color: #fff; border: none; padding: 0 15px; border-radius: 8px; font-weight: bold; cursor: pointer;"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        `;

        initWebRTCViewer();
        fetchLiveChat();
        if (chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(fetchLiveChat, 3000); 
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<p style="color: #ff4d4d;">Failed to connect to livestream server.</p>`;
    }
}

function initWebRTCViewer() {
    if (!viewerSocket) {
        viewerSocket = io("https://dj-grey.onrender.com");
    }

    const video = document.getElementById("fan-broadcast-video");
    viewerSocket.emit("watcher");

    viewerSocket.on("offer", (id, description) => {
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        peerConnection.setRemoteDescription(description)
            .then(() => peerConnection.createAnswer())
            .then(sdp => peerConnection.setLocalDescription(sdp))
            .then(() => viewerSocket.emit("answer", id, peerConnection.localDescription));

        peerConnection.ontrack = event => {
            if (video && video.srcObject !== event.streams[0]) {
                video.srcObject = event.streams[0];
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) viewerSocket.emit("candidate", id, event.candidate);
        };
    });

    viewerSocket.on("candidate", (id, candidate) => {
        if(peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
        }
    });

    viewerSocket.on("broadcaster", () => {
        viewerSocket.emit("watcher");
    });

    viewerSocket.on("disconnectPeer", () => {
        if(peerConnection) peerConnection.close();
        if(video) video.srcObject = null;
    });
}

async function fetchLiveChat() {
    const box = document.getElementById("live-chat-box");
    if (!box) return;
    try {
        const res = await fetch(`${API_URL}/livestream/chat`);
        const messages = await res.json();
        box.innerHTML = messages.map(m => `
            <div style="font-size: 0.85rem; line-height: 1.3;">
                <span style="font-weight: bold; color: var(--primary);">${m.username}:</span> 
                <span style="color: var(--text-main);">${m.message}</span>
            </div>
        `).join("");
        box.scrollTop = box.scrollHeight;
    } catch(e) {}
}

async function sendLiveChatMessage() {
    const currentToken = localStorage.getItem("dj_grey_token");
    if (!currentToken) return Swal.fire({ icon: 'warning', title: 'Login Required', text: 'Please login to join the live chat!' });
    
    const input = document.getElementById("live-chat-input");
    const message = input.value.trim();
    if (!message) return;

    try {
        const res = await fetch(`${API_URL}/livestream/chat`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentToken}`
            },
            body: JSON.stringify({ message })
        });
        if (res.ok) {
            input.value = "";
            fetchLiveChat();
        }
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

window.addEventListener('DOMContentLoaded', () => {
    checkLiveStatusBanner();
    setInterval(checkLiveStatusBanner, 10000); 
});

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
    e.preventDefault();
    const currentToken = localStorage.getItem("dj_grey_token");
    const title = document.getElementById("up-title").value;
    const audio_url = document.getElementById("up-audio").value;
    const artwork_url = document.getElementById("up-artwork").value;
    
    if (!title || !audio_url) {
        return Swal.fire({ icon: 'error', title: 'Missing Info', text: 'Please provide a Title and Audio Link.' });
    }

    const btnFlw = document.getElementById("pay-flw-btn");
    btnFlw.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securely Loading...';
    btnFlw.disabled = true;

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
            resetGatewayButton(btnFlw);
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Could not connect to payment gateway.' });
        resetGatewayButton(btnFlw);
    }
}

function resetGatewayButton(btn) {
    btn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> Pay with M-Pesa / Card';
    btn.disabled = false;
}

// Check for Upload Success Redirect
window.addEventListener('DOMContentLoaded', () => {
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
});

window.onload = loadMixes;

// ---------------------------------------------------------
// ☀️ / 🌙 THEME TOGGLE LOGIC FOR LIVE SITE
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

// Apply saved theme on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem("dj_grey_theme");
    if (savedTheme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        const icon = document.querySelector("#theme-toggle i");
        if (icon) {
            icon.classList.remove("fa-sun");
            icon.classList.add("fa-moon");
        }
    }
});