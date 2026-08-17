const API_URL = "https://dj-grey.onrender.com/api";
const DEFAULT_ARTWORK =
  "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";

const token = localStorage.getItem("dj_grey_token");
const role = localStorage.getItem("dj_grey_role");

// 🚨 Allow both "admin" AND "dj" roles to access this dashboard
if (!token || (role !== "admin" && role !== "dj")) {
  window.location.href = "/";
}

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

// Core UI Logic
document.getElementById("theme-toggle").addEventListener("click", () => {
  const newTheme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  document.getElementById("theme-toggle").innerHTML =
    newTheme === "dark"
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
});

document.getElementById("hamburger-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
  document.getElementById("main-content").classList.toggle("expanded");
});

document.getElementById("date-display").innerText =
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// ---------------------------------------------------------
// 📑 UNIFIED TAB SWITCHING LOGIC (Admin & DJ)
// ---------------------------------------------------------
function switchTab(event, tabId) {
  switchAdminTab(tabId);
}

function switchAdminTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".tab-link")
    .forEach((link) => link.classList.remove("active"));

  const targetTab =
    document.getElementById(tabId) || document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add("active");

  const targetLink = document.querySelector(`.tab-link[onclick*="${tabId}"]`);
  if (targetLink) targetLink.classList.add("active");

  const pageTitle = document.getElementById("page-title");
  const breadcrumb = document.getElementById("breadcrumb-current");

  if (tabId === "users-tab") {
    pageTitle.innerText = "Fan Management";
    breadcrumb.innerText = "Fan Management";
    if (role === "admin") loadUsers();
  } else if (tabId === "submissions" || tabId === "tab-submissions") {
    pageTitle.innerText = "DJ Mix Submissions";
    breadcrumb.innerText = "Uploads Queue";
    if (role === "admin") loadSubmissionsQueue();
  } else if (
    tabId === "livestream-control" ||
    tabId === "tab-livestream-control"
  ) {
    pageTitle.innerText = "Professional Broadcast Center";
    breadcrumb.innerText = "Livestream Center";
  } else {
    pageTitle.innerText = "Platform Control Center";
    breadcrumb.innerText = "Admin Dashboard";
    if (role === "admin") loadAdminData();
  }
}

let analyticsChart;

