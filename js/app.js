// ---------------------------------------------------------
// 🌐 SAFE ISOLATED NAMESPACES
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    window.djCatalog = Array.isArray(data) ? data : [];
    renderGrid(window.djCatalog);
  } catch (error) { grid.innerHTML = `<p style="color: #ff4d4d; text-align: center;"><i class="fa-solid fa-triangle-exclamation"></i> Network Error.</p>`; }
}

// ---------------------------------------------------------
// 🎨 RENDER GRID
// ---------------------------------------------------------
function renderGrid(mixes) {
  const grid = document.getElementById("mixes-grid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!mixes || mixes.length === 0) { grid.innerHTML = `<p style="color: var(--text-muted); padding: 20px;">No mixes found.</p>`; return; }

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
                    <button class="btn-play" onclick="window.playMix(${index})"><i class="fa-solid fa-play"></i> PLAY</button>
                    <div class="stats">
                        <span class="${likeClass}" onclick="window.likeMix(${mix.id}, this)" title="Like"><i class="fa-solid fa-heart" style="${likeStyle}"></i> ${mix.likes_count || 0}</span>
                        <span class="${saveClass}" onclick="window.downloadMix(${mix.id}, this)" title="Add to Playlist"><i class="fa-solid fa-download" style="${saveStyle}"></i> ${mix.downloads_count || 0}</span>
                    </div>
                </div>
                <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <button class="comments-toggle-btn" onclick="openCommentsSidebar(${mix.id}, '${mix.title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-comments"></i> View Comments</button>
                </div>
            </div>
        </div>`;
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
      if (el.getAttribute("onclick") && el.getAttribute("onclick").includes(tab)) el.classList.add("active");
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

// ---------------------------------------------------------
// 💿 EXTERNAL HUBS
// ---------------------------------------------------------
async function fetchHearthisMixes() {
    const grid = document.getElementById("mixes-grid");
    if (!grid) return;
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Syncing with Hearthis.at...</p>`;
    try {
        const res = await fetch(`${window.DJ_API_URL}/hearthis/sync/grey-george`); 
        const data = await res.json();
        if (data.success && data.mixes.length > 0) { renderGrid(data.mixes); } 
        else { grid.innerHTML = `<p style="color: var(--text-muted);">No public mixes found.</p>`; }
    } catch(e) { grid.innerHTML = `<p style="color: #ff4d4d;">Hearthis connection failed.</p>`; }
}

async function loadSpotifyHub() {
    const grid = document.getElementById("mixes-grid");
    if (!grid) return;
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Syncing with Spotify...</p>`;
    try {
        const targetSpotifyUrl = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"; 
        const res = await fetch(`${window.DJ_API_URL}/spotify/sync?url=${encodeURIComponent(targetSpotifyUrl)}&title=Spotify%20Drop`);
        const data = await res.json();
        
        if (data.success && data.mix) {
            grid.innerHTML = `<div style="width: 100%; max-width: 900px; margin: 0 auto; text-align: center;">
                <div style="border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); margin-bottom: 25px;">${data.embed_html}</div>
            </div>`;
        } else { grid.innerHTML = `<p style="color: var(--text-muted);">Spotify Hub unavailable.</p>`; }
    } catch (e) { grid.innerHTML = `<p style="color: #ff4d4d;">Spotify connection failed.</p>`; }
}

// ---------------------------------------------------------
// 📺 WEBRTC LIVESTREAM WATCHER
// ---------------------------------------------------------
const socket = (typeof io !== "undefined") ? io(window.DJ_API_URL.replace('/api', '')) : null;
let peerConnection;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function checkLiveStream() {
    const container = document.getElementById("mixes-grid");
    if (!container) return;
    try {
        const res = await fetch(`${window.DJ_API_URL}/livestream/active`);
        const data = await res.json();
        if (data.active) {
            container.innerHTML = `
                <div style="background: var(--panel-bg); border-radius: 12px; padding: 20px; width: 100%;">
                    <h3 style="margin-top: 0; color: var(--danger);"><i class="fa-solid fa-circle-dot"></i> LIVE NOW: ${data.stream ? data.stream.title : 'DJ GREY SESSION'}</h3>
                    <div style="background: #000; border-radius: 8px; overflow: hidden; height: 400px; margin-top: 15px;">
                        <video id="remote-video" autoplay playsinline controls style="width: 100%; height: 100%; object-fit: cover;"></video>
                    </div>
                </div>`;
            initWebRTCWatcher();
        } else {
            container.innerHTML = `<div style="text-align: center; padding: 60px 20px; width: 100%;"><i class="fa-solid fa-tower-broadcast" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 15px;"></i><h3>No Active Livestream</h3><p style="color: var(--text-muted);">DJ Grey is offline.</p></div>`;
        }
    } catch (e) { console.error(e); }
}

