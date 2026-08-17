const API_URL = "https://dj-grey.onrender.com/api";
const DEFAULT_ARTWORK =
  "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";
const token = localStorage.getItem("dj_grey_token");
const role = localStorage.getItem("dj_grey_role");

if (!token || (role !== "admin" && role !== "dj")) window.location.href = "/";

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

document.getElementById("date-display").innerText =
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function switchAdminTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-link")
    .forEach((link) => link.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");
  const targetLink = document.querySelector(`.tab-link[onclick*="${tabId}"]`);
  if (targetLink) targetLink.classList.add("active");

  const title = document.getElementById("page-title");
  if (tabId === "dashboard-tab") {
    if (title) title.innerText = "Platform Intelligence";
    if (role === "admin") loadAdminData();
  }
  if (tabId === "subscriptions-tab") {
    if (title) title.innerText = "Subscription Hub";
    if (role === "admin") loadSubscriptions();
  }
  if (tabId === "users-tab") {
    if (title) title.innerText = "Fan Network";
    if (role === "admin") loadUsers();
  }
  if (tabId === "submissions") {
    if (title) title.innerText = "Mix Queue ($0.50)";
    if (role === "admin") loadSubmissionsQueue();
  }
  if (tabId === "livestream-control") {
    if (title) title.innerText = "Live Studio";
  }
}

let analyticsChart;

// 📊 Full-Width Line Graph & Analytics
async function loadAdminData() {
  try {
    const analyticsRes = await fetch(`${API_URL}/admin/analytics`, {
      headers: getAuthHeaders(),
    });
    const analytics = await analyticsRes.json();

    document.getElementById("total-mixes").innerText = analytics.totalMixes;
    document.getElementById("total-plays").innerText = analytics.totalPlays;
    document.getElementById("total-likes").innerText = analytics.totalLikes;
    document.getElementById("total-downloads").innerText =
      analytics.totalDownloads;

    const ctx = document.getElementById("analyticsChart").getContext("2d");
    if (analyticsChart) analyticsChart.destroy();

    analyticsChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Global Plays", "Fan Likes", "Downloads", "Comments"],
        datasets: [
          {
            label: "Activity Level",
            data: [
              analytics.totalPlays,
              analytics.totalLikes,
              analytics.totalDownloads,
              analytics.totalComments,
            ],
            borderColor: "#00a8ff",
            backgroundColor: "rgba(0, 168, 255, 0.12)",
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: "#bd00ff",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#a0a0a0" },
          },
          x: { grid: { display: false }, ticks: { color: "#a0a0a0" } },
        },
      },
    });

    const res = await fetch(`${API_URL}/mixes`);
    const mixes = await res.json();
    const tableBody = document.getElementById("admin-table-body");
    tableBody.innerHTML = mixes
      .map(
        (mix) => `
            <tr>
                <td style="font-weight: bold;">${mix.title}</td>
                <td><span style="color:#ff4d4d;"><i class="fa-solid fa-heart"></i> ${mix.likes_count}</span></td>
                <td><span style="color:var(--primary);"><i class="fa-solid fa-download"></i> ${mix.downloads_count}</span></td>
                <td><span class="sub-status-active">Live</span></td>
                <td><button class="btn-action" style="background:var(--danger); padding: 5px 10px;" onclick="deleteMix(${mix.id})"><i class="fa-solid fa-trash"></i> Delete</button></td>
            </tr>
        `
      )
      .join("");
  } catch (e) {
    console.error(e);
  }
}

