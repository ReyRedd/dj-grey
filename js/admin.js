const API_URL = "https://dj-grey.onrender.com/api";
const DEFAULT_ARTWORK = "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";

const token = localStorage.getItem("dj_grey_token");
const role = localStorage.getItem("dj_grey_role");
if (!token || role !== "admin") window.location.href = "/";

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
  const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  document.getElementById("theme-toggle").innerHTML = newTheme === "dark" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

document.getElementById("hamburger-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
  document.getElementById("main-content").classList.toggle("expanded");
});

document.getElementById("date-display").innerText = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

// Tab Switching Logic
function switchTab(event, tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-link").forEach((link) => link.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  event.currentTarget.classList.add("active");

  if (tabId === "users-tab") {
    document.getElementById("page-title").innerText = "Fan Management";
    document.getElementById("breadcrumb-current").innerText = "Fan Management";
    loadUsers();
  } else {
    document.getElementById("page-title").innerText = "Platform Control Center";
    document.getElementById("breadcrumb-current").innerText = "Admin Dashboard";
    loadAdminData();
  }
}

let analyticsChart;

// Dashboard Data
async function loadAdminData() {
  try {
    const analyticsRes = await fetch(`${API_URL}/admin/analytics`, { headers: getAuthHeaders() });
    const analytics = await analyticsRes.json();

    document.getElementById("total-mixes").innerText = analytics.totalMixes || 0;
    document.getElementById("total-plays").innerText = analytics.totalPlays || 0;
    document.getElementById("total-likes").innerText = analytics.totalLikes || 0;
    document.getElementById("total-downloads").innerText = analytics.totalDownloads || 0;
    document.getElementById("total-comments").innerText = analytics.totalComments || 0;

    const ctx = document.getElementById("analyticsChart").getContext("2d");
    if (analyticsChart) analyticsChart.destroy();
    analyticsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Plays", "Likes", "Downloads", "Comments"],
        datasets: [{
            label: "User Engagement",
            data: [analytics.totalPlays, analytics.totalLikes, analytics.totalDownloads, analytics.totalComments],
            backgroundColor: "rgba(0, 168, 255, 0.5)",
            borderColor: "#00a8ff",
            borderWidth: 2,
            borderRadius: 6,
          }],
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
              <td><span class="badge"><i class="fa-solid fa-heart"></i> ${mix.likes_count}</span></td>
              <td><span class="badge"><i class="fa-solid fa-download"></i> ${mix.downloads_count}</span></td>
              <td><button class="btn-delete" onclick="deleteMix(${mix.id}, '${mix.title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i> Delete</button></td>
          </tr>
      `;
    });
  } catch (error) { console.error("Error:", error); }
}

// Fan & User Management Data
async function loadUsers() {
      try {
          const res = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() });
          const users = await res.json();
          const tableBody = document.getElementById('users-table-body');
          tableBody.innerHTML = '';
          
          let pendingCount = 0;

          users.forEach(user => {
              const isPending = user.status === 'pending';
              if (isPending) pendingCount++;

              const statusClass = isPending ? 'status-pending' : 'status-approved';
              const statusText = isPending ? 'Pending' : 'Approved';

              tableBody.innerHTML += `
                  <tr>
                      <td style="font-weight: bold; color: var(--text-main);">${user.username}</td>
                      <td>${user.email}</td>
                      <td><span style="text-transform: capitalize;">${user.role}</span></td>
                      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                      <td>
                          ${isPending ? `<button class="btn-approve" onclick="approveUser(${user.id})" style="margin-right: 10px;"><i class="fa-solid fa-check"></i> Approve</button>` : ''}
                          <button class="btn-delete" onclick="deleteUser(${user.id}, '${user.username}')"><i class="fa-solid fa-user-xmark"></i> Remove</button>
                      </td>
                  </tr>
              `;
          });

          const badge = document.getElementById('pending-badge');
          if (badge) {
              if (pendingCount > 0) {
                  badge.innerText = pendingCount;
                  badge.classList.add('show');
              } else {
                  badge.classList.remove('show');
              }
          }

      } catch (error) { console.error("Error loading users:", error); }
  }

async function approveUser(id) {
  try {
    await fetch(`${API_URL}/admin/users/${id}/approve`, { method: "PUT", headers: getAuthHeaders() });
    loadUsers(); 
  } catch (err) { console.error(err); }
}

async function deleteUser(id, username) {
  const result = await Swal.fire({
    title: `Remove Fan: ${username}?`,
    text: "This will permanently delete their account, likes, and comments.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, remove fan',
    cancelButtonText: 'Cancel'
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    
    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: 'User Removed',
        timer: 2000,
        showConfirmButton: false
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
        const res = await fetch(`${API_URL}/admin/submissions`, { headers: getAuthHeaders() });
        const data = await res.json();

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No pending DJ submissions.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(s => `
            <tr>
                <td><strong>${s.dj_name}</strong></td>
                <td>${s.title}</td>
                <td><span class="badge" style="background: rgba(37, 211, 102, 0.2); color: #25d366;">$0.50 USD Paid</span></td>
                <td><a href="${s.audio_url || s.spotify_url}" target="_blank" style="color: var(--primary);">Listen Link</a></td>
                <td>
                    ${s.status === 'pending' ? `<button class="btn-approve" onclick="approveSubmission(${s.id})"><i class="fa-solid fa-check"></i> Approve & Publish</button>` : `<span style="color: var(--text-muted);">Published</span>`}
                </td>
            </tr>
        `).join("");
    } catch (e) { console.error(e); }
}

async function approveSubmission(id) {
    try {
        const res = await fetch(`${API_URL}/admin/submissions/${id}/approve`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Published!', text: 'Mix is now live in the main catalog.' });
            loadSubmissionsQueue();
        }
    } catch (e) {}
}

async function handleLivestreamLaunch(e) {
    e.preventDefault();
    const title = document.getElementById("stream-title-input").value;
    const stream_url = document.getElementById("stream-url-input").value;

    try {
        const res = await fetch(`${API_URL}/admin/livestream`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title, stream_url, is_active: true })
        });
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'You Are LIVE! 🔴', text: 'Fans can now watch your stream live.' });
        }
    } catch(e) {}
}

async function stopLivestream() {
    try {
        const res = await fetch(`${API_URL}/admin/livestream`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ is_active: false })
        });
        if (res.ok) {
            Swal.fire({ icon: 'info', title: 'Livestream Ended' });
        }
    } catch(e) {}
}

document.getElementById("add-mix-form").addEventListener("submit", async (e) => {
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
  } catch (err) { console.error(err); }
});

async function deleteMix(id, title) {
  const result = await Swal.fire({
    title: 'Erase Mix from Catalog?',
    text: `Are you sure you want to permanently delete "${title}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete mix',
    cancelButtonText: 'Cancel'
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`${API_URL}/mixes/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: 'Mix Erased',
        timer: 2000,
        showConfirmButton: false
      });
      loadAdminData();
    }
  } catch (err) {
    console.error("Error deleting mix:", err);
  }
}

window.onload = () => {
    loadAdminData();
    loadUsers(); 
};