// Klipnux Studio — Apple-Crafted Frontend Controller
document.addEventListener("DOMContentLoaded", () => {
  const refreshIcons = () => {
    if (window.lucide) window.lucide.createIcons();
  };
  refreshIcons();

  let API_BASE = window.location.protocol.startsWith("http") ? "" : "http://127.0.0.1:8000";

  async function resolveWorkingApiBase() {
    const candidates = window.location.protocol.startsWith("http")
      ? ["", API_BASE, "http://127.0.0.1:8000", "http://localhost:8000"]
      : ["http://127.0.0.1:8000", "http://localhost:8000", ""];
    for (const base of candidates) {
      try {
        const res = await fetch(`${base}/api/health`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.service) {
            API_BASE = base;
            return base;
          }
        }
      } catch (_) {}
    }
    return API_BASE;
  }

  // Application State
  let currentVideoUrl = "";
  let currentVideoInfo = null;
  let currentClips = [];
  let filteredClips = [];
  let renderedClipsMap = {}; // { [clipId]: { ...serverClipData, signature, blob_url } }
  let selectedClipIds = new Set();
  let activeClip = null;
  let activeCategory = "all";
  let sortMode = "timeline";
  let totalVideoDuration = 0;
  let isEditWordsMode = false;
  let activeJobCancelled = false;
  let activePollTimer = null;
  let elapsedTimerInterval = null;
  let renderTimerInterval = null;
  let currentWizardStep = 1;
  let activeSourceMode = "youtube"; // "youtube" | "upload"
  const speedSteps = [1, 1.25, 1.5, 2];
  let speedIdx = 0;

  // View Containers
  const launcherView = document.getElementById("launcherView");
  const processingSection = document.getElementById("processingSection");
  const resultsSection = document.getElementById("resultsSection");
  const headerProjectMeta = document.getElementById("headerProjectMeta");
  const headerSourceBadge = document.getElementById("headerSourceBadge");
  const headerVideoTitle = document.getElementById("headerVideoTitle");
  const btnLogoHome = document.getElementById("btnLogoHome");
  const btnNewProject = document.getElementById("btnNewProject");

  // Wizard Step Controls
  const wizardStep1 = document.getElementById("wizardStep1");
  const wizardStep2 = document.getElementById("wizardStep2");
  const wizPill1 = document.getElementById("wizPill1");
  const wizPill2 = document.getElementById("wizPill2");
  const wizPill3 = document.getElementById("wizPill3");
  const btnWizardNext = document.getElementById("btnWizardNext");
  const btnWizardBack = document.getElementById("btnWizardBack");
  const step2SourceSummary = document.getElementById("step2SourceSummary");
  const urlStatusHint = document.getElementById("urlStatusHint");
  const clipsCountPills = document.querySelectorAll("#clipsCountPills .kn-count-pill");

  // Mobile Workspace Switcher
  const mobileTabBtns = document.querySelectorAll(".mobile-tab-btn");
  const paneClips = document.getElementById("paneClips");
  const panePreview = document.getElementById("panePreview");
  const paneInspector = document.getElementById("paneInspector");

  // Header & Settings Controls
  const btnApiSettings = document.getElementById("btnApiSettings");
  const apiKeyDisplay = document.getElementById("apiKeyDisplay");
  const btnClearStorage = document.getElementById("btnClearStorage");
  const storageStatsLabel = document.getElementById("storageStatsLabel");
  const btnDownloadAllTop = document.getElementById("btnDownloadAllTop");
  const settingsModal = document.getElementById("settingsModal");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const inputSettingsApiKey = document.getElementById("inputSettingsApiKey");
  const inputSettingsCookies = document.getElementById("inputSettingsCookies");
  const cookiesStatusHint = document.getElementById("cookiesStatusHint");

  // Launcher Controls
  const tabSourceYoutube = document.getElementById("tabSourceYoutube");
  const tabSourceUpload = document.getElementById("tabSourceUpload");
  const youtubeSourcePanel = document.getElementById("youtubeSourcePanel");
  const uploadSourcePanel = document.getElementById("uploadSourcePanel");
  const fileUploadInput = document.getElementById("fileUploadInput");
  const dropZone = document.getElementById("dropZone");
  const uploadLabelText = document.getElementById("uploadLabelText");

  const clipForm = document.getElementById("clipForm");
  const urlInput = document.getElementById("urlInput");
  const btnPaste = document.getElementById("btnPaste");
  const btnQuickDemo = document.getElementById("btnQuickDemo");
  const sampleChips = document.querySelectorAll(".sample-chip");
  const clipsCountSelect = document.getElementById("clipsCountSelect");
  const durationSelect = document.getElementById("durationSelect");
  const layoutSelect = document.getElementById("layoutSelect");
  const captionSelect = document.getElementById("captionSelect");
  const chkHookBanner = document.getElementById("chkHookBanner");
  const launcherCaptionSwatches = document.querySelectorAll("#launcherCaptionSwatches .caption-swatch");

  // Existing Disk Library
  const existingLibrarySection = document.getElementById("existingLibrarySection");
  const libraryCountBadge = document.getElementById("libraryCountBadge");
  const libraryGrid = document.getElementById("libraryGrid");

  // Processing View Controls
  const processStatusTitle = document.getElementById("processStatusTitle");
  const processStatusDesc = document.getElementById("processStatusDesc");
  const processElapsedTimer = document.getElementById("processElapsedTimer");
  const progressBar = document.getElementById("progressBar");
  const btnCancelAnalysis = document.getElementById("btnCancelAnalysis");

  // Workspace Controls
  const videoThumb = document.getElementById("videoThumb");
  const videoTitle = document.getElementById("videoTitle");
  const videoChannel = document.getElementById("videoChannel");
  const timelineDurationBadge = document.getElementById("timelineDurationBadge");
  const clipsFoundBadge = document.getElementById("clipsFoundBadge");
  const timelineTrack = document.getElementById("timelineTrack");
  const categoryFilterBar = document.getElementById("categoryFilterBar");
  const clipCardsList = document.getElementById("clipCardsList");
  const countAll = document.getElementById("countAll");
  const chkSelectAllClips = document.getElementById("chkSelectAllClips");
  const sortClipsSelect = document.getElementById("sortClipsSelect");
  const btnBatchRenderAll = document.getElementById("btnBatchRenderAll");
  const batchBtnLabel = document.getElementById("batchBtnLabel");
  const btnDownloadZip = document.getElementById("btnDownloadZip");

  // Center Stage Controls
  const aspectBtns = document.querySelectorAll(".aspect-btn");
  const workspaceCaptionSelect = document.getElementById("workspaceCaptionSelect");
  const btnPlaybackSpeed = document.getElementById("btnPlaybackSpeed");
  const deviceFrame = document.getElementById("deviceFrame");
  const previewVideo = document.getElementById("previewVideo");
  const sourceYoutubeFrame = document.getElementById("sourceYoutubeFrame");
  const btnToggleSound = document.getElementById("btnToggleSound");
  const soundIcon = document.getElementById("soundIcon");
  const playerPlaceholder = document.getElementById("playerPlaceholder");
  const stageCategoryPill = document.getElementById("stageCategoryPill");
  const liveBannerPreview = document.getElementById("liveBannerPreview");
  const stageTimestamp = document.getElementById("stageTimestamp");
  const liveCaptionPreview = document.getElementById("liveCaptionPreview");
  const renderStatusHint = document.getElementById("renderStatusHint");
  const btnStageRender = document.getElementById("btnStageRender");
  const stageRenderingOverlay = document.getElementById("stageRenderingOverlay");
  const stageRenderTimer = document.getElementById("stageRenderTimer");
  const stageErrorOverlay = document.getElementById("stageErrorOverlay");
  const stageErrorMessage = document.getElementById("stageErrorMessage");
  const btnRetryStageCut = document.getElementById("btnRetryStageCut");
  const btnStageSwitchUpload = document.getElementById("btnStageSwitchUpload");
  const btnStageOpenCookies = document.getElementById("btnStageOpenCookies");
  const waveformContainer = document.getElementById("waveformContainer");
  const waveformTimecode = document.getElementById("waveformTimecode");
  const btnDownloadClip = document.getElementById("btnDownloadClip");

  // Right Inspector Controls
  const inputHookTitle = document.getElementById("inputHookTitle");
  const chkWorkspaceBanner = document.getElementById("chkWorkspaceBanner");
  const trimmerDurationBadge = document.getElementById("trimmerDurationBadge");
  const inputStartTime = document.getElementById("inputStartTime");
  const inputEndTime = document.getElementById("inputEndTime");
  const btnStartMinus5 = document.getElementById("btnStartMinus5");
  const btnStartPlus5 = document.getElementById("btnStartPlus5");
  const btnEndMinus5 = document.getElementById("btnEndMinus5");
  const btnEndPlus5 = document.getElementById("btnEndPlus5");
  const extendButtons = document.querySelectorAll(".btn-extend-clip");
  const btnRenderCustomCut = document.getElementById("btnRenderCustomCut");
  const inspectorScoreBadge = document.getElementById("inspectorScoreBadge");
  const metricHookVal = document.getElementById("metricHookVal");
  const metricRetentionVal = document.getElementById("metricRetentionVal");
  const metricEnergyVal = document.getElementById("metricEnergyVal");
  const inspectorReasoning = document.getElementById("inspectorReasoning");
  const btnToggleEditWords = document.getElementById("btnToggleEditWords");
  const transcriptHelpHint = document.getElementById("transcriptHelpHint");
  const inspectorTranscriptBox = document.getElementById("inspectorTranscriptBox");
  const btnCopyMeta = document.getElementById("btnCopyMeta");
  const seoPreviewText = document.getElementById("seoPreviewText");

  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");
  const toastBox = document.getElementById("toastBox");
  let toastTimeout = null;

  // =========================================================
  // HELPERS, WIZARD NAVIGATION & VIEW ROUTER
  // =========================================================
  function showToast(message, isError = false) {
    toastMessage.textContent = message;
    if (isError) {
      toastBox.style.borderColor = "rgba(220, 38, 38, 0.35)";
      toastIcon.setAttribute("data-lucide", "alert-circle");
      toastIcon.style.color = "var(--danger)";
    } else {
      toastBox.style.borderColor = "rgba(0, 0, 0, 0.08)";
      toastIcon.setAttribute("data-lucide", "check-circle");
      toastIcon.style.color = "var(--success)";
    }
    refreshIcons();
    toast.classList.remove("toast-hidden");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add("toast-hidden");
    }, 3600);
  }

  function formatTime(seconds) {
    const sTotal = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(sTotal / 60);
    const s = sTotal % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const cleaned = String(timeStr).trim();
    if (!cleaned.includes(":")) return Math.max(0, parseFloat(cleaned) || 0);
    const parts = cleaned.split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const s = url.trim();
    if (s.startsWith("demo://") || s.startsWith("local://")) return s;
    const m = s.match(/(?:v=|youtu\.be\/|youtube\.com\/(?:shorts|live|embed)\/)([0-9A-Za-z_-]{11})/);
    return m ? m[1] : null;
  }

  function validateSourceInline() {
    if (!urlInput || !urlStatusHint) return true;
    const val = urlInput.value.trim();
    if (!val) {
      urlStatusHint.textContent = "Paste any YouTube URL or try Instant Studio Demo";
      urlStatusHint.style.color = "var(--text-secondary)";
      return false;
    }
    if (extractYouTubeId(val)) {
      urlStatusHint.textContent = val.startsWith("local://") ? "Uploaded video ready" : "Valid video link ready";
      urlStatusHint.style.color = "var(--success)";
      return true;
    }
    urlStatusHint.textContent = "Enter a valid youtube.com or youtu.be URL";
    urlStatusHint.style.color = "var(--warning)";
    return false;
  }

  function setWizardStep(step, direction = "next") {
    currentWizardStep = step;
    if (!wizardStep1 || !wizardStep2) return;

    wizardStep1.classList.remove("animate-step-next", "animate-step-back");
    wizardStep2.classList.remove("animate-step-next", "animate-step-back");

    if (step === 1) {
      wizardStep1.classList.remove("hidden");
      wizardStep2.classList.add("hidden");
      wizardStep1.classList.add(direction === "back" ? "animate-step-back" : "animate-step-next");
      if (wizPill1) wizPill1.className = "kn-wiz-step active";
      if (wizPill2) wizPill2.className = "kn-wiz-step";
      if (wizPill3) wizPill3.className = "kn-wiz-step";
    } else if (step === 2) {
      const val = urlInput ? urlInput.value.trim() : "";
      if (step2SourceSummary) {
        step2SourceSummary.textContent = val.startsWith("local://")
          ? `Uploaded file: ${val.replace("local://", "")}`
          : val;
      }
      wizardStep1.classList.add("hidden");
      wizardStep2.classList.remove("hidden");
      wizardStep2.classList.add("animate-step-next");
      if (wizPill1) wizPill1.className = "kn-wiz-step done";
      if (wizPill2) wizPill2.className = "kn-wiz-step active";
      if (wizPill3) wizPill3.className = "kn-wiz-step";
    }
    refreshIcons();
  }

  function showView(viewName) {
    launcherView.classList.add("hidden");
    processingSection.classList.add("hidden");
    resultsSection.classList.add("hidden");

    if (viewName === "launcher") {
      launcherView.classList.remove("hidden");
      headerProjectMeta.classList.add("hidden");
      btnNewProject.classList.add("hidden");
      setWizardStep(1, "back");
      refreshStorageAndLibrary();
    } else if (viewName === "processing") {
      processingSection.classList.remove("hidden");
      headerProjectMeta.classList.add("hidden");
      btnNewProject.classList.add("hidden");
      if (wizPill2) wizPill2.className = "kn-wiz-step done";
      if (wizPill3) wizPill3.className = "kn-wiz-step active";
    } else if (viewName === "workspace") {
      resultsSection.classList.remove("hidden");
      headerProjectMeta.classList.remove("hidden");
      headerProjectMeta.style.display = "flex";
      btnNewProject.classList.remove("hidden");
      setMobilePane("preview");
    }
    refreshIcons();
  }

  function setMobilePane(pane) {
    mobileTabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.pane === pane);
    });
    if (paneClips) paneClips.classList.toggle("mobile-pane-hidden", pane !== "clips");
    if (panePreview) panePreview.classList.toggle("mobile-pane-hidden", pane !== "preview");
    if (paneInspector) paneInspector.classList.toggle("mobile-pane-hidden", pane !== "inspector");
  }

  mobileTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => setMobilePane(btn.dataset.pane));
  });

  function syncClipsCountPills(val) {
    const strVal = String(val);
    if (clipsCountSelect) clipsCountSelect.value = strVal;
    clipsCountPills.forEach((p) => {
      const isMatch = p.dataset.count === strVal;
      p.classList.toggle("active", isMatch);
      const sub = p.querySelector("span");
      if (sub) {
        sub.style.color = isMatch ? "var(--accent)" : "var(--text-secondary)";
        sub.style.fontWeight = isMatch ? "600" : "400";
      }
    });
  }

  clipsCountPills.forEach((p) => {
    p.addEventListener("click", () => syncClipsCountPills(p.dataset.count));
  });
  if (clipsCountSelect) {
    clipsCountSelect.addEventListener("change", () => syncClipsCountPills(clipsCountSelect.value));
  }

  if (btnWizardNext) {
    btnWizardNext.addEventListener("click", () => {
      if (activeSourceMode === "upload" && (!urlInput.value || !urlInput.value.startsWith("local://"))) {
        return showToast("Please choose or drop an MP4/MOV/WEBM video file first", true);
      }
      if (!validateSourceInline()) {
        urlInput.focus();
        return showToast("Enter a valid YouTube link or try Instant Studio Demo", true);
      }
      setWizardStep(2, "next");
    });
  }

  if (btnWizardBack) {
    btnWizardBack.addEventListener("click", () => setWizardStep(1, "back"));
  }

  if (urlInput) {
    urlInput.addEventListener("input", validateSourceInline);
    validateSourceInline();
  }

  function getActiveWords(clip) {
    if (!clip) return [];
    if (clip.custom_words && clip.custom_words.length > 0) return clip.custom_words;
    if (clip.words && clip.words.length > 0) {
      return clip.words.filter((w) => w.end > clip.start_time + 0.02 && w.start < clip.end_time - 0.02);
    }
    const toks = (clip.hook_quote || clip.summary || "").split(/\s+/).filter(Boolean);
    const step = Math.max(0.15, (clip.end_time - clip.start_time) / Math.max(1, toks.length));
    return toks.map((t, idx) => ({
      word: t,
      start: Number((clip.start_time + idx * step).toFixed(2)),
      end: Number((clip.start_time + (idx + 1) * step).toFixed(2)),
    }));
  }

  function getClipSignature(clip) {
    if (!clip) return "";
    const bannerOn = chkWorkspaceBanner ? chkWorkspaceBanner.checked : true;
    const caption = workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value;
    const layout = layoutSelect ? layoutSelect.value : "blur_margins";
    const wordsSig = (clip.custom_words || []).map((w) => w.word).join(" ");
    return `${Number(clip.start_time).toFixed(2)}|${Number(clip.end_time).toFixed(2)}|${clip.hook_title}|${layout}|${caption}|${bannerOn}|${wordsSig}`;
  }

  function decodeInlineMp4ToBlobUrl(b64) {
    try {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "video/mp4" });
      return URL.createObjectURL(blob);
    } catch (_) {
      return null;
    }
  }

  // =========================================================
  // SERVER SETTINGS, STORAGE STATS & EXISTING LIBRARY
  // =========================================================
  async function loadServerSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        if (apiKeyDisplay) {
          apiKeyDisplay.textContent = data.cookies_configured ? "Cookies Ready" : "Settings";
        }
        if (cookiesStatusHint) {
          cookiesStatusHint.textContent = data.cookies_configured
            ? "YouTube cookies configured on server"
            : "Not set - optional for cloud deployments";
          cookiesStatusHint.style.color = data.cookies_configured ? "var(--success)" : "var(--text-secondary)";
        }
      }
    } catch (_) {}
  }

  async function refreshStorageAndLibrary() {
    try {
      const [statsRes, clipsRes] = await Promise.all([
        fetch(`${API_BASE}/api/storage-stats`),
        fetch(`${API_BASE}/api/clips`),
      ]);
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (storageStatsLabel) {
          storageStatsLabel.textContent = `${stats.clips_count} clips`;
        }
      }
      if (clipsRes.ok) {
        const data = await clipsRes.json();
        renderExistingLibrary(data.clips || []);
      }
    } catch (_) {}
  }

  function renderExistingLibrary(files) {
    if (!existingLibrarySection || !libraryGrid) return;
    if (!files.length) {
      existingLibrarySection.classList.add("hidden");
      return;
    }
    existingLibrarySection.classList.remove("hidden");
    libraryCountBadge.textContent = String(files.length);
    libraryGrid.innerHTML = "";
    files.slice(0, 9).forEach((f) => {
      const item = document.createElement("div");
      item.className = "kn-subcard";
      item.style.cssText = "padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;";
      item.innerHTML = `
        <div style="min-width: 0;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.filename}</div>
          <div class="kn-tabular" style="font-size: 11px; color: var(--text-secondary);">${f.size_mb} MB &middot; MP4</div>
        </div>
        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
          <a href="${f.download_url}" download="${f.filename}" class="kn-pressable kn-icon-btn" style="min-height: 30px; padding: 4px 10px; font-size: 11.5px; color: var(--accent); text-decoration: none;">Download</a>
          <button type="button" class="btn-del-lib-clip kn-pressable" style="min-height: 28px; width: 28px; border: none; border-radius: 8px; background: transparent; color: var(--text-tertiary); display: inline-flex; align-items: center; justify-content: center;" data-filename="${f.filename}" title="Delete file">
            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;
      item.querySelector(".btn-del-lib-clip").addEventListener("click", async () => {
        await fetch(`${API_BASE}/api/clips/${encodeURIComponent(f.filename)}`, { method: "DELETE" });
        refreshStorageAndLibrary();
        showToast(`Deleted ${f.filename}`);
      });
      libraryGrid.appendChild(item);
    });
    refreshIcons();
  }

  if (btnClearStorage) {
    btnClearStorage.addEventListener("click", async () => {
      try {
        if (previewVideo) {
          previewVideo.pause();
          previewVideo.removeAttribute("src");
          previewVideo.load();
        }
        const res = await fetch(`${API_BASE}/api/clear-storage`, { method: "POST" });
        if (res.ok) {
          const d = await res.json().catch(() => ({}));
          renderedClipsMap = {};
          if (activeClip) selectClip(activeClip);
          await refreshStorageAndLibrary();
          showToast(d.message || "Cleared rendered clips and temporary cache");
        }
      } catch (_) {
        showToast("Unable to clear storage", true);
      }
    });
  }

  // Settings Modal
  if (btnApiSettings) {
    btnApiSettings.addEventListener("click", () => {
      settingsModal.classList.remove("hidden");
      refreshIcons();
    });
  }
  [btnCloseSettings, btnCancelSettings].forEach((btn) => {
    if (btn) btn.addEventListener("click", () => settingsModal.classList.add("hidden"));
  });
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) settingsModal.classList.add("hidden");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !settingsModal.classList.contains("hidden")) {
        settingsModal.classList.add("hidden");
      }
    });
  }
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const apiKeyVal = (inputSettingsApiKey.value || "").trim();
      const cookiesVal = inputSettingsCookies ? inputSettingsCookies.value : null;
      const bodyPayload = {};
      if (apiKeyVal) bodyPayload.api_key = apiKeyVal;
      if (cookiesVal !== null && cookiesVal.trim().length > 0) bodyPayload.cookies_txt = cookiesVal.trim();

      if (!bodyPayload.api_key && !bodyPayload.cookies_txt) {
        return showToast("Enter an API key or paste YouTube cookies", true);
      }
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (res.ok) {
        settingsModal.classList.add("hidden");
        await loadServerSettings();
        showToast("Klipnux settings saved");
      } else {
        showToast("Failed to save settings", true);
      }
    });
  }

  // =========================================================
  // SOURCE TABS, LOCAL UPLOAD, CAPTION SWATCHES & PRESETS
  // =========================================================
  if (btnLogoHome) btnLogoHome.addEventListener("click", () => showView("launcher"));
  if (btnNewProject) btnNewProject.addEventListener("click", () => showView("launcher"));

  function activateSourceTab(mode) {
    activeSourceMode = mode;
    if (mode === "youtube") {
      youtubeSourcePanel.classList.remove("hidden");
      uploadSourcePanel.classList.add("hidden");
      tabSourceYoutube.classList.add("active");
      tabSourceUpload.classList.remove("active");
    } else {
      uploadSourcePanel.classList.remove("hidden");
      youtubeSourcePanel.classList.add("hidden");
      tabSourceUpload.classList.add("active");
      tabSourceYoutube.classList.remove("active");
    }
  }

  if (tabSourceYoutube && tabSourceUpload) {
    tabSourceYoutube.addEventListener("click", () => activateSourceTab("youtube"));
    tabSourceUpload.addEventListener("click", () => activateSourceTab("upload"));
  }

  async function handleLocalVideoUpload(file) {
    if (!file) return;
    uploadLabelText.textContent = `Uploading ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`;
    try {
      const res = await fetch(`${API_BASE}/api/upload-video?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      urlInput.value = data.url;
      uploadLabelText.textContent = `Uploaded: ${file.name} - advancing to Clips Setup`;
      showToast(`Uploaded ${file.name}`);
      setWizardStep(2, "next");
    } catch (err) {
      uploadLabelText.textContent = "Drop any MP4, MOV, MKV, or WEBM file here";
      showToast(err.message || "Video upload failed", true);
    }
  }

  if (fileUploadInput) {
    fileUploadInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) handleLocalVideoUpload(e.target.files[0]);
    });
  }

  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--accent)";
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "rgba(0, 0, 0, 0.14)";
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "rgba(0, 0, 0, 0.14)";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleLocalVideoUpload(e.dataTransfer.files[0]);
    });
  }

  launcherCaptionSwatches.forEach((btn) => {
    btn.addEventListener("click", () => {
      launcherCaptionSwatches.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const st = btn.dataset.style;
      captionSelect.value = st;
      if (workspaceCaptionSelect) workspaceCaptionSelect.value = st;
      updateLiveStagePreview();
    });
  });

  if (btnPaste) {
    btnPaste.addEventListener("click", async () => {
      try {
        const txt = await navigator.clipboard.readText();
        if (txt && txt.trim()) {
          urlInput.value = txt.trim();
          validateSourceInline();
          showToast("Link pasted from clipboard");
        }
      } catch (_) {
        urlInput.focus();
      }
    });
  }

  sampleChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const target = chip.dataset.url;
      urlInput.value = target;
      validateSourceInline();
      if (target.startsWith("demo://")) {
        triggerAnalyze(target);
      } else {
        setWizardStep(2, "next");
      }
    });
  });

  if (btnQuickDemo) {
    btnQuickDemo.addEventListener("click", () => {
      urlInput.value = "demo://creator-podcast";
      triggerAnalyze("demo://creator-podcast");
    });
  }

  clipForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (currentWizardStep === 1) {
      if (btnWizardNext) btnWizardNext.click();
      return;
    }
    const url = urlInput.value.trim();
    if (!url) return showToast("Please enter a YouTube link or upload a video", true);
    triggerAnalyze(url);
  });

  // =========================================================
  // ANALYSIS PIPELINE & FIRST-CLIP AUTO-CUT FLOW
  // =========================================================
  function stopJobTimers() {
    clearTimeout(activePollTimer);
    clearInterval(elapsedTimerInterval);
  }

  function updateProcessingSteps(stepNum, pct, title, detail) {
    progressBar.style.width = `${Math.max(8, Math.min(100, pct))}%`;
    processStatusTitle.textContent = title;
    processStatusDesc.textContent = detail;
    ["step1", "step2", "step3", "step4"].forEach((id, idx) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (idx + 1 < stepNum) {
        el.style.color = "var(--success)";
        el.style.fontWeight = "600";
      } else if (idx + 1 === stepNum) {
        el.style.color = "var(--accent)";
        el.style.fontWeight = "700";
      } else {
        el.style.color = "var(--text-tertiary)";
        el.style.fontWeight = "500";
      }
    });
  }

  if (btnCancelAnalysis) {
    btnCancelAnalysis.addEventListener("click", () => {
      activeJobCancelled = true;
      stopJobTimers();
      showView("launcher");
      showToast("Analysis cancelled");
    });
  }

  async function triggerAnalyze(url) {
    activeJobCancelled = false;
    stopJobTimers();
    await resolveWorkingApiBase();
    currentVideoUrl = url;
    renderedClipsMap = {};
    selectedClipIds.clear();
    isEditWordsMode = false;

    showView("processing");
    const startedMs = performance.now();
    elapsedTimerInterval = setInterval(() => {
      const sec = ((performance.now() - startedMs) / 1000).toFixed(1);
      processElapsedTimer.textContent = `${sec}s`;
    }, 100);

    updateProcessingSteps(1, 14, "Connecting to Klipnux Engine...", "Validating video source and preparing extraction...");

    try {
      const maxClips = parseInt(clipsCountSelect.value, 10) || 12;
      const targetDuration = parseInt(durationSelect.value, 10) || 45;

      if (chkWorkspaceBanner && chkHookBanner) {
        chkWorkspaceBanner.checked = chkHookBanner.checked;
      }
      if (workspaceCaptionSelect) {
        workspaceCaptionSelect.value = captionSelect.value;
      }

      const startRes = await fetch(`${API_BASE}/api/analyze/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, target_duration: targetDuration, max_clips: maxClips }),
      });

      if (startRes.status === 404 || startRes.status === 405) {
        updateProcessingSteps(2, 52, "2. Extracting Speech & Scoring...", "Finding best high-retention moments...");
        const syncRes = await fetch(`${API_BASE}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, target_duration: targetDuration, max_clips: maxClips }),
        });
        if (!syncRes.ok) {
          const err = await syncRes.json().catch(() => ({}));
          throw new Error(err.detail || `Server error (${syncRes.status})`);
        }
        const syncData = await syncRes.json();
        stopJobTimers();
        await hydrateWorkspace(syncData);
        return;
      }

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.detail || `Unable to start analysis (HTTP ${startRes.status}).`);
      }

      const startJson = await startRes.json();

      // Vercel serverless mode completes inline and returns job.result directly
      if (startJson.status === "completed" && startJson.result) {
        updateProcessingSteps(4, 95, "4. Preparing Clip #1 Preview...", "Launching Klipnux Studio...");
        stopJobTimers();
        await hydrateWorkspace(startJson.result);
        return;
      }

      const jobId = startJson.job_id;
      const pollJob = async () => {
        if (activeJobCancelled) return;
        const jobRes = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        if (!jobRes.ok) throw new Error("Lost connection to analysis job.");
        const job = await jobRes.json();

        updateProcessingSteps(job.step || 2, job.progress || 40, job.title || "Processing...", job.detail || "");

        if (job.status === "completed" && job.result) {
          stopJobTimers();
          await hydrateWorkspace(job.result);
          return;
        }
        if (job.status === "failed") {
          throw new Error(job.error || "Analysis failed.");
        }
        activePollTimer = setTimeout(pollJob, 350);
      };

      await pollJob();
    } catch (err) {
      stopJobTimers();
      if (!activeJobCancelled) {
        showView("launcher");
        showToast(err.message || "Unable to analyze this URL.", true);
      }
    }
  }

  // =========================================================
  // WORKSPACE HYDRATION, HEATMAP, FILTER & QUEUE
  // =========================================================
  async function hydrateWorkspace(data) {
    currentVideoInfo = data.video_info || {};
    currentClips = data.clips || [];
    totalVideoDuration = data.timeline_duration || currentVideoInfo.duration || 600;
    activeCategory = "all";
    sortMode = "timeline";
    if (sortClipsSelect) sortClipsSelect.value = "timeline";
    if (chkSelectAllClips) chkSelectAllClips.checked = false;

    const srcType = currentVideoInfo.is_demo ? "DEMO STUDIO" : currentVideoInfo.is_local ? "LOCAL VIDEO" : "YOUTUBE";
    headerSourceBadge.textContent = srcType;
    headerSourceBadge.className = currentVideoInfo.is_demo
      ? "kn-badge kn-badge-blue"
      : "kn-badge kn-badge-green";
    headerVideoTitle.textContent = currentVideoInfo.title || "Untitled Video";

    videoTitle.textContent = currentVideoInfo.title || "Analyzed Video";
    videoChannel.textContent = currentVideoInfo.channel || "Creator";
    videoThumb.src = currentVideoInfo.thumbnail || "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80";
    timelineDurationBadge.textContent = formatTime(totalVideoDuration);
    clipsFoundBadge.textContent = `${currentClips.length} Clips Found`;
    countAll.textContent = String(currentClips.length);

    showView("workspace");
    syncAspectButtonsFromSelect();
    renderTimelineHeatmap();
    buildDynamicCategoryFilters();
    renderClipsQueue();
    updateBatchCountLabel();

    showToast(`Found ${currentClips.length} clips — cutting Clip #1 preview...`);

    if (currentClips.length > 0) {
      if (currentVideoInfo.is_demo && !renderedClipsMap[currentClips[0].id]) {
        renderedClipsMap[currentClips[0].id] = {
          clip_id: "demo_preview",
          filename: "sample_preview.mp4",
          download_url: "/assets/sample_preview.mp4",
          stream_url: "/assets/sample_preview.mp4",
          duration: currentClips[0].duration,
          title: currentClips[0].hook_title,
          size_mb: 2.25,
          signature: getClipSignature(currentClips[0]),
          waveform: currentClips[0].waveform_preview,
        };
        selectClip(currentClips[0]);
      } else {
        selectClip(currentClips[0]);
        await renderAndPlayClip(currentClips[0]);
      }
    }
  }

  function renderTimelineHeatmap() {
    timelineTrack.innerHTML = "";
    const totalSecs = Math.max(1, totalVideoDuration);

    currentClips.forEach((clip) => {
      const leftPct = Math.min(96, Math.max(0.5, (clip.start_time / totalSecs) * 100));
      const widthPct = Math.max(2.0, Math.min(100 - leftPct, (clip.duration / totalSecs) * 100));
      const span = document.createElement("div");
      const bg = clip.score >= 92 ? "var(--success)" : clip.score >= 85 ? "var(--accent)" : "var(--warning)";
      const isSelected = activeClip && activeClip.id === clip.id;

      span.className = "heatmap-span";
      span.style.left = `${leftPct}%`;
      span.style.width = `${widthPct}%`;
      span.style.background = bg;
      span.style.opacity = isSelected ? "1" : "0.62";
      span.style.boxShadow = isSelected ? "0 0 0 2px #ffffff, 0 0 0 4px var(--accent)" : "none";
      span.dataset.markerClipId = clip.id;

      span.innerHTML = `
        <div class="heatmap-tooltip kn-tabular">
          #${clip.index} &middot; ${formatTime(clip.start_time)}-${formatTime(clip.end_time)} (${Math.round(clip.duration)}s) &middot; Score ${clip.score}
        </div>
      `;

      span.addEventListener("click", () => {
        selectClip(clip);
        const card = document.querySelector(`[data-clip-id="${clip.id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      timelineTrack.appendChild(span);
    });
  }

  function buildDynamicCategoryFilters() {
    categoryFilterBar.innerHTML = "";
    const counts = {};
    const names = {};
    currentClips.forEach((c) => {
      const tag = c.category_tag || "hook";
      counts[tag] = (counts[tag] || 0) + 1;
      names[tag] = c.category || tag;
    });

    const addPill = (tag, label, cnt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = activeCategory === tag;
      btn.className = "kn-pressable kn-tabular";
      btn.style.cssText = isActive
        ? "padding: 5px 11px; border-radius: 980px; border: 1px solid var(--accent); background: var(--accent); color: #ffffff; font-size: 11.5px; font-weight: 600;"
        : "padding: 5px 11px; border-radius: 980px; border: 1px solid var(--border-hairline); background: var(--bg-subtle); color: var(--text-secondary); font-size: 11.5px; font-weight: 600;";
      btn.textContent = `${label} (${cnt})`;
      btn.addEventListener("click", () => {
        activeCategory = tag;
        buildDynamicCategoryFilters();
        renderClipsQueue();
      });
      categoryFilterBar.appendChild(btn);
    };

    addPill("all", "All", currentClips.length);
    Object.keys(counts).forEach((tag) => addPill(tag, names[tag], counts[tag]));
  }

  function categoryBadgeClass(tag) {
    const map = {
      hook: "kn-badge-red",
      insight: "kn-badge-blue",
      high_energy: "kn-badge-amber",
      rule: "kn-badge-green",
      story: "kn-badge-purple",
      funny: "kn-badge-amber",
    };
    return map[tag] || "kn-badge-neutral";
  }

  function renderClipsQueue() {
    let list = activeCategory === "all"
      ? [...currentClips]
      : currentClips.filter((c) => c.category_tag === activeCategory);

    if (sortMode === "score") {
      list.sort((a, b) => (b.score - a.score) || (a.start_time - b.start_time));
    } else {
      list.sort((a, b) => a.start_time - b.start_time);
    }
    filteredClips = list;

    clipCardsList.innerHTML = "";
    if (!filteredClips.length) {
      clipCardsList.innerHTML = `<div style="font-size: 12.5px; color: var(--text-secondary); text-align: center; padding: 32px 12px;">No clips match this category.</div>`;
      return;
    }

    filteredClips.forEach((clip) => {
      const card = document.createElement("div");
      const isActive = activeClip && activeClip.id === clip.id;
      const rendered = renderedClipsMap[clip.id];
      const isFreshRendered = rendered && rendered.signature === getClipSignature(clip);
      const isStaleRendered = rendered && !isFreshRendered;

      card.className = `clip-card ${isActive ? "active" : ""}`;
      card.dataset.clipId = clip.id;

      const statusBadge = isFreshRendered
        ? `<span class="kn-badge kn-badge-green" style="font-size: 10px;">READY</span>`
        : isStaleRendered
        ? `<span class="kn-badge kn-badge-amber" style="font-size: 10px;">EDITED</span>`
        : `<span class="kn-badge kn-badge-neutral" style="font-size: 10px;">QUEUED</span>`;

      const actionBtnStyle = isFreshRendered
        ? "padding: 5px 12px; border-radius: 980px; border: none; background: #15803d; color: #ffffff; font-size: 11.5px; font-weight: 600;"
        : "padding: 5px 12px; border-radius: 980px; border: none; background: var(--accent); color: #ffffff; font-size: 11.5px; font-weight: 600;";

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
            <input type="checkbox" class="clip-batch-chk" style="width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer;" ${selectedClipIds.has(clip.id) ? "checked" : ""} />
            <span class="kn-tabular" style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">#${clip.index}</span>
            <span class="kn-badge ${categoryBadgeClass(clip.category_tag)}" style="font-size: 10.5px;">${clip.category}</span>
          </div>
          <span class="kn-badge kn-badge-green kn-tabular" style="font-weight: 700;">${clip.score}</span>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px; line-height: 1.35;">${clip.hook_title}</h4>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span class="kn-tabular" style="font-size: 11.5px; color: var(--text-secondary);">${formatTime(clip.start_time)}-${formatTime(clip.end_time)} &middot; ${Math.round(clip.duration)}s</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${statusBadge}
            <button type="button" class="btn-card-render kn-pressable" style="${actionBtnStyle}">
              ${isFreshRendered ? "Play" : "Cut"}
            </button>
            <button type="button" class="btn-card-download kn-pressable kn-icon-btn" style="min-height: 28px; padding: 4px 8px;" title="Download MP4">
              <i data-lucide="download" style="width: 13px; height: 13px;"></i>
            </button>
          </div>
        </div>
      `;

      const chk = card.querySelector(".clip-batch-chk");
      chk.addEventListener("click", (e) => {
        e.stopPropagation();
        if (chk.checked) selectedClipIds.add(clip.id);
        else selectedClipIds.delete(clip.id);
        updateBatchCountLabel();
      });

      card.querySelector(".btn-card-render").addEventListener("click", async (e) => {
        e.stopPropagation();
        selectClip(clip);
        setMobilePane("preview");
        if (isFreshRendered) {
          loadVideoPlayer(rendered);
        } else {
          await renderAndPlayClip(clip);
        }
      });

      const btnDl = card.querySelector(".btn-card-download");
      if (btnDl) {
        btnDl.addEventListener("click", async (e) => {
          e.stopPropagation();
          selectClip(clip);
          if (isFreshRendered && rendered) {
            triggerClipDownload(rendered, `klipnux_short_${clip.index}.mp4`);
            showToast(`Downloading Short #${clip.index}...`);
          } else {
            showToast(`Cutting Clip #${clip.index} for download...`);
            const clipData = await renderAndPlayClip(clip);
            if (clipData) {
              triggerClipDownload(clipData, `klipnux_short_${clip.index}.mp4`);
              showToast(`Downloaded Short #${clip.index}`);
            }
          }
        });
      }

      card.addEventListener("click", () => {
        selectClip(clip);
        setMobilePane("preview");
      });
      clipCardsList.appendChild(card);
    });
    refreshIcons();
  }

  if (chkSelectAllClips) {
    chkSelectAllClips.addEventListener("change", () => {
      filteredClips.forEach((c) => {
        if (chkSelectAllClips.checked) selectedClipIds.add(c.id);
        else selectedClipIds.delete(c.id);
      });
      renderClipsQueue();
      updateBatchCountLabel();
    });
  }

  if (sortClipsSelect) {
    sortClipsSelect.addEventListener("change", () => {
      sortMode = sortClipsSelect.value;
      renderClipsQueue();
    });
  }

  function updateBatchCountLabel() {
    if (!batchBtnLabel) return;
    const n = selectedClipIds.size;
    batchBtnLabel.textContent = n > 0 ? `Batch Cut Selected (${n})` : "Batch Cut Top 5";
  }

  // =========================================================
  // CLIP SELECTION, STAGE PREVIEW & INSPECTOR SYNC
  // =========================================================
  function selectClip(clip) {
    activeClip = clip;
    if (stageErrorOverlay) stageErrorOverlay.classList.add("hidden");
    renderTimelineHeatmap();
    renderClipsQueue();

    if (inputHookTitle) inputHookTitle.value = clip.hook_title || "";
    updateTrimmerUI();
    updateInspectorMetrics(clip);
    renderInteractiveTranscript(clip);

    const seo = clip.youtube_shorts_seo || {};
    if (seoPreviewText) {
      seoPreviewText.textContent = `${seo.title || clip.hook_title} - ${(seo.tags || clip.hashtags || []).join(" ")}`;
    }

    const rendered = renderedClipsMap[clip.id];
    const isFresh = rendered && rendered.signature === getClipSignature(clip);

    if (isFresh) {
      loadVideoPlayer(rendered);
      initWaveform(rendered.waveform || clip.waveform_preview);
    } else {
      previewVideo.pause();
      previewVideo.classList.add("hidden");
      if (btnToggleSound) btnToggleSound.classList.add("hidden");

      const isYt = currentVideoInfo && !currentVideoInfo.is_demo && !currentVideoInfo.is_local && currentVideoInfo.id && currentVideoInfo.id.length === 11;
      if (isYt && sourceYoutubeFrame) {
        playerPlaceholder.classList.add("hidden");
        sourceYoutubeFrame.classList.remove("hidden");
        const startSec = Math.max(0, Math.floor(clip.start_time));
        const endSec = Math.max(startSec + 2, Math.ceil(clip.end_time));
        sourceYoutubeFrame.src = `https://www.youtube-nocookie.com/embed/${currentVideoInfo.id}?start=${startSec}&end=${endSec}&controls=1&playsinline=1&rel=0`;
      } else {
        if (sourceYoutubeFrame) {
          sourceYoutubeFrame.src = "";
          sourceYoutubeFrame.classList.add("hidden");
        }
        playerPlaceholder.classList.remove("hidden");
      }

      if (btnDownloadClip) {
        const span = btnDownloadClip.querySelector("span");
        if (span) span.textContent = "Cut & Download MP4";
      }

      renderStatusHint.textContent = rendered
        ? "Settings changed - click to re-cut MP4"
        : "Click below to cut & burn 1080p MP4";
      updateLiveStagePreview();
      initWaveform(clip.waveform_preview);
    }
  }

  function updateLiveStagePreview() {
    if (!activeClip) return;
    if (stageCategoryPill) stageCategoryPill.textContent = activeClip.category || "Viral Moment";
    if (stageTimestamp) {
      stageTimestamp.textContent = `${formatTime(activeClip.start_time)} - ${formatTime(activeClip.end_time)} (${Math.round(activeClip.duration)}s)`;
    }

    const bannerOn = chkWorkspaceBanner ? chkWorkspaceBanner.checked : true;
    if (liveBannerPreview) {
      liveBannerPreview.classList.toggle("hidden", !bannerOn);
      liveBannerPreview.textContent = (activeClip.hook_title || "Viral Clip").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
    }

    const styleId = workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value;
    const samples = {
      hormozi: `<span style="color:#fff">VOLUME </span><span style="padding:2px 6px;border-radius:4px;background:#22c55e;color:#052e16">CREATES</span><span style="color:#fff"> SKILL</span>`,
      mrbeast: `<span style="color:#fde047">WAIT </span><span style="color:#f43f5e">FOR IT!</span>`,
      tiktok: `<span style="color:#fff">Pace is </span><span style="color:#fe2c55">everything</span>`,
      neon: `<span style="color:#22d3ee">GO </span><span style="color:#e879f9">10X FASTER</span>`,
      minimal: `<span style="padding:2px 8px;border-radius:5px;background:rgba(0,0,0,0.8);color:#fff;font-size:12px">Consistent pacing wins</span>`,
      podcast: `<span style="color:#fff">Master the </span><span style="color:#fbbf24">story arc</span>`,
    };
    if (liveCaptionPreview) {
      liveCaptionPreview.innerHTML = samples[styleId] || samples.hormozi;
    }
  }

  function updateInspectorMetrics(clip) {
    const vb = clip.virality_breakdown || {};
    if (inspectorScoreBadge) inspectorScoreBadge.textContent = `${clip.score}/100`;
    if (metricHookVal) metricHookVal.textContent = `${vb.hook_score || Math.min(99, clip.score + 1)}%`;
    if (metricRetentionVal) metricRetentionVal.textContent = `${vb.retention_score || Math.min(99, clip.score - 1)}%`;
    if (metricEnergyVal) metricEnergyVal.textContent = `${vb.energy_score || clip.score}%`;
    if (inspectorReasoning) inspectorReasoning.textContent = vb.reasoning || "Strong hook opener and clean sentence rhythm.";
  }

  function renderInteractiveTranscript(clip) {
    if (!inspectorTranscriptBox) return;
    inspectorTranscriptBox.innerHTML = "";
    const words = getActiveWords(clip);

    words.forEach((w, idx) => {
      const span = document.createElement("span");
      span.className = `transcript-word ${isEditWordsMode ? "editable-word" : ""}`;
      span.textContent = w.word;
      span.dataset.start = w.start;
      span.dataset.end = w.end;
      span.dataset.clipId = clip.id;
      span.title = isEditWordsMode ? "Click to edit word" : `Seek to ${formatTime(w.start)}`;

      span.addEventListener("click", () => {
        if (isEditWordsMode) {
          const updated = prompt("Edit caption word:", w.word);
          if (updated !== null && updated.trim()) {
            if (!clip.custom_words) clip.custom_words = words.map((x) => ({ ...x }));
            clip.custom_words[idx].word = updated.trim();
            renderInteractiveTranscript(clip);
            renderClipsQueue();
            showToast("Caption word updated - click Cut & Apply to render");
          }
          return;
        }
        const rendered = renderedClipsMap[clip.id];
        if (rendered && rendered.signature === getClipSignature(clip)) {
          previewVideo.currentTime = Math.max(0, w.start - clip.start_time);
          previewVideo.play().catch(() => {});
        } else {
          showToast(`Timestamp ${formatTime(w.start)} - click Cut & Render Clip to preview`);
        }
      });

      inspectorTranscriptBox.appendChild(span);
    });
  }

  if (btnToggleEditWords) {
    btnToggleEditWords.addEventListener("click", () => {
      isEditWordsMode = !isEditWordsMode;
      btnToggleEditWords.textContent = isEditWordsMode ? "Done Editing" : "Edit Words";
      btnToggleEditWords.style.background = isEditWordsMode ? "var(--accent)" : "var(--bg-surface)";
      btnToggleEditWords.style.color = isEditWordsMode ? "#ffffff" : "var(--accent)";
      if (transcriptHelpHint) {
        transcriptHelpHint.textContent = isEditWordsMode
          ? "Edit Mode Active: click any word below to rename before rendering"
          : 'Tap any word to jump playback or click "Edit Words" to customize burned captions';
      }
      if (activeClip) renderInteractiveTranscript(activeClip);
    });
  }

  // =========================================================
  // TRIMMER, ASPECT RATIO, STYLE & HOOK BANNER EDITING
  // =========================================================
  function updateTrimmerUI() {
    if (!activeClip) return;
    const dur = Math.max(1, Math.round(activeClip.end_time - activeClip.start_time));
    activeClip.duration = dur;
    if (inputStartTime) inputStartTime.value = formatTime(activeClip.start_time);
    if (inputEndTime) inputEndTime.value = formatTime(activeClip.end_time);
    if (trimmerDurationBadge) trimmerDurationBadge.textContent = `${formatTime(dur)} (${dur}s)`;
    if (stageTimestamp) stageTimestamp.textContent = `${formatTime(activeClip.start_time)} - ${formatTime(activeClip.end_time)} (${dur}s)`;
  }

  function onClipEdited(refreshQueue = true) {
    if (!activeClip) return;
    updateTrimmerUI();
    renderInteractiveTranscript(activeClip);
    updateLiveStagePreview();
    if (refreshQueue) renderClipsQueue();
    const rendered = renderedClipsMap[activeClip.id];
    if (rendered && rendered.signature !== getClipSignature(activeClip)) {
      previewVideo.pause();
      previewVideo.classList.add("hidden");
      playerPlaceholder.classList.remove("hidden");
      if (btnToggleSound) btnToggleSound.classList.add("hidden");
      renderStatusHint.textContent = "Edited - click Cut & Render Clip to update MP4";
    }
  }

  if (inputHookTitle) {
    inputHookTitle.addEventListener("input", () => {
      if (!activeClip) return;
      activeClip.hook_title = inputHookTitle.value;
      onClipEdited(true);
    });
  }

  if (chkWorkspaceBanner) {
    chkWorkspaceBanner.addEventListener("change", () => onClipEdited(false));
  }

  if (workspaceCaptionSelect) {
    workspaceCaptionSelect.addEventListener("change", () => {
      captionSelect.value = workspaceCaptionSelect.value;
      onClipEdited(false);
    });
  }

  if (btnStartMinus5) btnStartMinus5.addEventListener("click", () => { if (!activeClip) return; activeClip.start_time = Math.max(0, activeClip.start_time - 5); onClipEdited(); });
  if (btnStartPlus5) btnStartPlus5.addEventListener("click", () => { if (!activeClip) return; activeClip.start_time = Math.min(activeClip.end_time - 5, activeClip.start_time + 5); onClipEdited(); });
  if (btnEndMinus5) btnEndMinus5.addEventListener("click", () => { if (!activeClip) return; activeClip.end_time = Math.max(activeClip.start_time + 5, activeClip.end_time - 5); onClipEdited(); });
  if (btnEndPlus5) btnEndPlus5.addEventListener("click", () => { if (!activeClip) return; activeClip.end_time = Math.min(totalVideoDuration || 3600, activeClip.end_time + 5); onClipEdited(); });

  if (inputStartTime) {
    inputStartTime.addEventListener("change", () => {
      if (!activeClip) return;
      const val = parseTimeToSeconds(inputStartTime.value);
      if (val >= 0 && val < activeClip.end_time - 2) activeClip.start_time = val;
      onClipEdited();
    });
  }
  if (inputEndTime) {
    inputEndTime.addEventListener("change", () => {
      if (!activeClip) return;
      const val = parseTimeToSeconds(inputEndTime.value);
      if (val > activeClip.start_time + 2 && val - activeClip.start_time <= 360) activeClip.end_time = val;
      onClipEdited();
    });
  }

  extendButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!activeClip) return;
      const dur = parseInt(btn.dataset.duration, 10);
      if (dur) {
        activeClip.end_time = Math.min(totalVideoDuration || 3600, activeClip.start_time + dur);
        onClipEdited();
        showToast(`Clip length set to ${formatTime(activeClip.end_time - activeClip.start_time)}`);
      }
    });
  });

  function applyAspectToFrame(aspect) {
    aspectBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.aspect === aspect);
    });
    if (!deviceFrame) return;
    deviceFrame.classList.remove("aspect-1-1", "aspect-16-9");
    if (aspect === "1:1") {
      deviceFrame.classList.add("aspect-1-1");
      layoutSelect.value = "square_1_1";
    } else if (aspect === "16:9") {
      deviceFrame.classList.add("aspect-16-9");
      layoutSelect.value = "landscape_16_9";
    } else {
      if (layoutSelect.value === "square_1_1" || layoutSelect.value === "landscape_16_9") {
        layoutSelect.value = "blur_margins";
      }
    }
  }

  function syncAspectButtonsFromSelect() {
    const val = layoutSelect ? layoutSelect.value : "blur_margins";
    if (val === "square_1_1") applyAspectToFrame("1:1");
    else if (val === "landscape_16_9") applyAspectToFrame("16:9");
    else applyAspectToFrame("9:16");
  }

  aspectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyAspectToFrame(btn.dataset.aspect);
      onClipEdited(false);
      showToast(`Switched layout to ${btn.dataset.aspect}`);
    });
  });

  // =========================================================
  // CUTTING, PLAYBACK & 1:1 POINTER WAVEFORM SCRUBBER
  // =========================================================
  function triggerClipDownload(clipData, defaultName) {
    const url = clipData.blob_url || clipData.download_url;
    if (!url) return;
    const fullUrl = (url.startsWith("http") || url.startsWith("blob:")) ? url : `${API_BASE}${url}`;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = clipData.filename || defaultName || "klipnux_short.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function renderAndPlayClip(clip) {
    if (!clip) return null;
    const signature = getClipSignature(clip);
    if (stageErrorOverlay) stageErrorOverlay.classList.add("hidden");
    if (sourceYoutubeFrame) {
      sourceYoutubeFrame.src = "";
      sourceYoutubeFrame.classList.add("hidden");
    }
    stageRenderingOverlay.classList.remove("hidden");
    btnStageRender.disabled = true;
    btnRenderCustomCut.disabled = true;

    const rStart = performance.now();
    clearInterval(renderTimerInterval);
    renderTimerInterval = setInterval(() => {
      stageRenderTimer.textContent = `${((performance.now() - rStart) / 1000).toFixed(1)}s elapsed`;
    }, 100);

    try {
      const res = await fetch(`${API_BASE}/api/generate-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentVideoUrl || "demo://creator-podcast",
          start_time: clip.start_time,
          end_time: clip.end_time,
          hook_title: clip.hook_title,
          layout_style: layoutSelect.value,
          caption_style: workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value,
          show_hook_banner: chkWorkspaceBanner ? chkWorkspaceBanner.checked : true,
          custom_words: clip.custom_words || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to cut video clip.");
      }

      const clipData = await res.json();
      clipData.signature = signature;
      if (clipData.inline_mp4_base64) {
        clipData.blob_url = decodeInlineMp4ToBlobUrl(clipData.inline_mp4_base64);
      }
      renderedClipsMap[clip.id] = clipData;

      if (activeClip && activeClip.id === clip.id) {
        loadVideoPlayer(clipData);
        initWaveform(clipData.waveform || clip.waveform_preview);
      }
      renderClipsQueue();
      refreshStorageAndLibrary();
      showToast(`Clip #${clip.index} cut & ready (${clipData.size_mb} MB)`);
      return clipData;
    } catch (err) {
      const msg = err.message || "Failed to cut video clip.";
      showToast(msg, true);
      if (activeClip && activeClip.id === clip.id && stageErrorOverlay && stageErrorMessage) {
        stageErrorMessage.textContent = msg;
        stageErrorOverlay.classList.remove("hidden");
      }
      return null;
    } finally {
      clearInterval(renderTimerInterval);
      stageRenderingOverlay.classList.add("hidden");
      btnStageRender.disabled = false;
      btnRenderCustomCut.disabled = false;
    }
  }

  if (btnStageRender) btnStageRender.addEventListener("click", () => renderAndPlayClip(activeClip));
  if (btnRenderCustomCut) btnRenderCustomCut.addEventListener("click", () => renderAndPlayClip(activeClip));
  if (btnRetryStageCut) btnRetryStageCut.addEventListener("click", () => renderAndPlayClip(activeClip));
  if (btnStageSwitchUpload) {
    btnStageSwitchUpload.addEventListener("click", () => {
      showView("launcher");
      activateSourceTab("upload");
    });
  }
  if (btnStageOpenCookies) {
    btnStageOpenCookies.addEventListener("click", () => {
      settingsModal.classList.remove("hidden");
      if (inputSettingsCookies) inputSettingsCookies.focus();
    });
  }

  function loadVideoPlayer(clipData) {
    if (stageErrorOverlay) stageErrorOverlay.classList.add("hidden");
    if (sourceYoutubeFrame) {
      sourceYoutubeFrame.src = "";
      sourceYoutubeFrame.classList.add("hidden");
    }
    playerPlaceholder.classList.add("hidden");
    previewVideo.classList.remove("hidden");
    if (btnToggleSound) btnToggleSound.classList.remove("hidden");

    const streamUrl = clipData.blob_url
      ? clipData.blob_url
      : (clipData.stream_url && clipData.stream_url.startsWith("http"))
      ? clipData.stream_url
      : `${API_BASE}${clipData.stream_url || clipData.download_url}`;

    previewVideo.onerror = () => {
      if (clipData.blob_url && previewVideo.src !== clipData.blob_url) {
        previewVideo.src = clipData.blob_url;
        previewVideo.load();
      }
    };

    previewVideo.src = streamUrl;
    previewVideo.playbackRate = speedSteps[speedIdx];
    previewVideo.load();
    const playPromise = previewVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        previewVideo.muted = true;
        if (soundIcon) soundIcon.setAttribute("data-lucide", "volume-x");
        refreshIcons();
        previewVideo.play().catch(() => {});
      });
    }

    if (btnDownloadClip) {
      const span = btnDownloadClip.querySelector("span");
      if (span) span.textContent = `Download 1080p MP4 (${clipData.size_mb || 1.2} MB)`;
    }
  }

  if (btnDownloadClip) {
    btnDownloadClip.addEventListener("click", async () => {
      if (!activeClip) return;
      const rendered = renderedClipsMap[activeClip.id];
      const isFresh = rendered && rendered.signature === getClipSignature(activeClip);

      if (isFresh) {
        triggerClipDownload(rendered, `klipnux_short_${activeClip.index}.mp4`);
        showToast(`Downloading Short #${activeClip.index} (${rendered.size_mb || "1.2"} MB)...`);
      } else {
        showToast(`Cutting Short #${activeClip.index} before download...`);
        const clipData = await renderAndPlayClip(activeClip);
        if (clipData) {
          triggerClipDownload(clipData, `klipnux_short_${activeClip.index}.mp4`);
          showToast(`Downloaded Short #${activeClip.index}`);
        }
      }
    });
  }

  if (btnToggleSound) {
    btnToggleSound.addEventListener("click", () => {
      previewVideo.muted = !previewVideo.muted;
      soundIcon.setAttribute("data-lucide", previewVideo.muted ? "volume-x" : "volume-2");
      soundIcon.style.color = previewVideo.muted ? "#fbbf24" : "#4ade80";
      refreshIcons();
    });
  }

  if (btnPlaybackSpeed) {
    btnPlaybackSpeed.addEventListener("click", () => {
      speedIdx = (speedIdx + 1) % speedSteps.length;
      const rate = speedSteps[speedIdx];
      previewVideo.playbackRate = rate;
      btnPlaybackSpeed.textContent = `${rate}x`;
    });
  }

  function seekWaveformByClientX(clientX) {
    if (!previewVideo || !previewVideo.duration || !waveformContainer) return;
    const rect = waveformContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    previewVideo.currentTime = pct * previewVideo.duration;
  }

  function initWaveform(peaksArray) {
    if (!waveformContainer) return;
    const peaks = Array.isArray(peaksArray) && peaksArray.length >= 16
      ? peaksArray
      : [35, 60, 75, 45, 88, 70, 40, 82, 95, 58, 68, 90, 52, 42, 78, 84, 62, 88, 96, 72, 48, 66, 80, 92, 84, 68, 56, 86, 94, 52, 44, 78, 90, 70, 58, 82, 96, 86, 62, 48, 72, 84, 92, 68, 54, 78, 88, 58];

    waveformContainer.innerHTML = `<div id="waveformPlayhead" style="position: absolute; top: 0; bottom: 0; width: 2px; background: var(--success-bright); z-index: 20; pointer-events: none; left: 0%;"></div>`;
    peaks.forEach((h) => {
      const bar = document.createElement("div");
      bar.className = "waveform-bar";
      bar.style.height = `${Math.max(14, Math.min(100, h))}%`;
      bar.style.backgroundColor = "#d2d2d7";
      waveformContainer.appendChild(bar);
    });

    // 1:1 Pointer Capture scrub interaction (WWDC Fluid Interfaces)
    let isDragging = false;
    waveformContainer.onpointerdown = (e) => {
      isDragging = true;
      if (waveformContainer.setPointerCapture) waveformContainer.setPointerCapture(e.pointerId);
      seekWaveformByClientX(e.clientX);
      previewVideo.play().catch(() => {});
    };
    waveformContainer.onpointermove = (e) => {
      if (isDragging) seekWaveformByClientX(e.clientX);
    };
    waveformContainer.onpointerup = (e) => {
      isDragging = false;
      if (waveformContainer.releasePointerCapture) {
        try { waveformContainer.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
  }

  if (previewVideo) {
    previewVideo.addEventListener("timeupdate", () => {
      if (!activeClip) return;
      const rel = previewVideo.currentTime || 0;
      const dur = previewVideo.duration || activeClip.duration || 1;
      const pct = Math.min(100, Math.max(0, (rel / dur) * 100));

      const ph = document.getElementById("waveformPlayhead");
      if (ph) ph.style.left = `${pct}%`;
      if (waveformTimecode) waveformTimecode.textContent = `${formatTime(rel)} / ${formatTime(dur)}`;

      const bars = document.querySelectorAll("#waveformContainer .waveform-bar");
      const activeIdx = Math.floor((pct / 100) * bars.length);
      bars.forEach((b, idx) => {
        b.style.backgroundColor = idx <= activeIdx ? "var(--accent)" : "#d2d2d7";
      });

      const absT = activeClip.start_time + rel;
      document.querySelectorAll(`#inspectorTranscriptBox .transcript-word[data-clip-id="${activeClip.id}"]`).forEach((el) => {
        const s = parseFloat(el.dataset.start);
        const e = parseFloat(el.dataset.end);
        el.classList.toggle("active-word", absT >= s && absT <= e);
      });
    });
  }

  // =========================================================
  // BATCH RENDER, ZIP EXPORT & SEO COPY
  // =========================================================
  if (btnCopyMeta) {
    btnCopyMeta.addEventListener("click", () => {
      if (!activeClip) return;
      const seo = activeClip.youtube_shorts_seo || {};
      const payload = `${seo.title || activeClip.hook_title}\n\n${seo.description || activeClip.summary}\n\n${(seo.tags || activeClip.hashtags || []).join(" ")}`;
      navigator.clipboard.writeText(payload).catch(() => {});
      showToast(`Copied SEO copy for Clip #${activeClip.index}`);
    });
  }

  async function runBatchRender(targets) {
    for (let i = 0; i < targets.length; i++) {
      const clip = targets[i];
      if (batchBtnLabel) batchBtnLabel.textContent = `Cutting ${i + 1}/${targets.length}...`;
      const sig = getClipSignature(clip);
      try {
        const res = await fetch(`${API_BASE}/api/generate-clip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: currentVideoUrl || "demo://creator-podcast",
            start_time: clip.start_time,
            end_time: clip.end_time,
            hook_title: clip.hook_title,
            layout_style: layoutSelect.value,
            caption_style: workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value,
            show_hook_banner: chkWorkspaceBanner ? chkWorkspaceBanner.checked : true,
            custom_words: clip.custom_words || null,
          }),
        });
        if (res.ok) {
          const clipData = await res.json();
          clipData.signature = sig;
          if (clipData.inline_mp4_base64) {
            clipData.blob_url = decodeInlineMp4ToBlobUrl(clipData.inline_mp4_base64);
          }
          renderedClipsMap[clip.id] = clipData;
          renderClipsQueue();
        }
      } catch (_) {}
    }
    updateBatchCountLabel();
    refreshStorageAndLibrary();
  }

  if (btnBatchRenderAll) {
    btnBatchRenderAll.addEventListener("click", async () => {
      if (!currentClips.length) return;
      const targets = selectedClipIds.size > 0
        ? currentClips.filter((c) => selectedClipIds.has(c.id))
        : currentClips.slice(0, 5);

      btnBatchRenderAll.disabled = true;
      showToast(`Batch cutting ${targets.length} clips...`);

      await runBatchRender(targets);

      btnBatchRenderAll.disabled = false;
      updateBatchCountLabel();
      refreshStorageAndLibrary();
      if (activeClip && renderedClipsMap[activeClip.id]) {
        selectClip(activeClip);
      }
      showToast(`Batch complete - ${targets.length} clips ready`);
    });
  }

  function buildClientStoredZipBlob(entries) {
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
    const crc32 = (u8) => {
      let c = 0xffffffff;
      for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const enc = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;

    entries.forEach(({ name, bytes }) => {
      const nameBytes = enc.encode(name);
      const crc = crc32(bytes);
      const lh = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(8, 0, true); // stored
      dv.setUint32(14, crc, true);
      dv.setUint32(18, bytes.length, true);
      dv.setUint32(22, bytes.length, true);
      dv.setUint16(26, nameBytes.length, true);
      lh.set(nameBytes, 30);
      locals.push(lh, bytes);

      const ch = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, bytes.length, true);
      cdv.setUint32(24, bytes.length, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);
      centrals.push(ch);

      offset += lh.length + bytes.length;
    });

    const cdSize = centrals.reduce((acc, c) => acc + c.length, 0);
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, entries.length, true);
    edv.setUint16(10, entries.length, true);
    edv.setUint32(12, cdSize, true);
    edv.setUint32(16, offset, true);

    return new Blob([...locals, ...centrals, eocd], { type: "application/zip" });
  }

  async function triggerZipExport() {
    const renderedList = Object.values(renderedClipsMap).filter((c) => c && c.filename);

    if (renderedList.length === 0) {
      if (!currentClips.length) {
        showToast("Analyze or select a demo first to export clips", true);
        return;
      }
      showToast("Cutting top clips for ZIP export...", false);
      const targets = currentClips.slice(0, Math.min(3, currentClips.length));
      await runBatchRender(targets);
    }

    const selectedFilenames = Array.from(selectedClipIds)
      .map((id) => renderedClipsMap[id] && renderedClipsMap[id].filename)
      .filter(Boolean);

    try {
      let res;
      if (selectedFilenames.length > 0) {
        res = await fetch(`${API_BASE}/api/download-zip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filenames: selectedFilenames }),
        });
      } else {
        res = await fetch(`${API_BASE}/api/download-all-zip`);
      }

      let blob = null;
      if (res.ok) {
        blob = await res.blob();
      } else {
        // Serverless fallback: assemble ZIP cleanly from cached inline MP4 bytes if container switched
        const memEntries = [];
        for (const c of Object.values(renderedClipsMap)) {
          if (!c || !c.filename) continue;
          if (selectedFilenames.length > 0 && !selectedFilenames.includes(c.filename)) continue;
          if (c.blob_url) {
            const ab = await (await fetch(c.blob_url)).arrayBuffer();
            memEntries.push({ name: c.filename, bytes: new Uint8Array(ab) });
          } else if (c.inline_mp4_base64) {
            const bin = atob(c.inline_mp4_base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            memEntries.push({ name: c.filename, bytes });
          }
        }
        if (memEntries.length > 0) {
          blob = buildClientStoredZipBlob(memEntries);
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "ZIP export failed");
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "klipnux_viral_shorts_pack.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Downloaded Klipnux ZIP pack");
    } catch (err) {
      showToast(err.message || "Failed to download ZIP pack", true);
    }
  }
  if (btnDownloadZip) btnDownloadZip.addEventListener("click", triggerZipExport);
  if (btnDownloadAllTop) btnDownloadAllTop.addEventListener("click", triggerZipExport);

  // Initial Hydration
  resolveWorkingApiBase().then(() => {
    loadServerSettings();
    refreshStorageAndLibrary();
  });
});
