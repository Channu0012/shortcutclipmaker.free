// ShortCut Studio Pro v3.0 — Production AutoCut Studio Frontend Controller
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

  // Studio Application State
  let currentVideoUrl = "";
  let currentVideoInfo = null;
  let currentClips = [];
  let filteredClips = [];
  let renderedClipsMap = {}; // { [clipId]: { ...serverClipData, signature } }
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
  // HELPERS & VIEW ROUTER
  // =========================================================
  function showToast(message, isError = false) {
    toastMessage.textContent = message;
    if (isError) {
      toastBox.className = "bg-surface-900 border border-rose-500/40 text-rose-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold";
      toastIcon.setAttribute("data-lucide", "alert-circle");
      toastIcon.className = "w-4 h-4 text-rose-400";
    } else {
      toastBox.className = "bg-surface-900 border border-brand-500/40 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold";
      toastIcon.setAttribute("data-lucide", "check-circle");
      toastIcon.className = "w-4 h-4 text-emerald-400";
    }
    refreshIcons();
    toast.classList.remove("translate-y-16", "opacity-0", "pointer-events-none");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add("translate-y-16", "opacity-0", "pointer-events-none");
    }, 3400);
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

  function showView(viewName) {
    launcherView.classList.add("hidden");
    processingSection.classList.add("hidden");
    resultsSection.classList.add("hidden");

    if (viewName === "launcher") {
      launcherView.classList.remove("hidden");
      headerProjectMeta.classList.add("hidden");
      btnNewProject.classList.add("hidden");
      btnNewProject.classList.remove("flex");
      refreshStorageAndLibrary();
    } else if (viewName === "processing") {
      processingSection.classList.remove("hidden");
      headerProjectMeta.classList.add("hidden");
      btnNewProject.classList.add("hidden");
    } else if (viewName === "workspace") {
      resultsSection.classList.remove("hidden");
      headerProjectMeta.classList.remove("hidden");
      headerProjectMeta.classList.add("flex");
      btnNewProject.classList.remove("hidden");
      btnNewProject.classList.add("flex");
    }
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

  // =========================================================
  // SERVER SETTINGS, STORAGE STATS & EXISTING LIBRARY
  // =========================================================
  async function loadServerSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        if (apiKeyDisplay && data.api_key_masked) {
          apiKeyDisplay.textContent = `API: ${data.api_key_masked}`;
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
          storageStatsLabel.textContent = `${stats.clips_count} clips · ${stats.clips_mb} MB`;
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
      item.className = "bg-surface-950 border border-white/[0.07] rounded-xl p-3 flex items-center justify-between gap-2";
      item.innerHTML = `
        <div class="min-w-0">
          <div class="text-xs font-mono font-semibold text-slate-200 truncate">${f.filename}</div>
          <div class="text-[10px] font-mono text-slate-500">${f.size_mb} MB · Ready MP4</div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <a href="${f.download_url}" download="${f.filename}" class="studio-pressable px-2.5 py-1 rounded-lg bg-brand-600/20 hover:bg-brand-600 text-brand-300 hover:text-white text-[11px] font-semibold">Download</a>
          <button type="button" class="btn-del-lib-clip studio-pressable p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40" data-filename="${f.filename}" title="Delete file">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
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
        // Release open MP4 handle in Chrome before asking server to delete file on Windows
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
          showToast(d.message || "Wiped all rendered clips & temporary storage");
        }
      } catch (_) {
        showToast("Unable to clear storage", true);
      }
    });
  }

  // Modal Settings
  if (btnApiSettings) {
    btnApiSettings.addEventListener("click", () => {
      settingsModal.classList.remove("hidden");
    });
  }
  [btnCloseSettings, btnCancelSettings].forEach((btn) => {
    if (btn) btn.addEventListener("click", () => settingsModal.classList.add("hidden"));
  });
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const val = (inputSettingsApiKey.value || "").trim();
      if (!val) return showToast("Enter a valid API key", true);
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: val }),
      });
      if (res.ok) {
        const d = await res.json();
        if (apiKeyDisplay && d.api_key_masked) apiKeyDisplay.textContent = `API: ${d.api_key_masked}`;
        settingsModal.classList.add("hidden");
        showToast("API key updated cleanly");
      }
    });
  }

  // =========================================================
  // LAUNCHER EVENTS: SOURCE TABS, UPLOAD, SWATCHES, PRESETS
  // =========================================================
  if (btnLogoHome) btnLogoHome.addEventListener("click", () => showView("launcher"));
  if (btnNewProject) btnNewProject.addEventListener("click", () => showView("launcher"));

  if (tabSourceYoutube && tabSourceUpload) {
    tabSourceYoutube.addEventListener("click", () => {
      youtubeSourcePanel.classList.remove("hidden");
      uploadSourcePanel.classList.add("hidden");
      tabSourceYoutube.className = "source-tab-btn px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 studio-pressable";
      tabSourceUpload.className = "source-tab-btn px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 studio-pressable";
    });
    tabSourceUpload.addEventListener("click", () => {
      uploadSourcePanel.classList.remove("hidden");
      youtubeSourcePanel.classList.add("hidden");
      tabSourceUpload.className = "source-tab-btn px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 studio-pressable";
      tabSourceYoutube.className = "source-tab-btn px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 studio-pressable";
    });
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
      uploadLabelText.textContent = `Uploaded: ${file.name}`;
      showToast(`Uploaded ${file.name} — starting AutoCut!`);
      triggerAnalyze(data.url);
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
      dropZone.classList.add("border-brand-500");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("border-brand-500"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-brand-500");
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
          showToast("Pasted link from clipboard");
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
      triggerAnalyze(target);
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
    const url = urlInput.value.trim();
    if (!url) return showToast("Please enter a YouTube link or upload a video", true);
    triggerAnalyze(url);
  });

  // =========================================================
  // ASYNC JOB PIPELINE & REAL LOADING TELEMETRY
  // =========================================================
  function stopJobTimers() {
    clearTimeout(activePollTimer);
    clearInterval(elapsedTimerInterval);
  }

  function updateProcessingSteps(stepNum, pct, title, detail) {
    progressBar.style.width = `${Math.max(5, Math.min(100, pct))}%`;
    processStatusTitle.textContent = title;
    processStatusDesc.textContent = detail;
    ["step1", "step2", "step3", "step4"].forEach((id, idx) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (idx + 1 < stepNum) {
        el.className = "text-emerald-400 font-semibold";
      } else if (idx + 1 === stepNum) {
        el.className = "text-brand-400 font-bold";
      } else {
        el.className = "text-slate-500";
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

    updateProcessingSteps(1, 10, "Starting AutoCut Engine...", "Validating source URL & initializing pipeline...");

    try {
      const maxClips = parseInt(clipsCountSelect.value, 10) || 12;
      const targetDuration = parseInt(durationSelect.value, 10) || 45;

      if (chkWorkspaceBanner && chkHookBanner) {
        chkWorkspaceBanner.checked = chkHookBanner.checked;
      }
      if (workspaceCaptionSelect) {
        workspaceCaptionSelect.value = captionSelect.value;
      }

      let jobId = null;
      const startRes = await fetch(`${API_BASE}/api/analyze/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, target_duration: targetDuration, max_clips: maxClips }),
      });

      if (startRes.status === 404 || startRes.status === 405) {
        // Fallback to direct synchronous analyze endpoint if async route unavailable
        updateProcessingSteps(2, 48, "2. Running AutoCut Pipeline...", "Extracting transcript and scoring viral moments...");
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
        hydrateWorkspace(syncData);
        showView("workspace");
        showToast(`Extracted ${currentClips.length} viral clips!`);
        return;
      }

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.detail || `Unable to start analysis (HTTP ${startRes.status}).`);
      }

      const startJson = await startRes.json();
      jobId = startJson.job_id;

      // Poll live job state until completed or failed
      const pollJob = async () => {
        if (activeJobCancelled) return;
        const jobRes = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        if (!jobRes.ok) throw new Error("Lost connection to analysis job.");
        const job = await jobRes.json();

        updateProcessingSteps(job.step || 2, job.progress || 40, job.title || "Processing...", job.detail || "");

        if (job.status === "completed" && job.result) {
          stopJobTimers();
          hydrateWorkspace(job.result);
          showView("workspace");
          showToast(`Extracted ${currentClips.length} viral clips!`);
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
  function hydrateWorkspace(data) {
    currentVideoInfo = data.video_info || {};
    currentClips = data.clips || [];
    totalVideoDuration = data.timeline_duration || currentVideoInfo.duration || 600;
    activeCategory = "all";
    sortMode = "timeline";
    if (sortClipsSelect) sortClipsSelect.value = "timeline";
    if (chkSelectAllClips) chkSelectAllClips.checked = false;

    const srcType = currentVideoInfo.is_demo ? "DEMO STUDIO" : currentVideoInfo.is_local ? "LOCAL UPLOAD" : "YOUTUBE LIVE";
    headerSourceBadge.textContent = srcType;
    headerVideoTitle.textContent = currentVideoInfo.title || "Untitled Video";

    videoTitle.textContent = currentVideoInfo.title || "Analyzed Video";
    videoChannel.textContent = currentVideoInfo.channel || "Creator";
    videoThumb.src = currentVideoInfo.thumbnail || "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80";
    timelineDurationBadge.textContent = formatTime(totalVideoDuration);
    clipsFoundBadge.textContent = `${currentClips.length} Viral Clips Found`;
    countAll.textContent = String(currentClips.length);

    syncAspectButtonsFromSelect();
    renderTimelineHeatmap();
    buildDynamicCategoryFilters();
    renderClipsQueue();
    updateBatchCountLabel();

    if (currentClips.length > 0) {
      selectClip(currentClips[0]);
      // Auto-render Clip #1 in background so user immediately gets a real 1080p MP4 preview & download
      renderAndPlayClip(currentClips[0]);
    }
  }

  function renderTimelineHeatmap() {
    timelineTrack.innerHTML = "";
    const totalSecs = Math.max(1, totalVideoDuration);

    currentClips.forEach((clip) => {
      const leftPct = Math.min(96, Math.max(0.5, (clip.start_time / totalSecs) * 100));
      const widthPct = Math.max(1.8, Math.min(100 - leftPct, (clip.duration / totalSecs) * 100));
      const span = document.createElement("div");
      const scoreColor = clip.score >= 92 ? "bg-emerald-500" : clip.score >= 85 ? "bg-brand-500" : "bg-amber-500";
      const isSelected = activeClip && activeClip.id === clip.id;

      span.className = `heatmap-span absolute top-1 bottom-1 rounded cursor-pointer group ${scoreColor} ${isSelected ? "opacity-100 ring-2 ring-white" : "opacity-65"}`;
      span.style.left = `${leftPct}%`;
      span.style.width = `${widthPct}%`;
      span.dataset.markerClipId = clip.id;

      span.innerHTML = `
        <div class="hidden group-hover:block absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-900 border border-white/[0.15] text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-2xl whitespace-nowrap z-50 font-mono">
          #${clip.index} · ${formatTime(clip.start_time)}–${formatTime(clip.end_time)} (${Math.round(clip.duration)}s) · Score ${clip.score}
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
      btn.className = `studio-pressable px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
        isActive
          ? "bg-brand-600 text-white border-brand-500"
          : "bg-surface-950 hover:bg-surface-850 text-slate-300 border-white/[0.07]"
      }`;
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
      clipCardsList.innerHTML = `<div class="text-xs text-slate-500 text-center py-8">No clips match this category.</div>`;
      return;
    }

    filteredClips.forEach((clip) => {
      const card = document.createElement("div");
      const isActive = activeClip && activeClip.id === clip.id;
      const rendered = renderedClipsMap[clip.id];
      const isFreshRendered = rendered && rendered.signature === getClipSignature(clip);
      const isStaleRendered = rendered && !isFreshRendered;

      card.className = `p-3 rounded-xl border cursor-pointer transition-colors space-y-2 ${
        isActive
          ? "bg-surface-850 border-brand-500/70"
          : "bg-surface-950/80 hover:bg-surface-850/70 border-white/[0.07]"
      }`;
      card.dataset.clipId = clip.id;

      const statusBadge = isFreshRendered
        ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">MP4 READY</span>`
        : isStaleRendered
        ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">MODIFIED</span>`
        : `<span class="px-1.5 py-0.5 rounded bg-surface-800 text-slate-400 text-[10px] font-mono">READY TO CUT</span>`;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <input type="checkbox" class="clip-batch-chk rounded border-white/20 bg-surface-900 text-brand-500 focus:ring-0" ${selectedClipIds.has(clip.id) ? "checked" : ""} />
            <span class="text-xs font-mono font-bold text-slate-400">#${clip.index}</span>
            <span class="px-1.5 py-0.5 rounded border text-[10px] font-semibold ${clip.category_badge || "bg-brand-500/15 text-brand-300 border-brand-500/30"}">${clip.category}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold shrink-0">${clip.score}</span>
        </div>

        <h4 class="text-xs font-bold text-white leading-snug line-clamp-2">${clip.hook_title}</h4>

        <div class="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-400">
          <span>${formatTime(clip.start_time)}–${formatTime(clip.end_time)} · ${Math.round(clip.duration)}s</span>
          <div class="flex items-center gap-1.5">
            ${statusBadge}
            <button type="button" class="btn-card-render studio-pressable px-2.5 py-1 rounded-lg ${isFreshRendered ? "bg-emerald-600 hover:bg-emerald-500" : "bg-brand-600 hover:bg-brand-500"} text-white font-sans font-semibold text-[11px]">
              ${isFreshRendered ? "Play" : "Cut"}
            </button>
            <button type="button" class="btn-card-download studio-pressable p-1.5 rounded-lg bg-surface-850 hover:bg-emerald-600 text-slate-300 hover:text-white border border-white/[0.08]" title="Download MP4">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
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

      card.querySelector(".btn-card-render").addEventListener("click", (e) => {
        e.stopPropagation();
        selectClip(clip);
        if (isFreshRendered) {
          loadVideoPlayer(rendered);
        } else {
          renderAndPlayClip(clip);
        }
      });

      const btnDl = card.querySelector(".btn-card-download");
      if (btnDl) {
        btnDl.addEventListener("click", async (e) => {
          e.stopPropagation();
          selectClip(clip);
          if (isFreshRendered && rendered && rendered.download_url) {
            triggerFileDownload(rendered.download_url, rendered.filename || `shortcut_short_${clip.index}.mp4`);
            showToast(`Downloading Short #${clip.index}...`);
          } else {
            showToast(`Cutting 1080p short #${clip.index} before download...`);
            const clipData = await renderAndPlayClip(clip);
            if (clipData && clipData.download_url) {
              triggerFileDownload(clipData.download_url, clipData.filename || `shortcut_short_${clip.index}.mp4`);
              showToast(`Downloaded Short #${clip.index}!`);
            }
          }
        });
      }

      card.addEventListener("click", () => selectClip(clip));
      clipCardsList.appendChild(card);
    });
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
    batchBtnLabel.textContent = n > 0 ? `Batch Render Selected (${n})` : `Batch Render Top 5`;
  }

  // =========================================================
  // CLIP SELECTION, STAGE PREVIEW & INSPECTOR SYNC
  // =========================================================
  function selectClip(clip) {
    activeClip = clip;
    renderTimelineHeatmap();
    renderClipsQueue();

    // Sync Inspector fields
    if (inputHookTitle) inputHookTitle.value = clip.hook_title || "";
    updateTrimmerUI();
    updateInspectorMetrics(clip);
    renderInteractiveTranscript(clip);

    const seo = clip.youtube_shorts_seo || {};
    if (seoPreviewText) {
      seoPreviewText.textContent = `${seo.title || clip.hook_title} · ${(seo.tags || clip.hashtags || []).join(" ")}`;
    }

    // Check rendered clip freshness
    const rendered = renderedClipsMap[clip.id];
    const isFresh = rendered && rendered.signature === getClipSignature(clip);

    if (isFresh) {
      loadVideoPlayer(rendered);
      initWaveform(rendered.waveform || clip.waveform_preview);
    } else {
      previewVideo.pause();
      previewVideo.classList.add("hidden");
      if (btnToggleSound) btnToggleSound.classList.add("hidden");

      // Check if YouTube source preview is available
      const isYt = currentVideoInfo && !currentVideoInfo.is_demo && !currentVideoInfo.is_local && currentVideoInfo.id && currentVideoInfo.id.length === 11;
      if (isYt && sourceYoutubeFrame) {
        playerPlaceholder.classList.add("hidden");
        sourceYoutubeFrame.classList.remove("hidden");
        const startSec = Math.max(0, Math.floor(clip.start_time));
        const endSec = Math.max(startSec + 2, Math.ceil(clip.end_time));
        sourceYoutubeFrame.src = `https://www.youtube-nocookie.com/embed/${currentVideoInfo.id}?start=${startSec}&end=${endSec}&autoplay=1&controls=1&playsinline=1&rel=0`;
      } else {
        if (sourceYoutubeFrame) {
          sourceYoutubeFrame.src = "";
          sourceYoutubeFrame.classList.add("hidden");
        }
        playerPlaceholder.classList.remove("hidden");
      }

      if (btnDownloadClip) {
        btnDownloadClip.classList.remove("pointer-events-none", "opacity-45");
        const span = btnDownloadClip.querySelector("span");
        if (span) span.textContent = "Cut & Download MP4";
      }

      renderStatusHint.textContent = rendered
        ? "Settings changed — click below to re-cut MP4"
        : "Click below to cut & burn 1080p MP4";
      updateLiveStagePreview();
      initWaveform(clip.waveform_preview);
    }
  }

  function updateLiveStagePreview() {
    if (!activeClip) return;
    if (stageCategoryPill) stageCategoryPill.textContent = activeClip.category || "Viral Moment";
    if (stageTimestamp) {
      stageTimestamp.textContent = `${formatTime(activeClip.start_time)} – ${formatTime(activeClip.end_time)} (${Math.round(activeClip.duration)}s)`;
    }

    const bannerOn = chkWorkspaceBanner ? chkWorkspaceBanner.checked : true;
    if (liveBannerPreview) {
      liveBannerPreview.classList.toggle("hidden", !bannerOn);
      liveBannerPreview.textContent = (activeClip.hook_title || "Viral Clip").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
    }

    const styleId = workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value;
    const samples = {
      hormozi: `<span class="text-white">VOLUME </span><span class="px-1.5 py-0.5 rounded bg-emerald-500 text-black">CREATES</span><span class="text-white"> SKILL</span>`,
      mrbeast: `<span class="text-yellow-300">WAIT </span><span class="text-rose-500 scale-110 inline-block">FOR IT!</span>`,
      tiktok: `<span class="text-white">Pace is </span><span class="text-[#FE2C55]">everything</span>`,
      neon: `<span class="text-cyan-300">GO </span><span class="text-fuchsia-400">10X FASTER</span>`,
      minimal: `<span class="px-2 py-0.5 rounded bg-black/80 text-white font-semibold normal-case text-xs">Consistent pacing wins</span>`,
      podcast: `<span class="text-white">Master the </span><span class="text-amber-400">story arc</span>`,
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
          const updated = prompt("Edit spoken caption word:", w.word);
          if (updated !== null && updated.trim()) {
            if (!clip.custom_words) clip.custom_words = words.map((x) => ({ ...x }));
            clip.custom_words[idx].word = updated.trim();
            renderInteractiveTranscript(clip);
            renderClipsQueue();
            showToast("Caption word updated — re-render to burn into MP4");
          }
          return;
        }
        const rendered = renderedClipsMap[clip.id];
        if (rendered && rendered.signature === getClipSignature(clip)) {
          previewVideo.currentTime = Math.max(0, w.start - clip.start_time);
          previewVideo.play().catch(() => {});
        } else {
          showToast(`Timestamp ${formatTime(w.start)} — click Cut & Render Clip to seek playback`);
        }
      });

      inspectorTranscriptBox.appendChild(span);
    });
  }

  if (btnToggleEditWords) {
    btnToggleEditWords.addEventListener("click", () => {
      isEditWordsMode = !isEditWordsMode;
      btnToggleEditWords.textContent = isEditWordsMode ? "Done Editing" : "Edit Words";
      btnToggleEditWords.className = isEditWordsMode
        ? "studio-pressable px-2 py-0.5 rounded bg-brand-600 text-white text-[10px] font-mono font-bold"
        : "studio-pressable px-2 py-0.5 rounded bg-surface-950 hover:bg-surface-800 border border-white/[0.08] text-[10px] font-mono text-brand-300";
      if (transcriptHelpHint) {
        transcriptHelpHint.textContent = isEditWordsMode
          ? "Edit Mode Active: click any word below to rename before burning subtitles"
          : 'Click any word to jump playback · Click "Edit Words" to correct spelling before render';
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
    if (stageTimestamp) stageTimestamp.textContent = `${formatTime(activeClip.start_time)} – ${formatTime(activeClip.end_time)} (${dur}s)`;
  }

  function onClipEdited(refreshQueue = true) {
    if (!activeClip) return;
    updateTrimmerUI();
    renderInteractiveTranscript(activeClip);
    updateLiveStagePreview();
    if (refreshQueue) renderClipsQueue();
    // Reflect stale notice if this clip had an older MP4
    const rendered = renderedClipsMap[activeClip.id];
    if (rendered && rendered.signature !== getClipSignature(activeClip)) {
      previewVideo.pause();
      previewVideo.classList.add("hidden");
      playerPlaceholder.classList.remove("hidden");
      if (btnToggleSound) btnToggleSound.classList.add("hidden");
      renderStatusHint.textContent = "Edited — click Cut & Render Clip to update MP4";
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
      const isMatch = b.dataset.aspect === aspect;
      b.className = isMatch
        ? "aspect-btn active px-2.5 py-1 rounded-md bg-brand-600 text-white font-bold studio-pressable"
        : "aspect-btn px-2.5 py-1 rounded-md text-slate-400 hover:text-white font-medium studio-pressable";
    });
    if (!deviceFrame) return;
    if (aspect === "1:1") {
      deviceFrame.className = "w-full max-w-[300px] aspect-square bg-black rounded-[24px] p-2 border-2 border-surface-750 shadow-2xl relative overflow-hidden flex flex-col";
      layoutSelect.value = "square_1_1";
    } else if (aspect === "16:9") {
      deviceFrame.className = "w-full max-w-[360px] aspect-[16/9] bg-black rounded-[18px] p-2 border-2 border-surface-750 shadow-2xl relative overflow-hidden flex flex-col";
      layoutSelect.value = "landscape_16_9";
    } else {
      deviceFrame.className = "w-full max-w-[265px] aspect-[9/16] bg-black rounded-[28px] p-2 border-2 border-surface-750 shadow-2xl relative overflow-hidden flex flex-col";
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
      showToast(`Switched aspect ratio to ${btn.dataset.aspect}`);
    });
  });

  // =========================================================
  // RENDERING, VIDEO PLAYBACK & REAL AUDIO WAVEFORM
  // =========================================================
  function triggerFileDownload(url, filename) {
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = filename || "shortcut_short.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function renderAndPlayClip(clip) {
    if (!clip) return null;
    const signature = getClipSignature(clip);
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
        throw new Error(err.detail || "Clip render failed.");
      }

      const clipData = await res.json();
      clipData.signature = signature;
      renderedClipsMap[clip.id] = clipData;

      if (activeClip && activeClip.id === clip.id) {
        loadVideoPlayer(clipData);
        initWaveform(clipData.waveform || clip.waveform_preview);
      }
      renderClipsQueue();
      refreshStorageAndLibrary();
      showToast(`Short #${clip.index} ready (${clipData.size_mb} MB)`);
      return clipData;
    } catch (err) {
      showToast(err.message || "Failed to render video short", true);
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

  function loadVideoPlayer(clipData) {
    if (sourceYoutubeFrame) {
      sourceYoutubeFrame.src = "";
      sourceYoutubeFrame.classList.add("hidden");
    }
    playerPlaceholder.classList.add("hidden");
    previewVideo.classList.remove("hidden");
    if (btnToggleSound) btnToggleSound.classList.remove("hidden");

    const streamUrl = (clipData.stream_url && clipData.stream_url.startsWith("http"))
      ? clipData.stream_url
      : `${API_BASE}${clipData.stream_url || clipData.download_url}`;

    previewVideo.src = streamUrl;
    previewVideo.playbackRate = speedSteps[speedIdx];
    previewVideo.load();
    const playPromise = previewVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to muted playback if browser policy restricts autoplay with audio
        previewVideo.muted = true;
        if (soundIcon) soundIcon.setAttribute("data-lucide", "volume-x");
        refreshIcons();
        previewVideo.play().catch(() => {});
      });
    }

    if (btnDownloadClip) {
      btnDownloadClip.classList.remove("pointer-events-none", "opacity-45");
      const span = btnDownloadClip.querySelector("span");
      if (span) span.textContent = `Download 1080p MP4 (${clipData.size_mb || 1.2} MB)`;
    }
  }

  if (btnDownloadClip) {
    btnDownloadClip.addEventListener("click", async () => {
      if (!activeClip) return;
      const rendered = renderedClipsMap[activeClip.id];
      const isFresh = rendered && rendered.signature === getClipSignature(activeClip);

      if (isFresh && rendered.download_url) {
        triggerFileDownload(rendered.download_url, rendered.filename || `shortcut_short_${activeClip.index}.mp4`);
        showToast(`Downloading Short #${activeClip.index} (${rendered.size_mb || '1.2'} MB)...`);
      } else {
        showToast(`Cutting 1080p short #${activeClip.index} before download...`);
        const clipData = await renderAndPlayClip(activeClip);
        if (clipData && clipData.download_url) {
          triggerFileDownload(clipData.download_url, clipData.filename || `shortcut_short_${activeClip.index}.mp4`);
          showToast(`Downloaded Short #${activeClip.index}!`);
        }
      }
    });
  }

  if (btnToggleSound) {
    btnToggleSound.addEventListener("click", () => {
      previewVideo.muted = !previewVideo.muted;
      soundIcon.setAttribute("data-lucide", previewVideo.muted ? "volume-x" : "volume-2");
      soundIcon.className = previewVideo.muted ? "w-3.5 h-3.5 text-amber-400" : "w-3.5 h-3.5 text-emerald-400";
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

  function initWaveform(peaksArray) {
    if (!waveformContainer) return;
    const peaks = Array.isArray(peaksArray) && peaksArray.length >= 16
      ? peaksArray
      : [35, 60, 75, 45, 88, 70, 40, 82, 95, 58, 68, 90, 52, 42, 78, 84, 62, 88, 96, 72, 48, 66, 80, 92, 84, 68, 56, 86, 94, 52, 44, 78, 90, 70, 58, 82, 96, 86, 62, 48, 72, 84, 92, 68, 54, 78, 88, 58];

    waveformContainer.innerHTML = `<div id="waveformPlayhead" class="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-20 pointer-events-none" style="left: 0%"></div>`;
    peaks.forEach((h) => {
      const bar = document.createElement("div");
      bar.className = "waveform-bar flex-1 rounded-sm bg-surface-750 opacity-50";
      bar.style.height = `${Math.max(12, Math.min(100, h))}%`;
      waveformContainer.appendChild(bar);
    });

    waveformContainer.onclick = (e) => {
      if (!previewVideo || !previewVideo.duration) return;
      const rect = waveformContainer.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      previewVideo.currentTime = pct * previewVideo.duration;
      previewVideo.play().catch(() => {});
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
        b.className = idx <= activeIdx
          ? "waveform-bar flex-1 rounded-sm bg-brand-400 opacity-95"
          : "waveform-bar flex-1 rounded-sm bg-surface-750 opacity-50";
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
      showToast(`Copied SEO Title & Hashtags for Clip #${activeClip.index}`);
    });
  }

  async function runBatchRender(targets) {
    for (let i = 0; i < targets.length; i++) {
      const clip = targets[i];
      if (batchBtnLabel) batchBtnLabel.textContent = `Rendering ${i + 1}/${targets.length}...`;
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
      showToast(`Batch rendering ${targets.length} clips...`);

      await runBatchRender(targets);

      btnBatchRenderAll.disabled = false;
      updateBatchCountLabel();
      refreshStorageAndLibrary();
      if (activeClip && renderedClipsMap[activeClip.id]) {
        selectClip(activeClip);
      }
      showToast(`Batch complete — ${targets.length} clips ready for .ZIP export!`);
    });
  }

  async function triggerZipExport() {
    const renderedList = Object.values(renderedClipsMap).filter((c) => c && c.filename);

    if (renderedList.length === 0) {
      if (!currentClips.length) {
        showToast("No clips available to export", true);
        return;
      }
      showToast("Batch rendering top clips for .ZIP pack...", false);
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "ZIP export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shortcut_viral_shorts_pack.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Downloaded all clips in .ZIP pack!");
    } catch (err) {
      showToast(err.message || "Failed to download .ZIP pack", true);
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
