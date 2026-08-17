const API_URL = "https://dj-grey.onrender.com/api";
const DEFAULT_ARTWORK = "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";
const token = localStorage.getItem("dj_grey_token");
const role = localStorage.getItem("dj_grey_role");

if (!token || (role !== "admin" && role !== "dj")) window.location.href = "/";

const getAuthHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

function logout() { localStorage.clear(); window.location.href = "/login.html"; }

document.getElementById("date-display").innerText = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

function switchAdminTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-link").forEach((link) => link.classList.remove("active"));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");
  const targetLink = document.querySelector(`.tab-link[onclick*="${tabId}"]`);
  if (targetLink) targetLink.classList.add("active");

  const title = document.getElementById("page-title");
  if(tabId === 'dashboard-tab') { title.innerText = "Platform Intelligence"; if(role==='admin') loadAdminData(); }
  if(tabId === 'subscriptions-tab') { title.innerText = "Subscription Hub"; if(role==='admin') loadSubscriptions(); }
  if(tabId === 'users-tab') { title.innerText = "Fan Network"; if(role==='admin') loadUsers(); }
  if(tabId === 'submissions') { title.innerText = "Mix Queue ($0.50)"; if(role==='admin') loadSubmissionsQueue(); }
  if(tabId === 'livestream-control') { title.innerText = "Live Studio"; }
}

let analyticsChart;

async function loadAdminData() {
    try {
        const analyticsRes = await fetch(`${API_URL}/admin/analytics`, { headers: getAuthHeaders() });
        const analytics = await analyticsRes.json();

        document.getElementById("total-mixes").innerText = analytics.totalMixes;
        document.getElementById("total-plays").innerText = analytics.totalPlays;
        document.getElementById("total-likes").innerText = analytics.totalLikes;
        document.getElementById("total-downloads").innerText = analytics.totalDownloads;

        const ctx = document.getElementById("analyticsChart").getContext("2d");
        if (analyticsChart) analyticsChart.destroy();
        analyticsChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Plays", "Likes", "Downloads", "Comments"],
                datasets: [{
                    data: [analytics.totalPlays, analytics.totalLikes, analytics.totalDownloads, analytics.totalComments],
                    backgroundColor: ["#00a8ff", "#bd00ff", "#00ff88", "#ffb800"],
                    borderWidth: 0
                }]
            },
            options: { cutout: '75%', plugins: { legend: { position: 'bottom', labels:{color:'#fff'} } } }
        });

        const res = await fetch(`${API_URL}/mixes`);
        const mixes = await res.json();
        const tableBody = document.getElementById("admin-table-body");
        tableBody.innerHTML = mixes.map(mix => `
            <tr>
                <td style="font-weight: bold;">${mix.title}</td>
                <td><span style="color:#ff4d4d;"><i class="fa-solid fa-heart"></i> ${mix.likes_count}</span></td>
                <td><span style="color:var(--primary);"><i class="fa-solid fa-download"></i> ${mix.downloads_count}</span></td>
                <td><span class="sub-status-active">Live</span></td>
                <td><button class="btn-action" style="background:var(--danger); padding: 5px 10px;" onclick="deleteMix(${mix.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join("");
    } catch (e) {}
}

async function loadSubscriptions() {
    try {
        const res = await fetch(`${API_URL}/admin/subscriptions`, { headers: getAuthHeaders() });
        const subs = await res.json();
        
        let active=0, expiring=0, expired=0;
        const tbody = document.getElementById("subs-table-body");
        
        tbody.innerHTML = subs.map(sub => {
            if(sub.sub_status === 'active') active++;
            if(sub.sub_status === 'expiring') expiring++;
            if(sub.sub_status === 'expired') expired++;
            
            const dateStr = new Date(sub.sub_end_date).toLocaleDateString();
            return `
            <tr>
                <td><strong>${sub.username}</strong></td>
                <td>${sub.email}</td>
                <td><span class="sub-status-${sub.sub_status}">${sub.sub_status.toUpperCase()}</span></td>
                <td>${dateStr}</td>
                <td><button class="btn-action" style="padding: 5px 10px;" onclick="manualRenew(${sub.id})">Force Renew</button></td>
            </tr>
        `}).join("");

        document.getElementById("sub-active").innerText = active;
        document.getElementById("sub-expiring").innerText = expiring;
        document.getElementById("sub-expired").innerText = expired;
    } catch(e){}
}

async function runSubscriptionSystemCheck() {
    const btn = document.querySelector(".btn-run-check");
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Ledger & Emails...';
    try {
        const res = await fetch(`${API_URL}/admin/subscriptions/engine`, { method: "POST", headers: getAuthHeaders() });
        const data = await res.json();
        Swal.fire({ icon: 'success', title: 'System Sweep Complete', text: `Hid ${data.expired_processed} expired accounts. Emailed ${data.expiring_processed} warnings.`, background: '#14141c', color: '#fff' });
        loadSubscriptions();
    } catch(e) {}
    btn.innerHTML = '<i class="fa-solid fa-radar"></i> Run Subscription & Email Engine';
}

// Ensure the rest of your original functions (loadUsers, loadSubmissionsQueue, approveSubmission, startNativeBroadcast, etc) remain here exactly as they were in your previous working file.
window.onload = () => {
    if (role === "dj") {
        document.querySelectorAll(".sidebar-menu li").forEach(li => { if (!li.innerHTML.includes("livestream-control")) li.style.display = "none"; });
        switchAdminTab("livestream-control");
    } else {
        switchAdminTab("dashboard-tab");
    }
};