// Dashboard Data
async function loadAdminData() {
  try {
    const analyticsRes = await fetch(`${API_URL}/admin/analytics`, {
      headers: getAuthHeaders(),
    });
    const analytics = await analyticsRes.json();

    document.getElementById("total-mixes").innerText =
      analytics.totalMixes || 0;
    document.getElementById("total-plays").innerText =
      analytics.totalPlays || 0;
    document.getElementById("total-likes").innerText =
      analytics.totalLikes || 0;
    document.getElementById("total-downloads").innerText =
      analytics.totalDownloads || 0;
    document.getElementById("total-comments").innerText =
      analytics.totalComments || 0;

    const ctx = document.getElementById("analyticsChart").getContext("2d");
    if (analyticsChart) analyticsChart.destroy();
    analyticsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Plays", "Likes", "Downloads", "Comments"],
        datasets: [
          {
            label: "User Engagement",
            data: [
              analytics.totalPlays,
              analytics.totalLikes,
              analytics.totalDownloads,
              analytics.totalComments,
            ],
            backgroundColor: "rgba(0, 168, 255, 0.5)",
            borderColor: "#00a8ff",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });

    const res = await fetch(`${API_URL}/mixes`);
    const mixes = await res.json();
    const tableBody = document.getElementById("admin-table-body");
    tableBody.innerHTML = "";

    mixes.forEach((mix) => {
      const art = DEFAULT_ARTWORK;
      tableBody.innerHTML += `
          <tr>
              <td><img src="${art}" class="art-thumb" onerror="this.src='${DEFAULT_ARTWORK}'"></td>
              <td style="font-weight: bold;">${mix.title}</td>
              <td>
                  <span class="badge" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;">
                      <i class="fa-solid fa-heart" style="color: #ff4d4d;"></i> ${mix.likes_count || 0}
                  </span>
              </td>
              <td>
                  <span class="badge" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;">
                      <i class="fa-solid fa-download" style="color: var(--primary);"></i> ${mix.downloads_count || 0}
                  </span>
              </td>
              <td>
                  <button class="btn-delete" onclick="deleteMix(${mix.id}, '${mix.title.replace(/'/g, "\\'")}')">
                      <i class="fa-solid fa-trash"></i> Delete
                  </button>
              </td>
          </tr>
      `;
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

// Fan & User Management Data
async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: getAuthHeaders(),
    });
    const users = await res.json();
    const tableBody = document.getElementById("users-table-body");
    tableBody.innerHTML = "";

    let pendingCount = 0;

    users.forEach((user) => {
      const isPending = user.status === "pending";
      if (isPending) pendingCount++;

      const statusClass = isPending ? "status-pending" : "status-approved";
      const statusText = isPending ? "Pending" : "Approved";

      tableBody.innerHTML += `
                  <tr>
                      <td style="font-weight: bold; color: var(--text-main);">${user.username}</td>
                      <td>${user.email}</td>
                      <td><span style="text-transform: capitalize;">${user.role}</span></td>
                      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                      <td>
                          ${isPending ? `<button class="btn-approve" onclick="approveUser(${user.id})" style="margin-right: 10px;"><i class="fa-solid fa-check"></i> Approve</button>` : ""}
                          <button class="btn-delete" onclick="deleteUser(${user.id}, '${user.username}')"><i class="fa-solid fa-user-xmark"></i> Remove</button>
                      </td>
                  </tr>
              `;
    });

    const badge = document.getElementById("pending-badge");
    if (badge) {
      if (pendingCount > 0) {
        badge.innerText = pendingCount;
        badge.classList.add("show");
      } else {
        badge.classList.remove("show");
      }
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

async function approveUser(id) {
  try {
    await fetch(`${API_URL}/admin/users/${id}/approve`, {
      method: "PUT",
      headers: getAuthHeaders(),
    });
    loadUsers();
  } catch (err) {
    console.error(err);
  }
}

async function deleteUser(id, username) {
  const result = await Swal.fire({
    title: `Remove Fan: ${username}?`,
    text: "This will permanently delete their account, likes, and comments.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, remove fan",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "User Removed",
        timer: 2000,
        showConfirmButton: false,
      });
      loadUsers();
    }
  } catch (err) {
    console.error("Error deleting user:", err);
  }
}

async function loadSubmissionsQueue() {
  const tbody = document.getElementById("submissions-table-body");
  try {
    const res = await fetch(`${API_URL}/admin/submissions`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No pending DJ submissions.</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map(
        (s) => `
            <tr>
                <td><strong>${s.dj_name}</strong></td>
                <td>${s.title}</td>
                <td><span class="badge" style="background: rgba(37, 211, 102, 0.2); color: #25d366;">$0.50 USD Paid</span></td>
                <td><a href="${s.audio_url || s.spotify_url}" target="_blank" style="color: var(--primary);">Listen Link</a></td>
                <td>
                    ${s.status === "pending" ? `<button class="btn-approve" onclick="approveSubmission(${s.id})"><i class="fa-solid fa-check"></i> Approve & Publish</button>` : `<span style="color: var(--text-muted);">Published</span>`}
                </td>
            </tr>
        `,
      )
      .join("");
  } catch (e) {
    console.error(e);
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
      });
      loadSubmissionsQueue();
    }
  } catch (e) {}
}

document
  .getElementById("add-mix-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("mix-title").value;
    const audio_url = document.getElementById("mix-audio").value;
    const artwork_url = document.getElementById("mix-artwork").value;

    try {
      const res = await fetch(`${API_URL}/mixes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, audio_url, artwork_url }),
      });
      if (res.ok) {
        document.getElementById("add-mix-form").reset();
        loadAdminData();
      } else {
        if (res.status === 401 || res.status === 403) logout();
      }
    } catch (err) {
      console.error(err);
    }
  });

async function deleteMix(id, title) {
  const result = await Swal.fire({
    title: "Erase Mix from Catalog?",
    text: `Are you sure you want to permanently delete "${title}"?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, delete mix",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`${API_URL}/mixes/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Mix Erased",
        timer: 2000,
        showConfirmButton: false,
      });
      loadAdminData();
    }
  } catch (err) {
    console.error("Error deleting mix:", err);
  }
}