async function deleteMix(id) {
  const result = await Swal.fire({
    title: "Erase Mix?",
    text: "Are you sure you want to permanently delete this mix?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: '<i class="fa-solid fa-trash"></i> Delete',
    cancelButtonText: "Cancel",
    background: "var(--panel-bg)",
    color: "var(--text-main)",
  });

  if (!result.isConfirmed) return;

  await fetch(`${API_URL}/mixes/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  loadAdminData();
}

// 👑 AUTOMATED SUBSCRIPTIONS HUB LOGIC
async function loadSubscriptions() {
  const tbody = document.getElementById("subs-table-body");
  try {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Auto-syncing ledger...</td></tr>`;

    await fetch(`${API_URL}/admin/subscriptions/engine`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    const res = await fetch(`${API_URL}/admin/subscriptions`, {
      headers: getAuthHeaders(),
    });
    const subs = await res.json();

    let active = 0,
      expiring = 0,
      expired = 0;

    if (!subs || subs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No VIP subscriptions found yet.</td></tr>`;
    } else {
      tbody.innerHTML = subs
        .map((sub) => {
          if (sub.sub_status === "active") active++;
          if (sub.sub_status === "expiring") expiring++;
          if (sub.sub_status === "expired") expired++;

          const dateStr = sub.sub_end_date
            ? new Date(sub.sub_end_date).toLocaleDateString()
            : "N/A";
          return `
                <tr>
                    <td><strong>${sub.username}</strong></td>
                    <td>${sub.email}</td>
                    <td><span class="sub-status-${sub.sub_status}">${sub.sub_status.toUpperCase()}</span></td>
                    <td>${dateStr}</td>
                    <td>
                      <button class="btn-action" style="padding: 5px 10px;" onclick="manageSubscription(${sub.id}, '${sub.username}')">
                          <i class="fa-solid fa-gear"></i> Manage
                      </button>
                    </td>
                </tr>
            `;
        })
        .join("");
    }

    document.getElementById("sub-active").innerText = active;
    document.getElementById("sub-expiring").innerText = expiring;
    document.getElementById("sub-expired").innerText = expired;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Failed to load subscription ledger.</td></tr>`;
  }
}

// 👥 FAN NETWORK LOADER
async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: getAuthHeaders(),
    });
    const users = await res.json();
    const grid = document.getElementById("users-bento-grid");

    document.getElementById("user-count-badge").innerText =
      `${users.length} Registered Fans`;

    grid.innerHTML = users
      .map((u) => {
        const initial = u.username ? u.username.charAt(0).toUpperCase() : "F";
        return `
            <div class="fan-card">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="fan-avatar">${initial}</div>
                        <span class="sub-status-${u.status === "approved" ? "active" : "expired"}">${u.status}</span>
                    </div>
                    <div class="fan-info">
                        <h4>${u.username}</h4>
                        <p><i class="fa-solid fa-envelope"></i> ${u.email}</p>
                        <span style="font-size:0.8rem; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; color:var(--primary);">
                            Role: ${u.role.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div style="margin-top:15px; border-top:1px solid var(--border-color); padding-top:15px; display:flex; gap:10px;">
                    ${u.status === "pending" ? `<button class="btn-action" style="flex:1; background:var(--success); color:#000;" onclick="approveUser(${u.id})">Approve</button>` : ""}
                    <button class="btn-action" style="flex:1; background:var(--danger);" onclick="deleteUser(${u.id}, '${u.username}')">Remove</button>
                </div>
            </div>
        `;
      })
      .join("");
  } catch (e) {
    console.error(e);
  }
}

async function approveUser(id) {
  await fetch(`${API_URL}/admin/users/${id}/approve`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  loadUsers();
}

async function deleteUser(id, username) {
  const result = await Swal.fire({
    title: "Remove Fan Account?",
    text: `Are you sure you want to remove ${username}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "var(--danger)",
    confirmButtonText: "Remove User",
    background: "var(--panel-bg)",
    color: "var(--text-main)",
  });

  if (!result.isConfirmed) return;

  await fetch(`${API_URL}/admin/users/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  loadUsers();
}

// 📦 MIX QUEUE LOGIC
async function loadSubmissionsQueue() {
  const tbody = document.getElementById("submissions-table-body");
  try {
    const res = await fetch(`${API_URL}/admin/submissions`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No DJ submissions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map((s) => {
        let feeBadge = "";
        let actionHtml = "";

        if (s.status === "awaiting_payment" || s.status === "failed") {
          feeBadge = `<span class="sub-status-expired">Unpaid / Abandoned</span>`;
          actionHtml = `
            <button class="btn-action" style="background: var(--danger); padding: 5px 10px;" onclick="deleteSubmission(${s.id})">
                <i class="fa-solid fa-trash"></i> Clear
            </button>`;
        } else if (s.status === "pending") {
          feeBadge = `<span class="sub-status-active">$0.50 USD Paid</span>`;
          actionHtml = `<button class="btn-action" style="padding: 5px 10px;" onclick="approveSubmission(${s.id})"><i class="fa-solid fa-check"></i> Approve & Publish</button>`;
        } else {
          feeBadge = `<span class="sub-status-active">$0.50 USD Paid</span>`;
          actionHtml = `<span style="color: var(--success); font-weight: bold;">Published</span>`;
        }

        return `
            <tr>
                <td><strong>${s.dj_name || s.username || "Unknown"}</strong></td>
                <td>${s.title}</td>
                <td>${feeBadge}</td>
                <td><a href="${s.audio_url || s.spotify_url || "#"}" target="_blank" style="color: var(--primary);">Listen Link</a></td>
                <td>${actionHtml}</td>
            </tr>
        `;
      })
      .join("");
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading mix queue.</td></tr>`;
  }
}

async function approveSubmission(id) {
  try {
    const res = await fetch(`${API_URL}/admin/submissions/${id}/approve`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Published!",
        text: "Mix is now live in the main catalog.",
        background: "var(--panel-bg)",
        color: "var(--text-main)",
      });
      loadSubmissionsQueue();
    }
  } catch (e) {}
}

// ---------------------------------------------------------
// 🔴 WEBRTC LIVESTREAM BROADCASTER LOGIC (STUDIO SIDE)
// ---------------------------------------------------------
const socket = (typeof io !== "undefined") ? io("https://dj-grey.onrender.com") : null;
let localStream;
const peerConnections = {};
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function startNativeBroadcast() {
  const title =
    document.getElementById("stream-title-input")?.value ||
    "DJ GREY LIVE SESSION";

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const videoElement = document.getElementById("dj-broadcast-video") || document.getElementById("admin-video-preview");
    if (videoElement) videoElement.srcObject = localStream;

    const res = await fetch(`${API_URL}/admin/livestream`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: title, is_active: true }),
    });

    const data = await res.json();

    if (data.success) {
      if (socket) socket.emit("broadcaster");
      Swal.fire({
        icon: "success",
        title: "You Are LIVE! 🔴",
        text: "Streaming directly from your browser to all connected fans.",
        background: "var(--panel-bg)",
        color: "var(--text-main)",
      });
    }
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Camera/Mic Error",
      text: "Please allow camera and microphone permissions to broadcast.",
      background: "var(--panel-bg)",
      color: "var(--text-main)",
    });
  }
}

async function stopNativeBroadcast() {
  if (localStream) localStream.getTracks().forEach((track) => track.stop());
  const videoElement = document.getElementById("dj-broadcast-video") || document.getElementById("admin-video-preview");
  if (videoElement) videoElement.srcObject = null;

  await fetch(`${API_URL}/admin/livestream`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_active: false }),
  });

  Swal.fire({
    icon: "info",
    title: "Broadcast Ended",
    background: "var(--panel-bg)",
    color: "var(--text-main)",
  });
}

// WebRTC Signaling Handlers
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

// 🗑️ ELEGANT SWEETALERT DELETE HANDLER
async function deleteSubmission(id) {
  const result = await Swal.fire({
    title: "Delete Abandoned Record?",
    text: "Are you sure you want to remove this submission? This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "var(--danger)",
    cancelButtonColor: "rgba(255, 255, 255, 0.1)",
    confirmButtonText: '<i class="fa-solid fa-trash"></i> Delete',
    cancelButtonText: "Cancel",
    background: "var(--panel-bg)",
    color: "var(--text-main)",
    backdrop: `rgba(0,0,0,0.75)`,
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`${API_URL}/admin/submissions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Record Cleared",
        text: "The abandoned submission has been permanently removed.",
        background: "var(--panel-bg)",
        color: "var(--text-main)",
        confirmButtonColor: "var(--primary)",
      });
      loadSubmissionsQueue();
    } else {
      Swal.fire({
        icon: "error",
        title: "Action Failed",
        text: "Unable to remove record from database.",
        background: "var(--panel-bg)",
        color: "var(--text-main)",
      });
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Network Error",
      text: "Could not connect to the server.",
      background: "var(--panel-bg)",
      color: "var(--text-main)",
    });
  }
}

