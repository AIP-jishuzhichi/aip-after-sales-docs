/* AIP 售后文件库 —— 前端逻辑（零依赖） */
(function () {
  "use strict";

  var PALETTE = [
    "#2f6df6", "#0d9488", "#d97706", "#7c3aed", "#db2777",
    "#059669", "#0284c7", "#b45309", "#4f46e5", "#65a30d"
  ];

  var el = {
    siteTitle: document.getElementById("siteTitle"),
    siteDesc: document.getElementById("siteDesc"),
    repoLink: document.getElementById("repoLink"),
    search: document.getElementById("search"),
    catList: document.getElementById("catList"),
    viewTitle: document.getElementById("viewTitle"),
    viewMeta: document.getElementById("viewMeta"),
    sort: document.getElementById("sort"),
    grid: document.getElementById("docGrid"),
    empty: document.getElementById("emptyState"),
    emptyTitle: document.getElementById("emptyTitle"),
    emptyDesc: document.getElementById("emptyDesc"),
    scrim: document.getElementById("scrim"),
    drawer: document.getElementById("drawer"),
    drawerName: document.getElementById("drawerName"),
    drawerMeta: document.getElementById("drawerMeta"),
    pdfFrame: document.getElementById("pdfFrame"),
    dlBtn: document.getElementById("dlBtn"),
    openBtn: document.getElementById("openBtn"),
    copyBtn: document.getElementById("copyBtn"),
    closeDrawer: document.getElementById("closeDrawer"),
    helpBtn: document.getElementById("helpBtn"),
    helpModal: document.getElementById("helpModal"),
    closeHelp: document.getElementById("closeHelp"),
    toast: document.getElementById("toast")
  };

  var state = {
    docs: [],
    categories: [],
    site: {},
    stats: {},
    query: "",
    cat: "all",
    sort: "updated",
    view: "grid",
    current: null
  };

  /* ---------- 工具 ---------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function encodePath(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 KB";
    var kb = bytes / 1024;
    if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : Math.round(kb)) + " KB";
    var mb = kb / 1024;
    return (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + " MB";
  }

  function formatDate(iso) {
    if (!iso) return "网页上传";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var diff = Date.now() - d.getTime();
    var min = 60000, hour = 3600000, day = 86400000;
    if (diff < min) return "刚刚";
    if (diff < hour) return Math.floor(diff / min) + " 分钟前";
    if (diff < day) return Math.floor(diff / hour) + " 小时前";
    if (diff < day * 30) return Math.floor(diff / day) + " 天前";
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function catColor(id) {
    var idx = state.categories.findIndex(function (c) { return c.id === id; });
    return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length];
  }

  var toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 2000);
  }

  /* ---------- 数据 ---------- */
  function loadData() {
    return fetch("索引数据/documents.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () {
        if (window.__DOCUMENTS__) return window.__DOCUMENTS__;
        throw new Error("索引加载失败");
      });
  }

  function applyData(data) {
    state.docs = data.documents || [];
    state.categories = (data.categories || []).filter(function (c) { return c.count > 0; });
    state.site = data.site || {};
    state.stats = data.stats || {};

    var title = state.site.title || "PDF 文件库";
    document.title = title;
    el.siteTitle.textContent = title;
    el.siteDesc.textContent = state.site.description || "按分类归档，随时可查";
    if (state.site.repo) {
      el.repoLink.href = state.site.repo;
      el.repoLink.hidden = false;
    }
  }

  /* ---------- 兜底：用 GitHub 接口补全未进索引的文件（网页上传后立即可见） ---------- */
  function repoSlug() {
    var m = String(state.site.repo || "").match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null;
  }

  function rebuildCategories() {
    var known = {};
    state.categories.forEach(function (c) { known[c.id] = c.name; });

    var map = {};
    state.docs.forEach(function (d) {
      var id = d.categoryId || "";
      if (!map[id]) map[id] = { id: id, name: d.category || known[id] || "未分类", count: 0, bytes: 0 };
      map[id].count += 1;
      map[id].bytes += d.bytes || 0;
    });

    var ordered = [];
    state.categories.forEach(function (c) {
      if (map[c.id]) { ordered.push(map[c.id]); delete map[c.id]; }
    });
    Object.keys(map).forEach(function (k) { ordered.push(map[k]); });
    state.categories = ordered.filter(function (c) { return c.count > 0; });
    state.stats.documents = state.docs.length;
    state.stats.categories = state.categories.length;
    state.stats.bytes = state.docs.reduce(function (s, d) { return s + (d.bytes || 0); }, 0);
  }

  function applyTree(entries) {
    if (!entries || !entries.length) return;
    var seen = {};
    state.docs.forEach(function (d) { seen[d.file] = true; });

    var added = 0;
    entries.forEach(function (node) {
      if (node.type !== "blob") return;
      var path = node.path || "";
      if (path.indexOf("售后资料/") !== 0 || !/\.pdf$/i.test(path)) return;
      if (seen[path]) return;

      var seg = path.slice("售后资料/".length).split("/");
      var cid = seg.length > 1 ? seg[0] : "";
      var name = cid ? (cid.replace(/^\d+[\s._-]*/, "") || cid) : "未分类";

      state.docs.push({
        id: path,
        file: path,
        title: seg[seg.length - 1].replace(/\.pdf$/i, ""),
        categoryId: cid,
        category: name,
        bytes: node.size || 0,
        updated: ""
      });
      added += 1;
    });

    if (!added) return;
    rebuildCategories();
    renderSidebar();
    renderDocs();
  }

  function mergeFromGitHub() {
    var slug = repoSlug();
    if (!slug) return;
    var url = "https://api.github.com/repos/" + slug.owner + "/" + slug.repo + "/git/trees/HEAD?recursive=1";
    fetch(url, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) { applyTree(data.tree); })
      .catch(function () { /* 接口不可用时保持已加载的索引结果 */ });
  }

  /* ---------- 渲染 ---------- */
  function renderSidebar() {
    var total = state.stats.documents || 0;
    var html = '<li class="cat-item"><button class="cat-btn' + (state.cat === "all" ? " active" : "") +
      '" data-cat="all"><span class="cat-dot" style="color:' + PALETTE[0] + '"></span>' +
      '<span class="cat-name">全部文档</span><span class="cat-count">' + total + "</span></button></li>";

    state.categories.forEach(function (c) {
      html += '<li class="cat-item"><button class="cat-btn' + (state.cat === c.id ? " active" : "") +
        '" data-cat="' + escapeHtml(c.id) + '">' +
        '<span class="cat-dot" style="color:' + catColor(c.id) + '"></span>' +
        '<span class="cat-name">' + escapeHtml(c.name) + "</span>" +
        '<span class="cat-count">' + c.count + "</span></button></li>";
    });
    el.catList.innerHTML = html;
  }

  function highlight(text, query) {
    var safe = escapeHtml(text);
    if (!query) return safe;
    var q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return safe.replace(new RegExp("(" + q + ")", "gi"), "<mark>$1</mark>");
    } catch (e) {
      return safe;
    }
  }

  function filteredDocs() {
    var q = state.query.trim().toLowerCase();
    var list = state.docs.filter(function (d) {
      if (state.cat !== "all" && d.categoryId !== state.cat) return false;
      if (!q) return true;
      return (d.title + " " + d.category).toLowerCase().indexOf(q) >= 0;
    });

    if (state.sort === "title") {
      list.sort(function (a, b) { return a.title.localeCompare(b.title, "zh-CN"); });
    } else if (state.sort === "size") {
      list.sort(function (a, b) { return b.bytes - a.bytes; });
    } else {
      list.sort(function (a, b) {
        return String(b.updated || "9999").localeCompare(String(a.updated || "9999"));
      });
    }
    return list;
  }

  function cardHtml(d) {
    var color = catColor(d.categoryId);
    return '<article class="doc-card" tabindex="0" role="button" data-file="' + escapeHtml(d.file) + '">' +
      '<div class="card-top">' +
        '<span class="pdf-badge" aria-hidden="true"><span>PDF</span></span>' +
      "</div>" +
      '<div class="card-body">' +
        '<h3 class="card-title">' + highlight(d.title, state.query) + "</h3>" +
      "</div>" +
      '<div class="card-meta">' +
        '<span class="cat-tag" style="color:' + color + '"><i></i>' + escapeHtml(d.category) + "</span>" +
        '<span class="dot"></span>' +
        "<span>" + formatBytes(d.bytes) + "</span>" +
        '<span class="dot"></span>' +
        "<span>" + formatDate(d.updated) + "</span>" +
      "</div>" +
    "</article>";
  }

  function renderDocs() {
    var list = filteredDocs();
    el.grid.className = "doc-grid" + (state.view === "list" ? " list" : "");

    if (!list.length) {
      el.grid.innerHTML = "";
      el.empty.hidden = false;
      if (state.query) {
        el.emptyTitle.textContent = "没有匹配的文档";
        el.emptyDesc.textContent = "换个关键词试试，或者清空搜索看全部 " + state.docs.length + " 份资料。";
      } else if (state.cat !== "all") {
        var cat = state.categories.find(function (c) { return c.id === state.cat; });
        el.emptyTitle.textContent = (cat ? cat.name : "该分类") + " 还没有文件";
        el.emptyDesc.innerHTML = "把 PDF 放进 <code>售后资料/" + escapeHtml(state.cat) + "/</code> 文件夹，再重新生成一次文件清单。";
      } else {
        el.emptyTitle.textContent = "仓库还是空的";
        el.emptyDesc.innerHTML = "把 PDF 放进 <code>售后资料/</code> 下任意分类文件夹，网页就会自动列出它们。";
      }
    } else {
      el.empty.hidden = true;
      el.grid.innerHTML = list.map(cardHtml).join("");
    }

    var cat = state.categories.find(function (c) { return c.id === state.cat; });
    el.viewTitle.textContent = state.cat === "all" ? "全部文档" : (cat ? cat.name : "未分类");
    var bytes = list.reduce(function (sum, d) { return sum + d.bytes; }, 0);
    el.viewMeta.innerHTML = "共 <b>" + list.length + "</b> 份文档 · <b>" + formatBytes(bytes) +
      "</b>" + (state.query ? ' · 关键词 “<b>' + escapeHtml(state.query) + "</b>”" : "");
  }

  /* ---------- 路由 ---------- */
  function syncHash() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "d" && parts[1]) openDoc(decodeURIComponent(parts.slice(1).join("/")), false);
    else closeDrawer(false);
  }

  function setHash(value) {
    if (value) {
      history.replaceState(null, "", "#/d/" + encodeURIComponent(value));
    } else {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  /* ---------- 抽屉 ---------- */
  function openDoc(file, updateHash) {
    var doc = state.docs.find(function (d) { return d.file === file; });
    if (!doc) return;
    state.current = doc;
    var url = encodePath(doc.file);

    el.drawerName.textContent = doc.title;
    el.drawerMeta.textContent = doc.category + " · " + formatBytes(doc.bytes) + " · " + formatDate(doc.updated);
    el.pdfFrame.src = url + "#view=FitH";
    el.dlBtn.href = url;
    el.dlBtn.setAttribute("download", doc.title + ".pdf");
    el.openBtn.href = url;

    el.drawer.hidden = false;
    el.scrim.hidden = false;
    document.body.style.overflow = "hidden";
    if (updateHash !== false) setHash(doc.file);
  }

  function closeDrawer(updateHash) {
    state.current = null;
    el.drawer.hidden = true;
    el.scrim.hidden = true;
    el.pdfFrame.src = "about:blank";
    document.body.style.overflow = "";
    if (updateHash !== false) setHash("");
  }

  /* ---------- 事件 ---------- */
  function bind() {
    el.search.addEventListener("input", function () {
      state.query = el.search.value;
      renderDocs();
    });

    el.catList.addEventListener("click", function (e) {
      var btn = e.target.closest(".cat-btn");
      if (!btn) return;
      state.cat = btn.dataset.cat;
      renderSidebar();
      renderDocs();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    el.sort.addEventListener("change", function () {
      state.sort = el.sort.value;
      renderDocs();
    });

    document.querySelectorAll(".view-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.view = btn.dataset.view;
        document.querySelectorAll(".view-toggle button").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        renderDocs();
      });
    });

    el.grid.addEventListener("click", function (e) {
      var card = e.target.closest(".doc-card");
      if (card) openDoc(card.dataset.file);
    });

    el.grid.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var card = e.target.closest(".doc-card");
      if (!card) return;
      e.preventDefault();
      openDoc(card.dataset.file);
    });

    el.closeDrawer.addEventListener("click", function () { closeDrawer(); });
    el.scrim.addEventListener("click", function () { closeDrawer(); });

    el.copyBtn.addEventListener("click", function () {
      if (!state.current) return;
      var link = location.origin + location.pathname + "#/d/" + encodeURIComponent(state.current.file);
      var done = function () { toast("文档链接已复制"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (err) { toast("复制失败，请手动复制地址栏"); }
        document.body.removeChild(ta);
      }
    });

    el.helpBtn.addEventListener("click", function () { el.helpModal.hidden = false; });
    el.closeHelp.addEventListener("click", function () { el.helpModal.hidden = true; });
    el.helpModal.addEventListener("click", function (e) {
      if (e.target === el.helpModal) el.helpModal.hidden = true;
    });

    document.getElementById("brandLink").addEventListener("click", function (e) {
      e.preventDefault();
      state.cat = "all";
      state.query = "";
      el.search.value = "";
      renderSidebar();
      renderDocs();
    });

    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        el.search.focus();
      } else if (e.key === "Escape") {
        if (!el.helpModal.hidden) el.helpModal.hidden = true;
        else if (!el.drawer.hidden) closeDrawer();
        else if (typing) { el.search.value = ""; state.query = ""; renderDocs(); el.search.blur(); }
      }
    });

    window.addEventListener("hashchange", syncHash);
  }

  /* ---------- 启动 ---------- */
  loadData()
    .then(function (data) {
      applyData(data);
      renderSidebar();
      renderDocs();
      bind();
      syncHash();
      mergeFromGitHub();
    })
    .catch(function (err) {
      el.empty.hidden = false;
      el.emptyTitle.textContent = "索引没有加载成功";
      el.emptyDesc.innerHTML = "请确认 <code>索引数据/documents.json</code> 存在；如果刚添加过文件，运行 " +
        "<code>②更新文件清单.cmd</code> 重新生成清单。" +
        '<br><span style="color:#b0b7c3">' + escapeHtml(err.message) + "</span>";
    });
})();