// ---------------------------------------------------------
// 📡 NATIVE RTMP BROADCAST STUDIO (OBS SETUP)
// ---------------------------------------------------------
async function generateOBSKeys() {
  const title =
    document.getElementById("stream-title-input").value || "DJ GREY LIVE";

  // Show loading state
  const btn = document.querySelector('button[onclick="generateOBSKeys()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Generating Keys...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/admin/livestream/generate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });
    const data = await res.json();

    if (res.ok) {
      document.getElementById("obs-credentials").style.display = "block";
      document.getElementById("obs-url").value = data.rtmp_url;
      document.getElementById("obs-key").value = data.stream_key;
      Swal.fire({
        icon: "success",
        title: "Keys Generated",
        text: "Paste these into OBS and go live!",
      });
    } else {
      Swal.fire({ icon: "error", title: "Error", text: data.error });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "Network Error",
      text: "Could not connect to stream server.",
    });
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function stopNativeBroadcast() {
  try {
    await fetch(`${API_URL}/admin/livestream/stop`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    document.getElementById("obs-credentials").style.display = "none";
    document.getElementById("stream-title-input").value = "";
    Swal.fire({ icon: "info", title: "Broadcast Ended" });
  } catch (e) {
    console.error("Failed to stop broadcast", e);
  }

  // ---------------------------------------------------------
  // 📡 NATIVE WEBRTC BROADCAST STUDIO (DJ SIDE)
  // ---------------------------------------------------------
  const socket = io("https://dj-grey.onrender.com");
  const peerConnections = {};
  const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  let localStream;

  async function startNativeBroadcast() {
    const title =
      document.getElementById("stream-title-input")?.value ||
      "DJ GREY LIVE SESSION";

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const videoElement = document.getElementById("dj-broadcast-video");
      if (videoElement) {
        videoElement.srcObject = localStream;
      }

      await fetch(`${API_URL}/admin/livestream`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: title, is_active: true }),
      });

      socket.emit("broadcaster");
      Swal.fire({
        icon: "success",
        title: "You Are LIVE! 🔴",
        text: "Streaming directly from your browser.",
      });
    } catch (err) {
      console.error("Camera Error:", err);
      Swal.fire({
        icon: "error",
        title: "Camera/Mic Error",
        text: "Please allow camera and microphone permissions to broadcast.",
      });
    }
  }

  async function stopNativeBroadcast() {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    const videoElement = document.getElementById("dj-broadcast-video");
    if (videoElement) videoElement.srcObject = null;

    await fetch(`${API_URL}/admin/livestream`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_active: false }),
    });

    for (let id in peerConnections) {
      peerConnections[id].close();
      delete peerConnections[id];
    }

    Swal.fire({ icon: "info", title: "Broadcast Ended" });
  }

  socket.on("watcher", (id) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnections[id] = peerConnection;

    if (localStream) {
      localStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, localStream));
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) socket.emit("candidate", id, event.candidate);
    };

    peerConnection
      .createOffer()
      .then((sdp) => peerConnection.setLocalDescription(sdp))
      .then(() => socket.emit("offer", id, peerConnection.localDescription));
  });

  socket.on("answer", (id, description) => {
    peerConnections[id].setRemoteDescription(description);
  });

  socket.on("candidate", (id, candidate) => {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on("disconnectPeer", (id) => {
    if (peerConnections[id]) {
      peerConnections[id].close();
      delete peerConnections[id];
    }
  });
}

// ---------------------------------------------------------
// 🚀 ROLE-BASED UI INITIALIZATION
// ---------------------------------------------------------
window.onload = () => {
  if (role === "dj") {
    // Hide all sidebar menu items EXCEPT the livestream center for DJs
    document.querySelectorAll(".sidebar-menu li").forEach((li) => {
      if (!li.innerHTML.includes("livestream-control")) {
        li.style.display = "none";
      }
    });
    // Force the DJ to start on the livestream tab
    switchAdminTab("tab-livestream-control");
  } else {
    // Full access for True Admins
    loadAdminData();
    loadUsers();
  }
};
