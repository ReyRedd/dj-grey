let currentMixIdForComments = null;
let currentSortOrder = 'newest'; // Tracks current sort state

// --- RICH CUSTOM SORT MENU LOGIC ---
function toggleSortMenu() {
    document.getElementById('custom-sort-dropdown').classList.toggle('open');
}

function selectSort(order, labelText) {
    currentSortOrder = order;
    
    // Update the button text to show current selection
    document.getElementById('current-sort-label').innerText = labelText;

    // Update active UI state in the dropdown
    document.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`sort-opt-${order}`).classList.add('active');

    // Close the menu
    document.getElementById('custom-sort-dropdown').classList.remove('open');

    // Re-fetch comments with new sort order
    if (currentMixIdForComments) {
        fetchComments(currentMixIdForComments);
    }
}

// Close the sort menu if the user clicks anywhere outside of it
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('custom-sort-dropdown');
    if (dropdown && dropdown.classList.contains('open')) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    }
});


// --- COMMENTS SIDEBAR LOGIC ---
function openCommentsSidebar(mixId, mixTitle) {
  currentMixIdForComments = mixId;
  document.getElementById("sidebar-mix-title").innerHTML = `<i class="fa-solid fa-comments"></i> ${mixTitle}`;
  document.getElementById("comments-sidebar").classList.add("open");
  fetchComments(mixId);
}

function closeCommentsSidebar() {
  document.getElementById("comments-sidebar").classList.remove("open");
  currentMixIdForComments = null;
}

async function fetchComments(mixId) {
  if (!mixId) return;
  const listEl = document.getElementById("sidebar-comments-list");

  try {
    const res = await fetch(`${API_URL}/mixes/${mixId}/comments`);
    const comments = await res.json();

    if (comments.length === 0) {
      listEl.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted);">No comments yet. Be the first!</p>`;
      return;
    }

    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);

    // Apply Sorting Logic based on Custom Menu
    if (currentSortOrder === "top") {
      topLevel.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else {
      topLevel.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    let html = "";
    topLevel.forEach((c) => {
      html += renderCommentHtml(c, false);
      const childReplies = replies.filter((r) => r.parent_id === c.id);

      if (childReplies.length > 0) {
        html += `
          <div style="margin-left: 40px; margin-top: -5px; margin-bottom: 15px;">
            <button class="reply-accordion-btn" onclick="toggleRepliesAccordion(${c.id})">
              <i class="fa-solid fa-caret-down" id="reply-caret-${c.id}"></i> View ${childReplies.length} ${childReplies.length === 1 ? 'reply' : 'replies'}
            </button>
            <div id="replies-container-${c.id}" style="display: none; margin-top: 12px;">
        `;
        childReplies.forEach((r) => {
          html += renderCommentHtml(r, true);
        });
        html += `
            </div>
          </div>
        `;
      }
    });
    listEl.innerHTML = html;
  } catch (err) {
    listEl.innerHTML = `<p style="font-size: 0.85rem; color: #ff4d4d;">Failed to load comments.</p>`;
  }
}

function toggleRepliesAccordion(commentId) {
  const container = document.getElementById(`replies-container-${commentId}`);
  const caret = document.getElementById(`reply-caret-${commentId}`);
  if (container.style.display === "none") {
    container.style.display = "block";
    caret.className = "fa-solid fa-caret-up";
  } else {
    container.style.display = "none";
    caret.className = "fa-solid fa-caret-down";
  }
}

function renderCommentHtml(c, isReply) {
  const timeFormatted = new Date(c.created_at).toLocaleDateString();
  const canDelete = username === c.username || role === "admin";

  return `
  <div class="comment-card ${isReply ? "reply" : ""}" id="comment-${c.id}">
      <div class="comment-header">
          <span class="comment-author">${c.username}</span>
          <span>${timeFormatted}</span>
      </div>
      <div class="comment-body">${c.content}</div>
      <div class="comment-actions">
          <span class="comment-action-btn" onclick="likeComment(${c.id}, ${c.mix_id})">
              <i class="fa-solid fa-thumbs-up"></i> <span id="comment-likes-${c.id}">${c.likes_count}</span>
          </span>
          ${!isReply ? `<span class="comment-action-btn" onclick="toggleReplyBox(${c.id}, '${c.username}')"><i class="fa-solid fa-reply"></i> Reply</span>` : ""}
          ${canDelete ? `<span class="comment-action-btn" onclick="deleteComment(${c.id})" style="color: #ff4d4d; margin-left: auto;"><i class="fa-solid fa-trash"></i></span>` : ""}
      </div>
      <div class="comment-input-box reply-form-wrapper" id="reply-box-${c.id}" style="display:none;">
          <input type="text" id="reply-input-${c.id}" placeholder="Reply to ${c.username}...">
          <button onclick="postSidebarComment(${c.id})">Post</button>
      </div>
  </div>`;
}

function toggleReplyBox(commentId, replyToUsername) {
  const box = document.getElementById(`reply-box-${commentId}`);
  
  if (box.style.display === "none" || box.style.display === "") {
      box.style.display = "flex";
      const input = document.getElementById(`reply-input-${commentId}`);
      input.value = `@${replyToUsername} `;
      input.focus();
  } else {
      box.style.display = "none";
  }
}

async function postSidebarComment(parentId = null) {
  if (!token) return alert("Please log in to post a comment.");
  if (!currentMixIdForComments) return;

  const inputEl = parentId
    ? document.getElementById(`reply-input-${parentId}`)
    : document.getElementById("global-comment-input");
  const content = inputEl.value;
  if (!content.trim()) return;

  try {
    const res = await fetch(
      `${API_URL}/mixes/${currentMixIdForComments}/comments`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ content, parent_id: parentId }),
      },
    );

    if (res.ok) {
      inputEl.value = "";
      await fetchComments(currentMixIdForComments);
    } else {
      const data = await res.json();
      alert(data.error || "Failed to post comment.");
    }
  } catch (err) {
    console.error("Error posting comment:", err);
  }
}

async function deleteComment(commentId) {
  if (!confirm("Are you sure you want to delete this comment?")) return;
  try {
    const res = await fetch(`${API_URL}/comments/${commentId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) fetchComments(currentMixIdForComments);
  } catch (err) {
    console.error("Error deleting comment:", err);
  }
}

async function likeComment(commentId, mixId) {
  if (!token) return alert("Please log in to like comments.");
  try {
    const res = await fetch(`${API_URL}/comments/${commentId}/like`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById(`comment-likes-${commentId}`).innerText =
        data.likes_count;
    }
  } catch (err) {
    console.error("Error liking comment:", err);
  }
}