async function manageSubscription(userId, username) {
  const result = await Swal.fire({
    title: `Manage VIP: ${username}`,
    text: "Select an administrative action for this account:",
    icon: "question",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: '<i class="fa-solid fa-plus"></i> Extend +30 Days',
    denyButtonText: '<i class="fa-solid fa-ban"></i> Revoke VIP',
    cancelButtonText: "Cancel",
    confirmButtonColor: "var(--success)",
    denyButtonColor: "var(--danger)",
    background: "var(--panel-bg)",
    color: "var(--text-main)",
    backdrop: `rgba(0,0,0,0.8)`,
  });

  if (result.isConfirmed) {
    const res = await fetch(`${API_URL}/admin/users/${userId}/extend-sub`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Extended!",
        text: "Added 30 days to VIP access.",
        background: "var(--panel-bg)",
        color: "var(--text-main)",
      });
      loadSubscriptions();
    }
  } else if (result.isDenied) {
    const res = await fetch(`${API_URL}/admin/users/${userId}/revoke-sub`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      Swal.fire({
        icon: "warning",
        title: "Revoked!",
        text: "VIP status expired and mixes hidden.",
        background: "var(--panel-bg)",
        color: "var(--text-main)",
      });
      loadSubscriptions();
    }
  }
}

window.onload = () => {
  if (role === "dj") {
    document.querySelectorAll(".sidebar-menu li").forEach((li) => {
      if (!li.innerHTML.includes("livestream-control"))
        li.style.display = "none";
    });
    switchAdminTab("livestream-control");
  } else {
    switchAdminTab("dashboard-tab");
  }
};

// ☀️ / 🌙 THEME TOGGLE LOGIC
function toggleTheme() {
  const html = document.documentElement;
  const icon = document.querySelector("#theme-toggle i");

  if (html.getAttribute("data-theme") === "light") {
    html.setAttribute("data-theme", "dark");
    if (icon) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    }
  } else {
    html.setAttribute("data-theme", "light");
    if (icon) {
      icon.classList.remove("fa-sun");
      icon.classList.add("fa-moon");
    }
  }
}

// ---------------------------------------------------------
// 🍔 UNIVERSAL SIDEBAR TOGGLE LOGIC (ADMIN SITE)
// ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const adminMenuBtn = document.getElementById("admin-menu-toggle");
  const sidebar = document.getElementById("sidebar");

  if (adminMenuBtn && sidebar) {
    adminMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle("open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar &&
      sidebar.classList.contains("open")
    ) {
      if (!sidebar.contains(e.target) && !adminMenuBtn.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    }
  });
});