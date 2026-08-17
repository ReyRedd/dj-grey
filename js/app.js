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
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);

    const data = await res.json();
    window.djCatalog = Array.isArray(data) ? data : [];
    renderGrid(window.djCatalog);
  } catch (error) {
    console.error("Error loading mixes:", error);
    grid.innerHTML = `<p style="color: #ff4d4d; text-align: center; margin-top: 20px;"><i class="fa-solid fa-triangle-exclamation"></i> Unable to connect to music catalog.</p>`;
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
                    <button class="btn-play" onclick="window.playMix(${index})">
                        <i class="fa-solid fa-play"></i> PLAY
                    </button>
                    <div class="stats">
                        <span class="${likeClass}" onclick="window.likeMix(${mix.id}, this)" title="Like">
                            <i class="fa-solid fa-heart" style="${likeStyle}"></i> ${mix.likes_count || 0}
                        </span>
                        <span class="${saveClass}" onclick="window.downloadMix(${mix.id}, this)" title="Add to Playlist">
                            <i class="fa-solid fa-download" style="${saveStyle}"></i> ${mix.downloads_count || 0}
                        </span>
                    </div>
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
// 📺 WEBRTC LIVESTREAM WATCHER (FAN SIDE)
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
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-top: 15px;">
                        <div style="background: #000; border-radius: 8px; overflow: hidden; height: 400px;">
                            <video id="remote-video" autoplay playsinline controls style="width: 100%; height: 100%; object-fit: cover;"></video>
                        </div>
                    </div>
                </div>
            `;
            initWebRTCWatcher();
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; width: 100%;">
                    <i class="fa-solid fa-tower-broadcast" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 15px;"></i>
                    <h3>No Active Livestream Right Now</h3>
                    <p style="color: var(--text-muted);">DJ Grey is currently offline. Check back soon!</p>
                </div>
            `;
        }
    } catch (e) { console.error("Stream check failed", e); }
}

function initWebRTCWatcher() {
    if (!socket) return;
    socket.emit("watcher");

    socket.on("offer", (id, description) => {
        peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnection.setRemoteDescription(description)
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

    socket.on("broadcaster", () => {
        if (window.djCurrentTab === "livestream") checkLiveStream();
    });

    socket.on("disconnectPeer", () => {
        if (peerConnection) peerConnection.close();
        if (window.djCurrentTab === "livestream") checkLiveStream();
    });
}

// ---------------------------------------------------------
// 💸 FLUTTERWAVE DJ PREMIUM UPLOAD
// ---------------------------------------------------------
function openSubmissionModal() {
    const currentToken = localStorage.getItem("dj_grey_token");
    if (!currentToken) {
        return Swal.fire({ icon: 'warning', title: 'Login Required', text: 'You must log in to upload.', background: 'var(--panel-bg)', color: '#fff' });
    }
    const modal = document.getElementById("upload-modal");
    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("show"), 10);
    }
}

function closeUploadModal() {
    const modal = document.getElementById("upload-modal");
    if (modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.style.display = "none", 400);
    }
}

async function submitMixToGateway(e) {
    if (e) e.preventDefault();
    const currentToken = localStorage.getItem("dj_grey_token");
    const title = document.getElementById("up-title")?.value;
    const audio_url = document.getElementById("up-audio")?.value;
    
    if (!title || !audio_url) {
        return Swal.fire({ icon: 'error', title: 'Missing Info', text: 'Provide Title and Audio Link.', background: 'var(--panel-bg)', color: '#fff' });
    }

    const btnFlw = document.getElementById("pay-flw-btn");
    if (btnFlw) { btnFlw.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...'; btnFlw.disabled = true; }

    try {
        const res = await fetch(`${window.DJ_API_URL}/submissions/flutterwave/create`, {
            method: 'POST',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
            body: JSON.stringify({ title, audio_url, artwork_url: document.getElementById("up-artwork")?.value || "" })
        });
        const data = await res.json();
        
        if (data.url) window.location.href = data.url; 
        else throw new Error(data.error);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Checkout Failed', text: 'Gateway rejected request.', background: 'var(--panel-bg)', color: '#fff' });
        if (btnFlw) { btnFlw.innerHTML = 'Pay with M-Pesa / Card'; btnFlw.disabled = false; }
    }
}

// ---------------------------------------------------------
// 🚀 GLOBAL BINDINGS & INITIALIZATION
// ---------------------------------------------------------
window.switchTab = switchTab;
window.loadMixes = loadMixes;
window.openSubmissionModal = openSubmissionModal;
window.closeUploadModal = closeUploadModal;
window.submitMixToGateway = submitMixToGateway;

document.addEventListener("DOMContentLoaded", () => {
    loadMixes();
});