function initWebRTCWatcher() {
    if (!socket) return;
    socket.emit("watcher");
    socket.on("offer", (id, description) => {
        peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnection.setRemoteDescription(description).then(() => peerConnection.createAnswer()).then(sdp => peerConnection.setLocalDescription(sdp)).then(() => socket.emit("answer", id, peerConnection.localDescription));
        peerConnection.ontrack = event => { const remoteVideo = document.getElementById("remote-video"); if (remoteVideo) remoteVideo.srcObject = event.streams[0]; };
        peerConnection.onicecandidate = event => { if (event.candidate) socket.emit("candidate", id, event.candidate); };
    });
    socket.on("candidate", (id, candidate) => { if (peerConnection) peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); });
    socket.on("broadcaster", () => { if (window.djCurrentTab === "livestream") checkLiveStream(); });
    socket.on("disconnectPeer", () => { if (peerConnection) peerConnection.close(); if (window.djCurrentTab === "livestream") checkLiveStream(); });
}

// ---------------------------------------------------------
// 💸 FLUTTERWAVE DJ PREMIUM UPLOAD
// ---------------------------------------------------------
function openSubmissionModal() {
    const currentToken = localStorage.getItem("dj_grey_token");
    if (!currentToken) return Swal.fire({ icon: 'warning', title: 'Login Required', background: 'var(--panel-bg)', color: '#fff' });
    const modal = document.getElementById("upload-modal");
    if (modal) { modal.style.display = "flex"; setTimeout(() => modal.classList.add("show"), 10); }
}

function closeUploadModal() {
    const modal = document.getElementById("upload-modal");
    if (modal) { modal.classList.remove("show"); setTimeout(() => modal.style.display = "none", 400); }
}

async function submitMixToGateway(e) {
    if (e) e.preventDefault();
    const token = localStorage.getItem("dj_grey_token");
    const title = document.getElementById("up-title")?.value;
    const audio_url = document.getElementById("up-audio")?.value;
    if (!title || !audio_url) return Swal.fire({ icon: 'error', title: 'Missing Info', background: 'var(--panel-bg)', color: '#fff' });

    const btnFlw = document.getElementById("pay-flw-btn");
    if (btnFlw) { btnFlw.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...'; btnFlw.disabled = true; }

    try {
        const res = await fetch(`${window.DJ_API_URL}/submissions/flutterwave/create`, { method: 'POST', headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ title, audio_url, artwork_url: document.getElementById("up-artwork")?.value || "" }) });
        const data = await res.json();
        if (data.url) window.location.href = data.url; 
        else throw new Error(data.error);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Checkout Failed', background: 'var(--panel-bg)', color: '#fff' });
        if (btnFlw) { btnFlw.innerHTML = 'Pay with M-Pesa / Card'; btnFlw.disabled = false; }
    }
}

// ---------------------------------------------------------
// ❤️ LIKES & DOWNLOADS
// ---------------------------------------------------------
async function likeMix(id, element) {
    const token = localStorage.getItem("dj_grey_token");
    if (!token) return Swal.fire({ icon: 'warning', title: 'Login Required', background: 'var(--panel-bg)', color: '#fff' });
    if (element.classList.contains('liked')) return; 
    element.classList.add('liked'); element.querySelector('i').style.color = 'var(--danger)'; 
    element.lastChild.textContent = ` ${(parseInt(element.lastChild.textContent) || 0) + 1}`;
    await fetch(`${window.DJ_API_URL}/mixes/${id}/like`, { method: 'POST', headers: { "Authorization": `Bearer ${token}` } });
}

async function downloadMix(id, element) {
    const token = localStorage.getItem("dj_grey_token");
    if (!token) return Swal.fire({ icon: 'warning', title: 'Login Required', background: 'var(--panel-bg)', color: '#fff' });
    if (element.classList.contains('saved')) return; 
    element.classList.add('saved'); element.querySelector('i').style.color = 'var(--success)'; 
    element.lastChild.textContent = ` ${(parseInt(element.lastChild.textContent) || 0) + 1}`;
    await fetch(`${window.DJ_API_URL}/mixes/${id}/download`, { method: 'POST', headers: { "Authorization": `Bearer ${token}` } });
    Swal.fire({ icon: 'success', title: 'Added to Playlist!', background: 'var(--panel-bg)', color: '#fff' });
}

// ---------------------------------------------------------
// 🚀 GLOBAL BINDINGS & HAMBURGER INITIALIZATION
// ---------------------------------------------------------
window.switchTab = switchTab;
window.loadMixes = loadMixes;
window.openSubmissionModal = openSubmissionModal;
window.closeUploadModal = closeUploadModal;
window.submitMixToGateway = submitMixToGateway;
window.likeMix = likeMix;
window.downloadMix = downloadMix;
window.fetchHearthisMixes = fetchHearthisMixes;
window.loadSpotifyHub = loadSpotifyHub;

document.addEventListener("DOMContentLoaded", () => {
    loadMixes();
    const menuBtn = document.querySelector('.menu-toggle-btn');
    const leftNav = document.getElementById("left-nav");
    if (menuBtn && leftNav) {
        menuBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (window.innerWidth <= 768) leftNav.classList.toggle("open");
            else leftNav.classList.toggle("collapsed");
        };
    }
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && leftNav && leftNav.classList.contains('open')) {
            if (!leftNav.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) leftNav.classList.remove('open');
        }
    });
});