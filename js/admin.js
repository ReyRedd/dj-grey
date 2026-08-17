const API_URL = "https://dj-grey.onrender.com/api";
const token = localStorage.getItem("dj_grey_token");
const role = localStorage.getItem("dj_grey_role");

if (!token || (role !== "admin" && role !== "dj")) window.location.href = "/";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

function switchAdminTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-link").forEach((link) => link.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");
  const targetLink = document.querySelector(`.tab-link[onclick*="${tabId}"]`);
  if (targetLink) targetLink.classList.add("active");

  if (tabId === "livestream-control") setTimeout(initBroadcastStudio, 500);
}

// ---------------------------------------------------------
// 🔴 WEBRTC LIVESTREAM BROADCASTER LOGIC
// ---------------------------------------------------------
const socket = (typeof io !== "undefined") ? io(API_URL.replace('/api', '')) : null;
let localStream = null;
const peerConnections = {};
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function initBroadcastStudio() {
    const videoElement = document.getElementById("admin-video-preview") || document.querySelector("video");
    if (!videoElement) return;

    try {
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        videoElement.srcObject = localStream;
    } catch (err) {
        console.error("Camera access denied:", err);
    }
}

async function startNativeBroadcast() {
    const titleInput = document.getElementById("stream-title-input");
    const title = titleInput ? titleInput.value || "DJ GREY LIVE SESSION" : "DJ GREY LIVE SESSION";

    try {
        if (!localStream) await initBroadcastStudio();

        const res = await fetch(`${API_URL}/admin/livestream`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ title: title, is_active: true }),
        });

        const data = await res.json();

        if (data.success) {
            if (socket) socket.emit("broadcaster");
            Swal.fire({ icon: "success", title: "You Are LIVE! 🔴", background: "var(--panel-bg)", color: "#fff" });
        }
    } catch (err) {
        Swal.fire({ icon: "error", title: "Broadcast Failed", background: "var(--panel-bg)", color: "#fff" });
    }
}

async function stopNativeBroadcast() {
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }
    
    await fetch(`${API_URL}/admin/livestream`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: false }),
    });

    Swal.fire({ icon: "info", title: "Broadcast Ended", background: "var(--panel-bg)", color: "#fff" });
}

if (socket) {
    socket.on("watcher", (id) => {
        const peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnections[id] = peerConnection;

        if (localStream) {
            localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
        }

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) socket.emit("candidate", id, event.candidate);
        };

        peerConnection.createOffer()
            .then((sdp) => peerConnection.setLocalDescription(sdp))
            .then(() => socket.emit("offer", id, peerConnection.localDescription));
    });

    socket.on("answer", (id, description) => {
        if (peerConnections[id]) peerConnections[id].setRemoteDescription(description);
    });

    socket.on("candidate", (id, candidate) => {
        if (peerConnections[id]) peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("disconnectPeer", (id) => {
        if (peerConnections[id]) {
            peerConnections[id].close();
            delete peerConnections[id];
        }
    });
}

// Bind to window explicitly
window.startNativeBroadcast = startNativeBroadcast;
window.stopNativeBroadcast = stopNativeBroadcast;
window.switchAdminTab = switchAdminTab;

window.onload = () => {
  if (role === "dj") switchAdminTab("livestream-control");
  else switchAdminTab("dashboard-tab");
};