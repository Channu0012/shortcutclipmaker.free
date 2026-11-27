// klipnux Studio Controller
document.addEventListener("DOMContentLoaded", () => {
  const refreshIcons = () => {
    if (window.lucide) window.lucide.createIcons();
  };
  refreshIcons();

  const LS_COOKIES_KEY = "klipnux_yt_cookies";
  const LS_API_BASE_KEY = "klipnux_api_base";

  function getStoredCookies() {
    try {
      return (localStorage.getItem(LS_COOKIES_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function setStoredCookies(val) {
    try {
      const clean = (val || "").trim();
      if (clean) localStorage.setItem(LS_COOKIES_KEY, clean);
      else localStorage.removeItem(LS_COOKIES_KEY);
    } catch (_) {}
  }

  function getStoredApiBase() {
    try {
      return (localStorage.getItem(LS_API_BASE_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function setStoredApiBase(val) {
    try {
      const clean = (val || "").trim();
      if (clean) localStorage.setItem(LS_API_BASE_KEY, clean);
      else localStorage.removeItem(LS_API_BASE_KEY);
    } catch (_) {}
  }

  let API_BASE = getStoredApiBase() || (window.location.protocol.startsWith("http") ? "" : "http://127.0.0.1:8000");
  let isServerlessEnv = false;
  let apiConnected = false;
  let localClientSession = null;

  async function probeHealthEndpoint(base, timeoutMs = 2200) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(`${base}/api/health`, controller ? { signal: controller.signal } : {});
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data && data.service) return data;
    } catch (_) {
    } finally {
      if (timer) clearTimeout(timer);
    }
    return null;
  }

  async function resolveWorkingApiBase(forceRetryLocal = false) {
    const stored = forceRetryLocal ? "" : getStoredApiBase();
    const rawCandidates = stored
      ? [stored, ...(window.location.protocol.startsWith("http") ? ["", "http://127.0.0.1:8000", "http://localhost:8000"] : ["http://127.0.0.1:8000", "http://localhost:8000"])]
      : (window.location.protocol.startsWith("http")
        ? ["", API_BASE, "http://127.0.0.1:8000", "http://localhost:8000"]
        : ["http://127.0.0.1:8000", "http://localhost:8000", ""]);
    const candidates = Array.from(new Set(rawCandidates.filter((v) => v !== null && v !== undefined)));

    for (const base of candidates) {
      const data = await probeHealthEndpoint(base);
      if (data) {
        API_BASE = base;
        apiConnected = true;
        isServerlessEnv = Boolean(data.serverless);
        if (typeof updateEngineModeUI === "function") updateEngineModeUI();
        return base;
      }
    }
    apiConnected = false;
    if (typeof updateEngineModeUI === "function") updateEngineModeUI();
    return null;
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
  let activeSourceMode = "upload";
  let isPlayingLiveSource = false;
  const speedSteps = [1, 1.25, 1.5, 2];
  let speedIdx = 0;

  // View Containers
  const launcherView = document.getElementById("launcherView");
  const processingSection = document.getElementById("processingSection");
  const resultsSection = document.getElementById("resultsSection");
  const headerProjectMeta = document.getElementById("headerProjectMeta");
  const headerSourceBadge = document.getElementById("headerSourceBadge");
  const headerVideoTitle = document.getElementById("headerVideoTitle");
  const navHowItWorks = document.getElementById("navHowItWorks");
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
  const btnShowcaseDemo = document.getElementById("btnShowcaseDemo");

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
  const btnClearCookies = document.getElementById("btnClearCookies");
  const cookiesStatusHint = document.getElementById("cookiesStatusHint");
  const engineModeHint = document.getElementById("engineModeHint");
  const btnToggleLocalEngine = document.getElementById("btnToggleLocalEngine");

  // Launcher Controls
  const tabSourceYoutube = document.getElementById("tabSourceYoutube");
  const tabSourceUpload = document.getElementById("tabSourceUpload");
  const youtubeSourcePanel = document.getElementById("youtubeSourcePanel");
  const uploadSourcePanel = document.getElementById("uploadSourcePanel");
  const fileUploadInput = document.getElementById("fileUploadInput");
  const dropZone = document.getElementById("dropZone");
  const uploadLabelText = document.getElementById("uploadLabelText");
  const fileUploadMeta = document.getElementById("fileUploadMeta");
  const metaFileName = document.getElementById("metaFileName");
  const metaFileDetails = document.getElementById("metaFileDetails");
  const btnMetaProceed = document.getElementById("btnMetaProceed");

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
  const timelineTrackContainer = document.getElementById("timelineTrackContainer");
  const timelineTrack = document.getElementById("timelineTrack");
  const btnAddNewClip = document.getElementById("btnAddNewClip");
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
  const previewBackdrop = document.getElementById("previewBackdrop");
  const previewVideo = document.getElementById("previewVideo");
  const liveBannerOverlay = document.getElementById("liveBannerOverlay");
  const liveBannerOverlayText = document.getElementById("liveBannerOverlayText");
  const liveSubtitleTrack = document.getElementById("liveSubtitleTrack");
  const liveCaptionBox = document.getElementById("liveCaptionBox");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const playPauseIcon = document.getElementById("playPauseIcon");
  const btnJumpBack = document.getElementById("btnJumpBack");
  const btnJumpForward = document.getElementById("btnJumpForward");
  const btnSetMarkIn = document.getElementById("btnSetMarkIn");
  const btnSetMarkOut = document.getElementById("btnSetMarkOut");
  const playheadTimecode = document.getElementById("playheadTimecode");
  const waveformCutRange = document.getElementById("waveformCutRange");
  const studioFilterSelect = document.getElementById("studioFilterSelect");
  const studioFitSelect = document.getElementById("studioFitSelect");
  const studioPanSelect = document.getElementById("studioPanSelect");
  const studioZoomSelect = document.getElementById("studioZoomSelect");
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
  const btnStageUseLocal = document.getElementById("btnStageUseLocal");
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
  const btnOpenCaptionComposer = document.getElementById("btnOpenCaptionComposer");
  const captionSizeSelect = document.getElementById("captionSizeSelect");
  const captionPosSelect = document.getElementById("captionPosSelect");
  const captionComposerDrawer = document.getElementById("captionComposerDrawer");
  const captionScriptInput = document.getElementById("captionScriptInput");
  const btnVoiceDictate = document.getElementById("btnVoiceDictate");
  const btnApplyCaptionScript = document.getElementById("btnApplyCaptionScript");
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
  // APPLE-STYLE ON-SCROLL REVEALS & PARALLAX
  // =========================================================
  function initScrollMotion() {
    const revealEls = document.querySelectorAll(".kn-reveal");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach((el) => observer.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("in-view"));
    }

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parallaxEl = document.querySelector("[data-parallax]");
    if (parallaxEl && !reducedMotion) {
      let ticking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (launcherView.classList.contains("hidden") || ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const rect = parallaxEl.getBoundingClientRect();
            const vh = window.innerHeight || 800;
            if (rect.top < vh && rect.bottom > 0) {
              const centerDist = (rect.top + rect.height * 0.5 - vh * 0.5) / vh;
              const ty = Math.max(-14, Math.min(14, centerDist * 22));
              const scale = Math.max(0.98, 1 - Math.abs(centerDist) * 0.025);
              parallaxEl.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
            }
            ticking = false;
          });
        },
        { passive: true }
      );
    }
  }
  initScrollMotion();

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
      toastBox.style.borderColor = "rgba(17, 19, 25, 0.08)";
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
      urlStatusHint.textContent = activeSourceMode === "upload"
        ? "Direct file uploads work offline for any size or length"
        : "Paste any public YouTube link";
      urlStatusHint.style.color = "var(--text-secondary)";
      return false;
    }
    if (extractYouTubeId(val)) {
      urlStatusHint.textContent = val.startsWith("local://") ? "Uploaded video ready" : "Link ready";
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
        if (val.startsWith("local://")) {
          let cleanFile = val.replace("local://browser/", "").replace("local://", "");
          try { cleanFile = decodeURIComponent(cleanFile); } catch (_) {}
          step2SourceSummary.textContent = `File: ${cleanFile}`;
        } else {
          step2SourceSummary.textContent = val;
        }
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
      document.body.classList.remove("in-workspace");
      launcherView.classList.remove("hidden");
      headerProjectMeta.classList.add("hidden");
      btnNewProject.classList.add("hidden");
      btnDownloadAllTop.classList.add("hidden");
      if (navHowItWorks) navHowItWorks.classList.remove("hidden");
      setWizardStep(1, "back");
      refreshStorageStats();
    } else if (viewName === "processing") {
      document.body.classList.remove("in-workspace");
      processingSection.classList.remove("hidden");
      headerProjectMeta.classList.add("hidden");
      btnNewProject.classList.add("hidden");
      btnDownloadAllTop.classList.add("hidden");
      if (navHowItWorks) navHowItWorks.classList.add("hidden");
      if (wizPill2) wizPill2.className = "kn-wiz-step done";
      if (wizPill3) wizPill3.className = "kn-wiz-step active";
    } else if (viewName === "workspace") {
      document.body.classList.add("in-workspace");
      resultsSection.classList.remove("hidden");
      headerProjectMeta.classList.remove("hidden");
      headerProjectMeta.style.display = "flex";
      btnNewProject.classList.remove("hidden");
      btnDownloadAllTop.classList.remove("hidden");
      if (navHowItWorks) navHowItWorks.classList.add("hidden");
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
        sub.style.color = isMatch ? "var(--brand-violet)" : "var(--text-secondary)";
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
        return showToast("Choose or drop an MP4, MOV, or WEBM file first", true);
      }
      if (!validateSourceInline()) {
        urlInput.focus();
        return showToast("Paste a YouTube link first, or tap Instant Studio Demo", true);
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
    const grade = studioFilterSelect ? studioFilterSelect.value : "none";
    const pan = studioPanSelect ? studioPanSelect.value : "center";
    const zoom = studioZoomSelect ? studioZoomSelect.value : "1";
    const cSize = captionSizeSelect ? captionSizeSelect.value : "1";
    const cPos = captionPosSelect ? captionPosSelect.value : "bottom";
    const wordsSig = (clip.custom_words || []).map((w) => w.word).join(" ");
    return `${Number(clip.start_time).toFixed(2)}|${Number(clip.end_time).toFixed(2)}|${clip.hook_title}|${layout}|${caption}|${bannerOn}|${grade}|${pan}|${zoom}|${cSize}|${cPos}|${wordsSig}`;
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
  // =========================================================
  // SERVER SETTINGS, ENGINE MODE & STORAGE STATS
  // =========================================================
  function updateCookiesHint(serverHasCookies = false) {
    const localCookies = getStoredCookies();
    if (inputSettingsCookies && localCookies && !inputSettingsCookies.value) {
      inputSettingsCookies.value = localCookies;
    }
    if (!cookiesStatusHint) return;
    if (localCookies) {
      cookiesStatusHint.textContent = "YouTube cookies saved in browser (sent per cut request)";
      cookiesStatusHint.style.color = "var(--success)";
    } else if (serverHasCookies) {
      cookiesStatusHint.textContent = "YouTube cookies active on server";
      cookiesStatusHint.style.color = "var(--success)";
    } else {
      cookiesStatusHint.textContent = "Not configured (paste Netscape cookies.txt from a signed-in browser tab to fix cloud YouTube blocks)";
      cookiesStatusHint.style.color = "var(--text-secondary)";
    }
  }

  function updateEngineModeUI() {
    const forcedLocal = getStoredApiBase().includes("127.0.0.1") || getStoredApiBase().includes("localhost");
    const isUsingLocal = API_BASE.includes("127.0.0.1") || API_BASE.includes("localhost");
    if (engineModeHint) {
      if (!apiConnected) {
        engineModeHint.textContent = "Offline / Browser File Engine only";
        engineModeHint.style.color = "var(--warning, #d97706)";
      } else if (forcedLocal || isUsingLocal) {
        engineModeHint.textContent = `Local Engine Connected (${API_BASE || "localhost:8000"})`;
        engineModeHint.style.color = "var(--success)";
      } else if (isServerlessEnv) {
        engineModeHint.textContent = "Cloud Serverless (Browser Engine for MP4 uploads)";
        engineModeHint.style.color = "var(--text-secondary)";
      } else {
        engineModeHint.textContent = "Connected (Full Native Engine)";
        engineModeHint.style.color = "var(--success)";
      }
    }
    if (btnToggleLocalEngine) {
      btnToggleLocalEngine.textContent = forcedLocal ? "Switch to Auto" : "Use localhost:8000";
    }
    if (btnStageUseLocal) {
      const showLocalBtn = isServerlessEnv || !apiConnected || (!isUsingLocal && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost");
      btnStageUseLocal.classList.toggle("hidden", !showLocalBtn);
    }
  }

  async function switchToLocalEngine(silent = false) {
    for (const candidate of ["http://127.0.0.1:8000", "http://localhost:8000"]) {
      const data = await probeHealthEndpoint(candidate, 2500);
      if (data) {
        API_BASE = candidate;
        apiConnected = true;
        isServerlessEnv = Boolean(data.serverless);
        setStoredApiBase(candidate);
        updateEngineModeUI();
        await loadServerSettings();
        if (!silent) showToast(`Connected to Local Engine (${candidate})`);
        return true;
      }
    }
    if (!silent) {
      showToast("Local Engine not reachable on port 8000. Run python run.py on your machine first.", true);
    }
    return false;
  }

  async function loadServerSettings() {
    updateCookiesHint(false);
    updateEngineModeUI();
    if (!apiConnected) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        if (apiKeyDisplay && data.api_key_masked) {
          apiKeyDisplay.textContent = `(${data.api_key_masked})`;
        }
        updateCookiesHint(Boolean(data.cookies_configured));
      }
    } catch (_) {}
  }

  async function refreshStorageStats() {
    if (!apiConnected) return;
    try {
      const statsRes = await fetch(`${API_BASE}/api/storage-stats`);
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (storageStatsLabel) {
          storageStatsLabel.textContent = `${stats.clips_count} clips (${stats.clips_mb} MB)`;
        }
      }
    } catch (_) {}
  }

  if (btnClearStorage) {
    btnClearStorage.addEventListener("click", async () => {
      try {
        if (previewVideo) {
          previewVideo.pause();
          previewVideo.removeAttribute("src");
          previewVideo.load();
        }
        if (apiConnected) {
          const res = await fetch(`${API_BASE}/api/clear-storage`, { method: "POST" });
          if (res.ok) {
            const d = await res.json().catch(() => ({}));
            renderedClipsMap = {};
            if (activeClip) selectClip(activeClip);
            await refreshStorageStats();
            showToast(d.message || "Cleared temporary cache");
            return;
          }
        }
        renderedClipsMap = {};
        if (activeClip) selectClip(activeClip);
        showToast("Cleared cached preview clips");
      } catch (_) {
        showToast("Unable to clear cache", true);
      }
    });
  }

  // Settings Modal
  if (btnApiSettings) {
    btnApiSettings.addEventListener("click", () => {
      updateCookiesHint(false);
      updateEngineModeUI();
      refreshStorageStats();
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

  if (btnClearCookies) {
    btnClearCookies.addEventListener("click", async () => {
      setStoredCookies("");
      if (inputSettingsCookies) inputSettingsCookies.value = "";
      updateCookiesHint(false);
      if (apiConnected) {
        await fetch(`${API_BASE}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies_txt: "" }),
        }).catch(() => {});
      }
      showToast("Cleared YouTube cookies");
    });
  }

  if (btnToggleLocalEngine) {
    btnToggleLocalEngine.addEventListener("click", async () => {
      const forcedLocal = getStoredApiBase().includes("127.0.0.1") || getStoredApiBase().includes("localhost");
      if (forcedLocal) {
        setStoredApiBase("");
        API_BASE = window.location.protocol.startsWith("http") ? "" : "http://127.0.0.1:8000";
        await resolveWorkingApiBase(true);
        await loadServerSettings();
        showToast("Switched back to Auto / Cloud Engine");
      } else {
        await switchToLocalEngine(false);
      }
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const apiKeyVal = (inputSettingsApiKey.value || "").trim();
      const cookiesVal = inputSettingsCookies ? inputSettingsCookies.value.trim() : "";
      const bodyPayload = {};
      if (apiKeyVal) bodyPayload.api_key = apiKeyVal;
      if (cookiesVal) {
        bodyPayload.cookies_txt = cookiesVal;
        setStoredCookies(cookiesVal);
      } else if (getStoredCookies() && inputSettingsCookies && inputSettingsCookies.value.trim() === "") {
        setStoredCookies("");
        bodyPayload.cookies_txt = "";
      }

      if (!apiKeyVal && bodyPayload.cookies_txt === undefined) {
        return showToast("Enter an API key or paste Netscape cookies to update", true);
      }

      if (apiConnected) {
        try {
          const res = await fetch(`${API_BASE}/api/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
          });
          if (!res.ok && !cookiesVal) {
            return showToast("Failed to save settings", true);
          }
        } catch (_) {
          if (!cookiesVal) return showToast("Failed to save settings", true);
        }
      }

      settingsModal.classList.add("hidden");
      await loadServerSettings();
      showToast(cookiesVal ? "Saved YouTube cookies cleanly" : "Settings updated");
    });
  }

  // =========================================================
  // SOURCE TABS, LOCAL UPLOAD, SWATCHES & PRESETS
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
    validateSourceInline();
  }

  if (tabSourceYoutube && tabSourceUpload) {
    tabSourceYoutube.addEventListener("click", () => activateSourceTab("youtube"));
    tabSourceUpload.addEventListener("click", () => activateSourceTab("upload"));
  }

  async function postAnalyzeRequest(endpoint, bodyObj) {
    return fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
  }

  function buildLocalPeaksFromBuffer(audioBuf, barCount = 56) {
    const channel = audioBuf.getChannelData(0);
    const step = Math.max(1, Math.floor(channel.length / barCount));
    const peaks = [];
    for (let i = 0; i < barCount; i++) {
      let peak = 0;
      const start = i * step;
      const sampleStride = Math.max(1, Math.floor(step / 120));
      for (let j = 0; j < step && start + j < channel.length; j += sampleStride) {
        const v = Math.abs(channel[start + j]);
        if (v > peak) peak = v;
      }
      peaks.push(Number(Math.min(0.98, Math.max(0.14, peak * 1.15)).toFixed(3)));
    }
    return peaks;
  }

  function buildFallbackPeaks(barCount = 56) {
    const out = [];
    for (let i = 0; i < barCount; i++) {
      const val = 0.35 + 0.45 * Math.abs(Math.sin(i * 0.42) * Math.cos(i * 0.19));
      out.push(Number(val.toFixed(3)));
    }
    return out;
  }

  async function prepareClientLocalVideo(file) {
    if (localClientSession && localClientSession.objectUrl) {
      try { URL.revokeObjectURL(localClientSession.objectUrl); } catch (_) {}
    }
    const objectUrl = URL.createObjectURL(file);
    let duration = 60;
    let vidW = 1280;
    let vidH = 720;
    let thumbDataUrl = "/assets/showcase-podcast.jpg";
    const sceneThumbs = [];
    const visualDeltas = [];

    await new Promise((resolve) => {
      const v = document.createElement("video");
      let settled = false;
      const sampleFracs = [0.08, 0.25, 0.42, 0.58, 0.75, 0.90];
      let sampleIdx = 0;
      let prevLuma = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        try { v.removeAttribute("src"); v.load(); v.remove(); } catch (_) {}
        resolve();
      };
      const timeout = setTimeout(finish, 5500);
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";

      const seekNext = () => {
        if (sampleIdx >= sampleFracs.length || duration <= 4) {
          clearTimeout(timeout);
          finish();
          return;
        }
        try {
          const targetT = Math.min(duration - 0.3, Math.max(0.2, duration * sampleFracs[sampleIdx]));
          v.currentTime = targetT;
        } catch (_) {
          clearTimeout(timeout);
          finish();
        }
      };

      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration) && v.duration > 0.5) duration = v.duration;
        if (v.videoWidth && v.videoHeight) {
          vidW = v.videoWidth;
          vidH = v.videoHeight;
        }
        try {
          v.currentTime = Math.min(Math.max(0.2, duration * sampleFracs[0]), Math.max(0.2, duration - 0.3));
        } catch (_) {
          clearTimeout(timeout);
          finish();
        }
      };

      v.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 480;
          canvas.height = Math.max(180, Math.round((480 * vidH) / Math.max(1, vidW)));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
            sceneThumbs.push(dataUrl);
            if (sampleIdx === 0 || sceneThumbs.length === 1) {
              thumbDataUrl = dataUrl;
            }
            // Fast 16x9 luma fingerprint to detect visual scene transitions on giant files
            const small = document.createElement("canvas");
            small.width = 16;
            small.height = 9;
            const sctx = small.getContext("2d");
            if (sctx) {
              sctx.drawImage(v, 0, 0, 16, 9);
              const px = sctx.getImageData(0, 0, 16, 9).data;
              let sum = 0;
              for (let p = 0; p < px.length; p += 4) sum += (px[p] + px[p + 1] + px[p + 2]) / 3;
              const avg = sum / 144;
              if (prevLuma !== null) visualDeltas.push(Math.abs(avg - prevLuma));
              prevLuma = avg;
            }
          }
        } catch (_) {}
        sampleIdx += 1;
        seekNext();
      };
      v.onerror = () => {
        clearTimeout(timeout);
        finish();
      };
      v.src = objectUrl;
    });

    let peaks = buildFallbackPeaks(112);
    if (file.size <= 75 * 1024 * 1024 && (window.AudioContext || window.webkitAudioContext)) {
      let ac = null;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        ac = new AudioCtx();
        const ab = await file.arrayBuffer();
        const audioBuf = await ac.decodeAudioData(ab);
        peaks = buildLocalPeaksFromBuffer(audioBuf, 112);
      } catch (_) {
      } finally {
        try { if (ac && ac.state !== "closed") await ac.close(); } catch (_) {}
      }
    } else if (visualDeltas.length > 0) {
      peaks = peaks.map((p, idx) => {
        const d = visualDeltas[idx % visualDeltas.length] || 0;
        return Number(Math.min(0.98, Math.max(0.18, p * 0.65 + (d / 40) * 0.45)).toFixed(3));
      });
    }

    const safeUrl = `local://browser/${encodeURIComponent(file.name)}`;
    localClientSession = {
      url: safeUrl,
      file,
      objectUrl,
      filename: file.name,
      duration,
      width: vidW,
      height: vidH,
      thumbDataUrl,
      sceneThumbs: sceneThumbs.length ? sceneThumbs : [thumbDataUrl],
      peaks,
    };
    return localClientSession;
  }

  function analyzeClientLocalSession(maxClips, targetDuration) {
    const sess = localClientSession;
    const total = Math.max(8, Number(sess.duration) || 60);
    const clipLen = Math.min(total, Math.max(5, targetDuration));
    const maxPossible = Math.max(1, Math.floor(total / Math.max(6, Math.min(clipLen * 0.65, total / 2))));
    const count = Math.max(1, Math.min(maxClips, maxPossible));
    const peaks = Array.isArray(sess.peaks) && sess.peaks.length >= 16 ? sess.peaks : buildFallbackPeaks(112);

    // Score sliding windows using actual audio RMS energy spikes so high-energy scenes come first
    const stepSecs = Math.max(3, Math.min(clipLen * 0.55, total / Math.max(count * 2, 12)));
    const candidates = [];
    for (let s = 0; s <= Math.max(0, total - Math.min(clipLen, 5)); s += stepSecs) {
      const start = Number(s.toFixed(2));
      const end = Number(Math.min(total, start + clipLen).toFixed(2));
      if (end - start < 4) continue;
      const bStart = Math.max(0, Math.floor((start / total) * peaks.length));
      const bEnd = Math.min(peaks.length, Math.max(bStart + 1, Math.ceil((end / total) * peaks.length)));
      let sum = 0;
      let mx = 0;
      for (let b = bStart; b < bEnd; b++) {
        sum += peaks[b];
        if (peaks[b] > mx) mx = peaks[b];
      }
      const avgE = sum / Math.max(1, bEnd - bStart);
      const energyScore = Math.min(99, Math.max(76, Math.round(72 + avgE * 18 + mx * 10)));
      candidates.push({ start, end, dur: Number((end - start).toFixed(2)), avgE, mx, energyScore });
    }

    // Greedy non-overlapping peak selection + chronological timeline ordering
    candidates.sort((a, b) => (b.energyScore - a.energyScore) || (a.start - b.start));
    const picked = [];
    const minGap = Math.max(2, clipLen * 0.35);
    for (const cand of candidates) {
      const overlaps = picked.some((p) => !(cand.end <= p.start + minGap * 0.1 || cand.start >= p.end - minGap * 0.1) && Math.abs(cand.start - p.start) < clipLen * 0.65);
      if (!overlaps) picked.push(cand);
      if (picked.length >= count) break;
    }
    if (picked.length === 0) {
      picked.push({ start: 0, end: Math.min(total, clipLen), dur: Math.min(total, clipLen), avgE: 0.75, mx: 0.9, energyScore: 93 });
    }
    picked.sort((a, b) => a.start - b.start);

    const cleanName = sess.filename.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded Video";
    const categories = ["Top Hook", "High Energy", "Key Moment", "Story Beat", "Insight"];
    const catTags = ["hook", "high_energy", "rule", "story", "insight"];
    const viralHookTemplates = [
      "THE 1 SECRET NOBODY TELLS YOU",
      "WHY 99% OF PEOPLE FAIL AT THIS",
      "THE FRAMEWORK THAT CHANGED EVERYTHING",
      "WAIT UNTIL THE END TO UNDERSTAND",
      "THIS SIMPLE SHIFT 10X'D MY RESULTS",
      "THE HARDEST TRUTH ABOUT SUCCESS",
      "DO THIS BEFORE IT IS TOO LATE",
      "WHAT TOP 1% PERFORMERS DO DIFFERENTLY",
      "THE BIGGEST MISTAKE YOU CAN MAKE",
      "HOW TO ACTUALLY GET REAL LEVERAGE",
      "WHAT THEY NEVER TAUGHT YOU IN SCHOOL",
      "THE TURNING POINT OF MY CAREER",
    ];
    const defaultPhrases = [
      "Click Add Script in the right panel to customize captions for this scene.",
      "Double click or use I and O keys to set exact in and out trim points.",
      "Switch Focus Left or Right to reframe speakers cleanly in vertical mode.",
      "Adjust subtitle size, position, and viral presets live over your video.",
    ];

    const clips = picked.map((win, i) => {
      const hookScore = Math.min(99, Math.max(85, win.energyScore + ((i % 3) - 1)));
      const retScore = Math.min(98, Math.max(84, win.energyScore - (i % 4)));
      const energyScore = win.energyScore;
      const viralScore = Math.round((hookScore + retScore + energyScore) / 3);
      const quote = defaultPhrases[i % defaultPhrases.length];
      const tokens = quote.split(/\s+/);
      const step = Math.max(0.28, win.dur / Math.max(1, tokens.length));
      const words = tokens.map((w, idx) => ({
        word: w,
        start: Number((win.start + idx * step).toFixed(2)),
        end: Number((win.start + (idx + 1) * step).toFixed(2)),
      }));
      const hookTitle = viralHookTemplates[i % viralHookTemplates.length];
      const wStartIdx = Math.max(0, Math.floor((win.start / total) * peaks.length));
      const wEndIdx = Math.min(peaks.length, Math.max(wStartIdx + 24, Math.ceil((win.end / total) * peaks.length)));
      const clipPeaks = peaks.slice(wStartIdx, wEndIdx);
      const thumbList = sess.sceneThumbs || [sess.thumbDataUrl];
      const thumbIdx = Math.min(thumbList.length - 1, Math.floor(((win.start + win.dur * 0.5) / total) * thumbList.length));

      return {
        id: `local_clip_${i + 1}`,
        index: i + 1,
        title: `${cleanName.slice(0, 24)} - Scene #${i + 1}`,
        hook_title: hookTitle,
        category: categories[i % categories.length],
        category_tag: catTags[i % catTags.length],
        start_time: win.start,
        end_time: win.end,
        duration: win.dur,
        score: viralScore,
        hook_score: hookScore,
        retention_score: retScore,
        energy_score: energyScore,
        viral_score: viralScore,
        thumbnail: thumbList[thumbIdx] || sess.thumbDataUrl,
        virality_breakdown: {
          hook_score: hookScore,
          retention_score: retScore,
          energy_score: energyScore,
          reasoning: `Energy peak window (${formatTime(win.start)} - ${formatTime(win.end)}) selected from audio/scene intensity curve.`,
        },
        virality_reasoning: `High energy cluster from ${formatTime(win.start)} to ${formatTime(win.end)}.`,
        hook_quote: quote,
        summary: quote,
        transcript_snippet: quote,
        words,
        hashtags: ["#shorts", "#reels", "#viral", "#podcast", "#klipnux"],
        youtube_shorts_seo: {
          title: `${hookTitle} - ${cleanName.slice(0, 30)}`,
          description: `${quote}\n\nEdited with klipnux Studio.`,
          tags: ["#shorts", "#reels", "#viral", "#podcast", "#klipnux"],
        },
        waveform_preview: clipPeaks.length >= 16 ? clipPeaks.map((v) => Math.round(v * 100)) : sess.peaks.slice(0, 56).map((v) => Math.round(v * 100)),
      };
    });

    return {
      video_info: {
        id: "local_browser",
        title: cleanName,
        channel: "Direct Upload (Browser Engine)",
        duration: total,
        thumbnail: sess.thumbDataUrl,
        is_local: true,
        is_demo: false,
      },
      timeline_duration: total,
      clips,
    };
  }

  function wrapCanvasLines(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  async function cutClientLocalClip(clip) {
    const sess = localClientSession;
    if (!sess || !sess.objectUrl) {
      throw new Error("Local video file handle expired. Please re-select the file.");
    }
    const startSec = Math.max(0, Number(clip.start_time) || 0);
    const endSec = Math.min(sess.duration || startSec + 15, Math.max(startSec + 2, Number(clip.end_time) || startSec + 15));
    const cutDur = Math.max(2, endSec - startSec);
    const layoutStyle = layoutSelect ? layoutSelect.value : "blur_margins";
    const captionStyle = workspaceCaptionSelect ? workspaceCaptionSelect.value : (captionSelect ? captionSelect.value : "hormozi");
    const showBanner = chkWorkspaceBanner ? chkWorkspaceBanner.checked : true;
    const words = getActiveWords(clip);

    let width = 720;
    let height = 1280;
    if (layoutStyle === "square_1_1") {
      width = 720;
      height = 720;
    } else if (layoutStyle === "landscape_16_9") {
      width = 1280;
      height = 720;
    }

    const mimeCandidates = [
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = (typeof MediaRecorder !== "undefined" && mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m))) || "";

    if (!mimeType || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
      return {
        clip_id: clip.id,
        filename: `klipnux_short_${clip.index}.mp4`,
        blob_url: `${sess.objectUrl}#t=${startSec.toFixed(1)},${endSec.toFixed(1)}`,
        download_url: sess.objectUrl,
        stream_url: sess.objectUrl,
        duration: Number(cutDur.toFixed(2)),
        title: clip.hook_title,
        size_mb: Number((sess.file.size / (1024 * 1024)).toFixed(2)),
        waveform: sess.peaks,
      };
    }

    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const srcVid = document.createElement("video");
    srcVid.src = sess.objectUrl;
    srcVid.playsInline = true;
    srcVid.preload = "auto";
    srcVid.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
      srcVid.onloadedmetadata = () => resolve();
      srcVid.onerror = () => reject(new Error("Browser could not decode this video format."));
    });

    srcVid.currentTime = startSec;
    await new Promise((resolve) => {
      const done = () => resolve();
      srcVid.onseeked = done;
      setTimeout(done, 1500);
    });

    let audioCtx = null;
    let audioTracks = [];
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaElementSource(srcVid);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        audioTracks = dest.stream.getAudioTracks();
      }
    } catch (_) {
      audioTracks = [];
    }

    try {
      if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
      srcVid.muted = false;
      await srcVid.play();
    } catch (_) {
      srcVid.muted = true;
      audioTracks = [];
      await srcVid.play();
    }

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks(), ...(srcVid.muted ? [] : audioTracks)];
    const combinedStream = new MediaStream(tracks);
    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 3500000,
    });
    const chunks = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const drawFrame = () => {
      if (!ctx) return;
      const vw = srcVid.videoWidth || sess.width || 1280;
      const vh = srcVid.videoHeight || sess.height || 720;
      const activeFit = (studioFitSelect && studioFitSelect.value === "center_crop") || layoutStyle === "center_crop";
      const activeColorFilter = (studioFilterSelect && studioFilterSelect.value && studioFilterSelect.value !== "none") ? studioFilterSelect.value : "none";
      const zoomFactor = studioZoomSelect ? Math.max(1, parseFloat(studioZoomSelect.value) || 1) : 1;
      const panMode = studioPanSelect ? studioPanSelect.value : "center";
      const capScale = captionSizeSelect ? Math.max(0.75, parseFloat(captionSizeSelect.value) || 1) : 1;
      const capPos = captionPosSelect ? captionPosSelect.value : "bottom";

      ctx.save();
      ctx.fillStyle = "#0b0c10";
      ctx.fillRect(0, 0, width, height);

      // Vibrant contrast-graded blurred backdrop
      const bgScale = Math.max(width / vw, height / vh);
      const bgW = vw * bgScale;
      const bgH = vh * bgScale;
      ctx.filter = "blur(22px) brightness(0.42) saturate(1.22)";
      ctx.drawImage(srcVid, (width - bgW) / 2, (height - bgH) / 2, bgW, bgH);
      ctx.filter = "none";

      // Foreground frame with studio drop shadow, speaker pan, zoom & grade
      const baseScale = activeFit ? Math.max(width / vw, height / vh) : Math.min(width / vw, height / vh);
      const fgScale = baseScale * zoomFactor;
      const fgW = vw * fgScale;
      const fgH = vh * fgScale;
      let fgX = (width - fgW) / 2;
      if (panMode === "left") {
        fgX = Math.min(0, Math.max(width - fgW, 0));
      } else if (panMode === "right") {
        fgX = Math.max(width - fgW, Math.min(0, width - fgW));
      }
      const fgY = (height - fgH) / 2;
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.56)";
      ctx.shadowBlur = 32;
      if (activeColorFilter !== "none") ctx.filter = activeColorFilter;
      ctx.drawImage(srcVid, fgX, fgY, fgW, fgH);
      ctx.filter = "none";
      ctx.restore();

      // Editorial top Hook Banner
      if (showBanner && clip.hook_title) {
        ctx.font = "800 32px Inter, -apple-system, sans-serif";
        const lines = wrapCanvasLines(ctx, clip.hook_title, width - 96).slice(0, 2);
        const boxH = lines.length * 40 + 28;
        const boxW = Math.min(width - 52, Math.max(260, ...lines.map((l) => ctx.measureText(l).width + 48)));
        const bx = (width - boxW) / 2;
        const by = Math.round(height * 0.075);
        ctx.fillStyle = "rgba(15, 17, 25, 0.90)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 16);
        else ctx.rect(bx, by, boxW, boxH);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        lines.forEach((line, idx) => {
          ctx.fillText(line, width / 2, by + 34 + idx * 38);
        });
      }

      // Word-by-word karaoke pop caption overlay
      const curTime = srcVid.currentTime || startSec;
      const foundIdx = words.findIndex((w) => curTime >= w.start && curTime <= w.end);
      const curIdx = foundIdx >= 0 ? foundIdx : Math.max(0, words.findIndex((w) => curTime < w.start));
      const groupSize = (captionStyle === "minimal" || captionStyle === "podcast") ? 4 : 3;
      const groupStart = Math.floor(Math.max(0, curIdx) / groupSize) * groupSize;
      const chunkWords = words.slice(groupStart, groupStart + groupSize);
      if (chunkWords.length > 0) {
        const isCaps = captionStyle === "hormozi" || captionStyle === "mrbeast" || captionStyle === "neon";
        const labels = chunkWords.map((w) => (isCaps ? String(w.word || "").toUpperCase() : String(w.word || "")));
        const fontPx = Math.round(40 * capScale);
        ctx.font = `900 ${fontPx}px Inter, -apple-system, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        const gap = Math.round(16 * capScale);
        const widths = labels.map((l) => ctx.measureText(l).width);
        const totalRowW = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, labels.length - 1);
        const yFrac = capPos === "center" ? 0.50 : capPos === "lower" ? 0.67 : 0.80;
        const capY = Math.round(height * yFrac);

        if (captionStyle === "minimal" || captionStyle === "podcast") {
          ctx.fillStyle = "rgba(15, 17, 23, 0.82)";
          ctx.beginPath();
          const boxPadY = Math.round(32 * capScale);
          if (ctx.roundRect) ctx.roundRect((width - totalRowW - 44) / 2, capY - boxPadY, totalRowW + 44, boxPadY * 2, 14);
          else ctx.rect((width - totalRowW - 44) / 2, capY - boxPadY, totalRowW + 44, boxPadY * 2);
          ctx.fill();
        }

        const activeColor = captionStyle === "tiktok" ? "#fe2c55" : captionStyle === "mrbeast" ? "#ff2d2d" : captionStyle === "neon" ? "#00ffff" : "#00ff66";
        let cursorX = (width - totalRowW) / 2;
        labels.forEach((lbl, idx) => {
          const isActive = (groupStart + idx) === curIdx;
          const wPx = widths[idx];
          if (isActive && captionStyle === "hormozi") {
            ctx.fillStyle = "#00bf49";
            ctx.beginPath();
            const pillH = Math.round(54 * capScale);
            if (ctx.roundRect) ctx.roundRect(cursorX - 10, capY - pillH / 2, wPx + 20, pillH, 10);
            else ctx.rect(cursorX - 10, capY - pillH / 2, wPx + 20, pillH);
            ctx.fill();
          }
          ctx.lineWidth = isActive ? 8 : 6;
          ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
          ctx.strokeText(lbl, cursorX, capY);
          ctx.fillStyle = isActive ? (captionStyle === "hormozi" ? "#ffffff" : activeColor) : (captionStyle === "mrbeast" ? "#fde047" : "#ffffff");
          ctx.fillText(lbl, cursorX, capY);
          cursorX += wPx + gap;
        });
      }
      ctx.restore();
    };

    const blob = await new Promise((resolve, reject) => {
      let stopped = false;
      let rafId = null;
      const finishStop = () => {
        if (stopped) return;
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.onstop = () => {
        try { srcVid.pause(); srcVid.removeAttribute("src"); srcVid.load(); srcVid.remove(); } catch (_) {}
        try { if (audioCtx && audioCtx.state !== "closed") audioCtx.close(); } catch (_) {}
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (ev) => {
        if (rafId) cancelAnimationFrame(rafId);
        reject((ev && ev.error) || new Error("Browser recorder failed"));
      };

      const startedAt = performance.now();
      const tick = () => {
        if (stopped) return;
        drawFrame();
        const elapsed = (performance.now() - startedAt) / 1000;
        if (stageRenderTimer) {
          stageRenderTimer.textContent = `Cutting ${Math.min(cutDur, elapsed).toFixed(1)}s / ${cutDur.toFixed(0)}s`;
        }
        if ((srcVid.currentTime >= endSec - 0.05) || srcVid.ended || elapsed >= cutDur + 0.8) {
          finishStop();
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      recorder.start(250);
      tick();
    });

    const blobUrl = URL.createObjectURL(blob);
    const filename = `klipnux_short_${clip.index}.${ext}`;
    return {
      clip_id: clip.id,
      filename,
      blob_url: blobUrl,
      download_url: blobUrl,
      stream_url: blobUrl,
      duration: Number(cutDur.toFixed(2)),
      title: clip.hook_title,
      size_mb: Number((blob.size / (1024 * 1024)).toFixed(2)),
      waveform: sess.peaks,
    };
  }

  async function handleLocalVideoUpload(file) {
    if (!file) return;
    uploadLabelText.textContent = `Preparing ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`;
    try {
      await resolveWorkingApiBase();
      const useBrowserEngine = isServerlessEnv || !apiConnected;
      if (!useBrowserEngine) {
        try {
          const res = await fetch(`${API_BASE}/api/upload-video?filename=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: file,
          });
          if (res.ok) {
            const data = await res.json();
            urlInput.value = data.url;
            uploadLabelText.textContent = `Uploaded: ${file.name}`;
            showToast(`Uploaded ${file.name}`);
            setWizardStep(2, "next");
            return;
          }
        } catch (_) {}
      }

      const sess = await prepareClientLocalVideo(file);
      urlInput.value = sess.url;
      uploadLabelText.textContent = `Ready in Browser Studio: ${file.name}`;
      if (fileUploadMeta && metaFileName && metaFileDetails) {
        metaFileName.textContent = file.name;
        metaFileDetails.textContent = `${formatTime(sess.duration)} · ${sess.width}x${sess.height} · ${(file.size / (1024 * 1024)).toFixed(1)} MB · Offline Browser Engine`;
        fileUploadMeta.classList.remove("hidden");
      }
      showToast(`Loaded ${file.name} (${formatTime(sess.duration)})`);
      setWizardStep(2, "next");
    } catch (err) {
      uploadLabelText.textContent = "Drop MP4, MOV, MKV, or WEBM footage here";
      showToast(err.message || "Video load failed", true);
    }
  }

  if (btnMetaProceed) {
    btnMetaProceed.addEventListener("click", () => {
      setWizardStep(2, "next");
    });
  }

  if (fileUploadInput) {
    fileUploadInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) handleLocalVideoUpload(e.target.files[0]);
    });
  }

  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("drag-over");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
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
          showToast("Link pasted");
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

  if (btnShowcaseDemo) {
    btnShowcaseDemo.addEventListener("click", () => {
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
    if (!url) return showToast("Paste a YouTube link or upload a video", true);
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
        el.style.color = "var(--brand-violet)";
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
      showToast("Cancelled");
    });
  }

  async function triggerAnalyze(url) {
    activeJobCancelled = false;
    stopJobTimers();
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

    updateProcessingSteps(1, 14, "Connecting to klipnux...", "Inspecting stream and duration...");

    try {
      const maxClips = parseInt(clipsCountSelect.value, 10) || 12;
      const targetDuration = parseInt(durationSelect.value, 10) || 45;

      if (chkWorkspaceBanner && chkHookBanner) {
        chkWorkspaceBanner.checked = chkHookBanner.checked;
      }
      if (workspaceCaptionSelect) {
        workspaceCaptionSelect.value = captionSelect.value;
      }

      if (url.startsWith("local://browser/") && localClientSession) {
        updateProcessingSteps(2, 54, "2. Scanning local video peaks...", "Mapping highlight moments...");
        const localData = analyzeClientLocalSession(maxClips, targetDuration);
        updateProcessingSteps(4, 96, "4. Opening preview...", "Preparing Clip #1...");
        stopJobTimers();
        await hydrateWorkspace(localData);
        return;
      }

      const resolvedBase = await resolveWorkingApiBase();
      if (resolvedBase === null) {
        throw new Error("Backend engine not connected. Start the local server (python run.py) or upload an MP4 video directly.");
      }

      const reqPayload = {
        url,
        target_duration: targetDuration,
        max_clips: maxClips,
        cookies_txt: getStoredCookies() || null,
      };

      let startRes = await postAnalyzeRequest("/api/analyze/start", reqPayload);

      if (startRes.status === 405 && (await switchToLocalEngine(true))) {
        startRes = await postAnalyzeRequest("/api/analyze/start", reqPayload);
      }

      if (startRes.status === 404 || startRes.status === 405) {
        updateProcessingSteps(2, 52, "2. Reading speech track...", "Selecting top segments...");
        const syncRes = await postAnalyzeRequest("/api/analyze", reqPayload);
        if (syncRes.status === 405) {
          throw new Error("Static file server cannot run backend API requests (HTTP 405). Open http://127.0.0.1:8000 or connect Local Engine in Settings.");
        }
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
        throw new Error(err.detail || `Unable to read video (HTTP ${startRes.status}).`);
      }

      const startJson = await startRes.json();
      if (startJson.status === "completed" && startJson.result) {
        updateProcessingSteps(4, 95, "4. Opening preview...", "Preparing Clip #1...");
        stopJobTimers();
        await hydrateWorkspace(startJson.result);
        return;
      }

      const jobId = startJson.job_id;
      const pollJob = async () => {
        if (activeJobCancelled) return;
        const jobRes = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        if (!jobRes.ok) throw new Error("Lost connection while reading video.");
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
        const msg = err.message || "Unable to open this video URL.";
        showView("launcher");
        setWizardStep(1, "back");
        if (urlStatusHint) {
          urlStatusHint.textContent = msg;
          urlStatusHint.style.color = "var(--danger)";
        }
        showToast(msg, true);
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

    const srcType = currentVideoInfo.is_demo ? "DEMO STUDIO" : currentVideoInfo.is_local ? "LOCAL FILE" : "YOUTUBE";
    headerSourceBadge.textContent = srcType;
    headerSourceBadge.className = currentVideoInfo.is_demo ? "kn-badge kn-badge-blue" : "kn-badge kn-badge-green";
    headerVideoTitle.textContent = currentVideoInfo.title || "Untitled Video";

    videoTitle.textContent = currentVideoInfo.title || "Analyzed Video";
    videoChannel.textContent = currentVideoInfo.channel || "Creator";
    videoThumb.src = currentVideoInfo.thumbnail || "/assets/showcase-podcast.jpg";
    timelineDurationBadge.textContent = formatTime(totalVideoDuration);
    clipsFoundBadge.textContent = `${currentClips.length} Clips Found`;
    countAll.textContent = String(currentClips.length);

    showView("workspace");
    syncAspectButtonsFromSelect();
    renderTimelineHeatmap();
    buildDynamicCategoryFilters();
    renderClipsQueue();
    updateBatchCountLabel();

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
        showToast(`${currentClips.length} demo clips ready`);
      } else if (currentVideoInfo.is_local && localClientSession) {
        selectClip(currentClips[0]);
        showToast(`${currentClips.length} scenes ready in Live Editor Studio`);
      } else {
        showToast(`Found ${currentClips.length} clips — cutting Clip #1 preview...`);
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
      const bg = clip.score >= 92 ? "var(--success)" : clip.score >= 85 ? "var(--brand-violet)" : "var(--warning)";
      const isSelected = activeClip && activeClip.id === clip.id;

      span.className = "heatmap-span";
      span.style.left = `${leftPct}%`;
      span.style.width = `${widthPct}%`;
      span.style.background = bg;
      span.style.opacity = isSelected ? "1" : "0.62";
      span.style.boxShadow = isSelected ? "0 0 0 2px #ffffff, 0 0 0 4px var(--brand-violet)" : "none";
      span.dataset.markerClipId = clip.id;

      span.innerHTML = `
        <div class="heatmap-tooltip kn-tabular">
          #${clip.index} &middot; ${formatTime(clip.start_time)}-${formatTime(clip.end_time)} (${Math.round(clip.duration)}s)
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
        ? "padding: 5px 11px; border-radius: 980px; border: 1px solid var(--text-primary); background: var(--text-primary); color: #ffffff; font-size: 11.5px; font-weight: 600;"
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
      clipCardsList.innerHTML = `<div style="font-size: 12.5px; color: var(--text-secondary); text-align: center; padding: 32px 12px;">No clips in this group.</div>`;
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
        ? "padding: 5px 12px; border-radius: 980px; border: none; background: #0d9f6e; color: #ffffff; font-size: 11.5px; font-weight: 600;"
        : "padding: 5px 12px; border-radius: 980px; border: none; background: var(--text-primary); color: #ffffff; font-size: 11.5px; font-weight: 600;";

      const thumbHtml = clip.thumbnail
        ? `<img src="${clip.thumbnail}" alt="Scene ${clip.index}" style="width: 52px; height: 34px; object-fit: cover; border-radius: 7px; border: 1px solid var(--border-hairline); flex-shrink: 0; background: #14151a;" />`
        : "";

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
            <input type="checkbox" class="clip-batch-chk" style="width: 15px; height: 15px; accent-color: var(--brand-violet); cursor: pointer;" ${selectedClipIds.has(clip.id) ? "checked" : ""} />
            <span class="kn-tabular" style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">#${clip.index}</span>
            <span class="kn-badge ${categoryBadgeClass(clip.category_tag)}" style="font-size: 10.5px;">${clip.category}</span>
          </div>
          <span class="kn-badge kn-badge-green kn-tabular" style="font-weight: 700;">${clip.score}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          ${thumbHtml}
          <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${clip.hook_title}</h4>
        </div>

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
            showToast(`Cutting Clip #${clip.index}...`);
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
  function applyVideoStageTransform() {
    if (!previewVideo) return;
    if (!isPlayingLiveSource) {
      previewVideo.style.transform = "";
      previewVideo.style.filter = "";
      return;
    }
    const fitMode = studioFitSelect ? studioFitSelect.value : (layoutSelect.value === "center_crop" ? "center_crop" : "blur_margins");
    const isBlurLayout = fitMode === "blur_margins" && layoutSelect.value !== "landscape_16_9";
    previewVideo.style.objectFit = isBlurLayout ? "contain" : "cover";
    previewVideo.style.filter = (studioFilterSelect && studioFilterSelect.value) ? studioFilterSelect.value : "none";

    const zoomVal = studioZoomSelect ? (parseFloat(studioZoomSelect.value) || 1) : 1;
    const panVal = studioPanSelect ? studioPanSelect.value : "center";
    const originX = panVal === "left" ? "18%" : panVal === "right" ? "82%" : "50%";
    previewVideo.style.transformOrigin = `${originX} 50%`;
    previewVideo.style.transform = zoomVal > 1 ? `scale(${zoomVal})` : "";
    if (!isBlurLayout && panVal !== "center") {
      previewVideo.style.objectPosition = `${originX} 50%`;
    } else {
      previewVideo.style.objectPosition = "50% 50%";
    }

    if (previewBackdrop) {
      previewBackdrop.classList.toggle("hidden", !isBlurLayout);
      previewBackdrop.style.filter = `blur(22px) brightness(0.45) saturate(1.25) ${studioFilterSelect && studioFilterSelect.value !== "none" ? studioFilterSelect.value : ""}`;
    }
  }

  function startLiveLocalStage(clip) {
    if (!localClientSession || !localClientSession.objectUrl || !clip) return;
    isPlayingLiveSource = true;
    if (stageErrorOverlay) stageErrorOverlay.classList.add("hidden");
    if (sourceYoutubeFrame) {
      sourceYoutubeFrame.src = "";
      sourceYoutubeFrame.classList.add("hidden");
    }
    if (playerPlaceholder) playerPlaceholder.classList.add("hidden");
    if (previewVideo) previewVideo.classList.remove("hidden");
    if (btnToggleSound) btnToggleSound.classList.remove("hidden");

    applyVideoStageTransform();
    if (previewVideo) {
      if (previewVideo.getAttribute("data-live-url") !== localClientSession.objectUrl) {
        previewVideo.src = localClientSession.objectUrl;
        previewVideo.setAttribute("data-live-url", localClientSession.objectUrl);
      }
      previewVideo.playbackRate = speedSteps[speedIdx];
      previewVideo.currentTime = Math.max(0, clip.start_time || 0);
      previewVideo.play().then(() => {
        if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "pause"); refreshIcons(); }
      }).catch(() => {
        previewVideo.muted = true;
        if (soundIcon) soundIcon.setAttribute("data-lucide", "volume-x");
        refreshIcons();
        previewVideo.play().catch(() => {});
      });
    }
    const fitMode = studioFitSelect ? studioFitSelect.value : (layoutSelect.value === "center_crop" ? "center_crop" : "blur_margins");
    const isBlurLayout = fitMode === "blur_margins" && layoutSelect.value !== "landscape_16_9";
    if (previewBackdrop && isBlurLayout) {
      if (previewBackdrop.getAttribute("data-live-url") !== localClientSession.objectUrl) {
        previewBackdrop.src = localClientSession.objectUrl;
        previewBackdrop.setAttribute("data-live-url", localClientSession.objectUrl);
      }
      previewBackdrop.playbackRate = speedSteps[speedIdx];
      previewBackdrop.currentTime = Math.max(0, clip.start_time || 0);
      previewBackdrop.play().catch(() => {});
    }

    updateLiveBanner();
    updateLiveSubtitles(clip.start_time || 0);
    if (btnDownloadClip) {
      const span = btnDownloadClip.querySelector("span");
      if (span) span.textContent = "Export & Download 1080p MP4";
    }
  }

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
      isPlayingLiveSource = false;
      loadVideoPlayer(rendered);
      initWaveform(rendered.waveform || clip.waveform_preview);
    } else if (currentVideoInfo && currentVideoInfo.is_local && localClientSession) {
      startLiveLocalStage(clip);
      initWaveform(clip.waveform_preview);
    } else {
      isPlayingLiveSource = false;
      previewVideo.pause();
      previewVideo.classList.add("hidden");
      if (btnToggleSound) btnToggleSound.classList.add("hidden");
      if (liveSubtitleTrack) liveSubtitleTrack.classList.add("hidden");
      if (liveBannerOverlay) liveBannerOverlay.classList.add("hidden");

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
        ? "Settings updated - click to re-cut MP4"
        : "Click below to cut 1080p MP4";
      updateLiveStagePreview();
      initWaveform(clip.waveform_preview);
    }
  }

  function updateLiveStagePreview() {
    if (!activeClip) return;
    if (stageCategoryPill) stageCategoryPill.textContent = activeClip.category || "Clip";
    if (stageTimestamp) {
      stageTimestamp.textContent = `${formatTime(activeClip.start_time)} - ${formatTime(activeClip.end_time)} (${Math.round(activeClip.duration)}s)`;
    }

    const bannerOn = chkWorkspaceBanner ? chkWorkspaceBanner.checked : true;
    if (liveBannerPreview) {
      liveBannerPreview.classList.toggle("hidden", !bannerOn);
      liveBannerPreview.textContent = (activeClip.hook_title || "Clip Title").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
    }

    const styleId = workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value;
    const samples = {
      hormozi: `<span style="color:#fff">VOLUME </span><span style="padding:2px 6px;border-radius:4px;background:#0ec88a;color:#052e16">CREATES</span><span style="color:#fff"> SKILL</span>`,
      mrbeast: `<span style="color:#fde047">WAIT </span><span style="color:#f43f5e">FOR IT!</span>`,
      tiktok: `<span style="color:#fff">Pace is </span><span style="color:#fe2c55">everything</span>`,
      neon: `<span style="color:#22d3ee">GO </span><span style="color:#c084fc">10X FASTER</span>`,
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
    if (inspectorReasoning) inspectorReasoning.textContent = vb.reasoning || "Clear opening statement with clean sentence cadence.";
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
            onClipEdited(false);
            showToast("Caption word updated");
          }
          return;
        }
        const rendered = renderedClipsMap[clip.id];
        if (isPlayingLiveSource) {
          previewVideo.currentTime = Math.max(clip.start_time, Math.min(clip.end_time - 0.2, w.start));
          previewVideo.play().catch(() => {});
          updateLiveSubtitles(w.start);
        } else if (rendered && rendered.signature === getClipSignature(clip)) {
          previewVideo.currentTime = Math.max(0, w.start - clip.start_time);
          previewVideo.play().catch(() => {});
        } else {
          showToast(`Timestamp ${formatTime(w.start)} - cut clip first to jump playback`);
        }
      });

      inspectorTranscriptBox.appendChild(span);
    });

    if (captionScriptInput && (!captionComposerDrawer || captionComposerDrawer.classList.contains("hidden"))) {
      captionScriptInput.value = words.map((w) => w.word).join(" ");
    }
  }

  function applyCustomScriptToClip(clip, rawText) {
    if (!clip) return;
    const clean = String(rawText || "").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
    if (!clean) return;
    const tokens = clean.split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    const start = Number(clip.start_time) || 0;
    const end = Math.max(start + 2, Number(clip.end_time) || start + 15);
    const totalDur = end - start;
    // Character-weighted word timing so longer words stay on screen proportionally longer
    const weights = tokens.map((t) => Math.max(2, t.length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let cursor = start;
    clip.custom_words = tokens.map((word, idx) => {
      const span = (weights[idx] / totalWeight) * totalDur;
      const wStart = Number(cursor.toFixed(2));
      cursor += span;
      const wEnd = idx === tokens.length - 1 ? Number(end.toFixed(2)) : Number(cursor.toFixed(2));
      return { word, start: wStart, end: wEnd };
    });
    clip.transcript_snippet = clean;
    clip.summary = clean;
    renderInteractiveTranscript(clip);
    onClipEdited(true);
    showToast(`Synced ${tokens.length} caption words to clip`);
  }

  if (btnOpenCaptionComposer && captionComposerDrawer) {
    btnOpenCaptionComposer.addEventListener("click", () => {
      const opening = captionComposerDrawer.classList.contains("hidden");
      captionComposerDrawer.classList.toggle("hidden", !opening);
      if (opening && activeClip && captionScriptInput) {
        captionScriptInput.value = getActiveWords(activeClip).map((w) => w.word).join(" ");
        captionScriptInput.focus();
      }
    });
  }

  if (btnApplyCaptionScript) {
    btnApplyCaptionScript.addEventListener("click", () => {
      if (!activeClip || !captionScriptInput) return;
      applyCustomScriptToClip(activeClip, captionScriptInput.value);
      if (captionComposerDrawer) captionComposerDrawer.classList.add("hidden");
    });
  }

  if (btnVoiceDictate) {
    let activeRecognition = null;
    btnVoiceDictate.addEventListener("click", () => {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        showToast("Voice dictation requires Chrome or Edge. Paste text directly above.", true);
        return;
      }
      if (activeRecognition) {
        try { activeRecognition.stop(); } catch (_) {}
        activeRecognition = null;
        btnVoiceDictate.querySelector("span").textContent = "Voice Dictate";
        return;
      }
      activeRecognition = new SpeechRec();
      activeRecognition.continuous = true;
      activeRecognition.interimResults = true;
      activeRecognition.lang = "en-US";
      const baseText = captionScriptInput && captionScriptInput.value ? captionScriptInput.value.trim() + " " : "";
      activeRecognition.onresult = (ev) => {
        let spoken = "";
        for (let i = 0; i < ev.results.length; i++) {
          spoken += ev.results[i][0].transcript + " ";
        }
        if (captionScriptInput) captionScriptInput.value = (baseText + spoken).trim();
      };
      activeRecognition.onerror = () => {
        activeRecognition = null;
        btnVoiceDictate.querySelector("span").textContent = "Voice Dictate";
        showToast("Microphone unavailable - type captions directly", true);
      };
      activeRecognition.onend = () => {
        activeRecognition = null;
        btnVoiceDictate.querySelector("span").textContent = "Voice Dictate";
      };
      activeRecognition.start();
      btnVoiceDictate.querySelector("span").textContent = "Stop Listening";
      showToast("Listening - speak captions for your clip");
    });
  }

  if (captionSizeSelect) {
    captionSizeSelect.addEventListener("change", () => {
      if (activeClip) updateLiveSubtitles(previewVideo ? (isPlayingLiveSource ? previewVideo.currentTime : activeClip.start_time + (previewVideo.currentTime || 0)) : activeClip.start_time);
    });
  }
  if (captionPosSelect) {
    captionPosSelect.addEventListener("change", () => {
      if (activeClip) updateLiveSubtitles(previewVideo ? (isPlayingLiveSource ? previewVideo.currentTime : activeClip.start_time + (previewVideo.currentTime || 0)) : activeClip.start_time);
    });
  }

  function createCustomClipAtTime(startSec) {
    if (!currentClips) return;
    const total = Math.max(8, totalVideoDuration || 60);
    const dur = Math.min(45, Math.max(5, total - startSec));
    const clampedStart = Number(Math.max(0, Math.min(total - 5, startSec)).toFixed(2));
    const clampedEnd = Number(Math.min(total, clampedStart + dur).toFixed(2));
    const idxNum = currentClips.length + 1;
    const newClip = {
      id: `custom_clip_${Date.now()}`,
      index: idxNum,
      title: `Custom Cut #${idxNum}`,
      hook_title: "CUSTOM STUDIO CUT",
      category: "Custom",
      category_tag: "hook",
      start_time: clampedStart,
      end_time: clampedEnd,
      duration: Number((clampedEnd - clampedStart).toFixed(2)),
      score: 95,
      hook_score: 95,
      retention_score: 94,
      energy_score: 95,
      viral_score: 95,
      virality_breakdown: {
        hook_score: 95,
        retention_score: 94,
        energy_score: 95,
        reasoning: `Manual timeline slice created at ${formatTime(clampedStart)}.`,
      },
      hook_quote: "Type or paste custom captions for this slice in Add Script.",
      summary: "Type or paste custom captions for this slice in Add Script.",
      transcript_snippet: "Type or paste custom captions for this slice in Add Script.",
      words: [
        { word: "Custom", start: clampedStart, end: clampedStart + 1.5 },
        { word: "clip", start: clampedStart + 1.5, end: clampedStart + 3.0 },
        { word: "scene", start: clampedStart + 3.0, end: clampedStart + 5.0 },
      ],
      hashtags: ["#shorts", "#reels", "#klipnux"],
      youtube_shorts_seo: {
        title: `Custom Cut #${idxNum}`,
        tags: ["#shorts", "#reels", "#klipnux"],
      },
      waveform_preview: (localClientSession && localClientSession.peaks) ? localClientSession.peaks.slice(0, 56).map((v) => Math.round(v * 100)) : undefined,
    };
    currentClips.push(newClip);
    if (clipsFoundBadge) clipsFoundBadge.textContent = `${currentClips.length} Clips Found`;
    if (countAll) countAll.textContent = String(currentClips.length);
    buildDynamicCategoryFilters();
    selectClip(newClip);
    showToast(`Added Clip #${idxNum} at ${formatTime(clampedStart)}`);
  }

  if (btnAddNewClip) {
    btnAddNewClip.addEventListener("click", () => {
      const baseTime = activeClip ? Math.min(Math.max(0, (totalVideoDuration || 60) - 10), activeClip.end_time) : 0;
      createCustomClipAtTime(baseTime);
    });
  }

  if (timelineTrackContainer) {
    timelineTrackContainer.addEventListener("click", (e) => {
      if (e.target.closest(".heatmap-span")) return;
      const rect = timelineTrackContainer.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const clickedSec = pct * (totalVideoDuration || 60);
      createCustomClipAtTime(clickedSec);
    });
  }

  if (btnToggleEditWords) {
    btnToggleEditWords.addEventListener("click", () => {
      isEditWordsMode = !isEditWordsMode;
      btnToggleEditWords.textContent = isEditWordsMode ? "Done Editing" : "Edit Words";
      btnToggleEditWords.style.background = isEditWordsMode ? "var(--brand-violet)" : "var(--bg-surface)";
      btnToggleEditWords.style.color = isEditWordsMode ? "#ffffff" : "var(--brand-violet)";
      if (transcriptHelpHint) {
        transcriptHelpHint.textContent = isEditWordsMode
          ? "Edit mode active: tap any word below to rename"
          : 'Tap any word to jump playback or click "Add Script" to write your own captions';
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

    const isLocalLive = currentVideoInfo && currentVideoInfo.is_local && localClientSession;
    const rendered = renderedClipsMap[activeClip.id];

    if (isLocalLive && (!rendered || rendered.signature !== getClipSignature(activeClip))) {
      isPlayingLiveSource = true;
      if (playerPlaceholder) playerPlaceholder.classList.add("hidden");
      if (previewVideo) previewVideo.classList.remove("hidden");
      if (btnToggleSound) btnToggleSound.classList.remove("hidden");
      applyVideoStageTransform();
      if (previewVideo && (previewVideo.currentTime < activeClip.start_time || previewVideo.currentTime > activeClip.end_time)) {
        previewVideo.currentTime = activeClip.start_time;
      }
      updateLiveBanner();
      updateLiveSubtitles(previewVideo ? previewVideo.currentTime : activeClip.start_time);
      initWaveform(activeClip.waveform_preview);
      return;
    }

    if (rendered && rendered.signature !== getClipSignature(activeClip)) {
      previewVideo.pause();
      previewVideo.classList.add("hidden");
      playerPlaceholder.classList.remove("hidden");
      if (btnToggleSound) btnToggleSound.classList.add("hidden");
      if (liveSubtitleTrack) liveSubtitleTrack.classList.add("hidden");
      if (liveBannerOverlay) liveBannerOverlay.classList.add("hidden");
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

  if (chkWorkspaceBanner) chkWorkspaceBanner.addEventListener("change", () => onClipEdited(false));
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
        showToast(`Length set to ${formatTime(activeClip.end_time - activeClip.start_time)}`);
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
      showToast(`Layout: ${btn.dataset.aspect}`);
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
      if (stageRenderTimer) {
        stageRenderTimer.textContent = `${((performance.now() - rStart) / 1000).toFixed(1)}s elapsed`;
      }
    }, 100);

    try {
      let clipData;
      if (currentVideoUrl && currentVideoUrl.startsWith("local://browser/") && localClientSession) {
        clearInterval(renderTimerInterval);
        clipData = await cutClientLocalClip(clip);
      } else {
        const genPayload = {
          url: currentVideoUrl || "demo://creator-podcast",
          start_time: clip.start_time,
          end_time: clip.end_time,
          hook_title: clip.hook_title,
          layout_style: layoutSelect.value,
          caption_style: workspaceCaptionSelect ? workspaceCaptionSelect.value : captionSelect.value,
          show_hook_banner: chkWorkspaceBanner ? chkWorkspaceBanner.checked : true,
          custom_words: clip.custom_words || null,
          cookies_txt: getStoredCookies() || null,
        };

        let res = await fetch(`${API_BASE}/api/generate-clip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(genPayload),
        });

        if (res.status === 405 && (await switchToLocalEngine(true))) {
          res = await fetch(`${API_BASE}/api/generate-clip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(genPayload),
          });
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 405) {
            throw new Error("Static server blocked POST /api/generate-clip (HTTP 405). Open http://127.0.0.1:8000 or connect Local Engine.");
          }
          throw new Error(err.detail || "Failed to cut video clip.");
        }
        clipData = await res.json();
      }

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
      refreshStorageStats();
      showToast(`Clip #${clip.index} ready (${clipData.size_mb} MB)`);
      return clipData;
    } catch (err) {
      const msg = err.message || "Failed to cut video clip.";
      showToast(msg, true);
      if (activeClip && activeClip.id === clip.id && stageErrorOverlay && stageErrorMessage) {
        stageErrorMessage.textContent = msg;
        if (btnStageUseLocal) {
          const onLocal = API_BASE.includes("127.0.0.1") || API_BASE.includes("localhost");
          btnStageUseLocal.classList.toggle("hidden", onLocal && !isServerlessEnv);
        }
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
      updateCookiesHint(false);
      settingsModal.classList.remove("hidden");
      if (inputSettingsCookies) inputSettingsCookies.focus();
    });
  }
  if (btnStageUseLocal) {
    btnStageUseLocal.addEventListener("click", async () => {
      const ok = await switchToLocalEngine(false);
      if (ok && activeClip) {
        await renderAndPlayClip(activeClip);
      }
    });
  }

  function loadVideoPlayer(clipData) {
    isPlayingLiveSource = false;
    if (stageErrorOverlay) stageErrorOverlay.classList.add("hidden");
    if (sourceYoutubeFrame) {
      sourceYoutubeFrame.src = "";
      sourceYoutubeFrame.classList.add("hidden");
    }
    if (liveSubtitleTrack) liveSubtitleTrack.classList.add("hidden");
    if (liveBannerOverlay) liveBannerOverlay.classList.add("hidden");
    if (previewBackdrop) {
      previewBackdrop.pause();
      previewBackdrop.removeAttribute("src");
      previewBackdrop.classList.add("hidden");
    }
    playerPlaceholder.classList.add("hidden");
    previewVideo.classList.remove("hidden");
    previewVideo.style.objectFit = "cover";
    previewVideo.style.transform = "";
    previewVideo.style.filter = "";
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

    previewVideo.removeAttribute("data-live-url");
    previewVideo.src = streamUrl;
    previewVideo.playbackRate = speedSteps[speedIdx];
    previewVideo.load();

    previewVideo.onplay = () => {
      if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "pause"); refreshIcons(); }
    };
    previewVideo.onpause = () => {
      if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "play"); refreshIcons(); }
    };

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

  function updateLiveBanner() {
    if (!liveBannerOverlay || !liveBannerOverlayText || !activeClip) return;
    if (!isPlayingLiveSource) {
      liveBannerOverlay.classList.add("hidden");
      return;
    }
    const bannerOn = chkWorkspaceBanner ? chkWorkspaceBanner.checked : true;
    if (bannerOn && activeClip.hook_title) {
      liveBannerOverlayText.textContent = activeClip.hook_title.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
      liveBannerOverlay.classList.remove("hidden");
    } else {
      liveBannerOverlay.classList.add("hidden");
    }
  }

  function updateLiveSubtitles(absT) {
    if (!liveSubtitleTrack || !liveCaptionBox || !activeClip) return;
    if (!isPlayingLiveSource) {
      liveSubtitleTrack.classList.add("hidden");
      return;
    }
    const words = getActiveWords(activeClip);
    if (!words || !words.length) {
      liveSubtitleTrack.classList.add("hidden");
      return;
    }

    const curIdx = words.findIndex((w) => absT >= w.start && absT <= w.end);
    const activeIdx = curIdx >= 0 ? curIdx : Math.max(0, words.findIndex((w) => absT < w.start));
    if (activeIdx < 0 || activeIdx >= words.length) {
      liveSubtitleTrack.classList.add("hidden");
      return;
    }

    const capScale = captionSizeSelect ? (parseFloat(captionSizeSelect.value) || 1) : 1;
    const capPos = captionPosSelect ? captionPosSelect.value : "bottom";
    liveSubtitleTrack.style.bottom = capPos === "center" ? "44%" : capPos === "lower" ? "26%" : "12%";

    const styleId = workspaceCaptionSelect ? workspaceCaptionSelect.value : (captionSelect ? captionSelect.value : "hormozi");
    const groupSize = (styleId === "minimal" || styleId === "podcast") ? 4 : 3;
    const groupStart = Math.floor(Math.max(0, activeIdx) / groupSize) * groupSize;
    const chunkWords = words.slice(groupStart, groupStart + groupSize);

    liveCaptionBox.className = `live-caption-box caption-style-${styleId}`;
    liveCaptionBox.style.fontSize = `${Math.round(16 * capScale)}px`;
    const isCaps = styleId === "hormozi" || styleId === "mrbeast" || styleId === "neon";
    liveCaptionBox.innerHTML = chunkWords.map((w, idx) => {
      const isWordActive = (groupStart + idx) === activeIdx;
      const text = isCaps ? String(w.word || "").toUpperCase() : String(w.word || "");
      let color = "#ffffff";
      if (isWordActive) {
        if (styleId === "mrbeast") color = "#ff2d2d";
        else if (styleId === "tiktok") color = "#fe2c55";
        else if (styleId === "neon") color = "#00ffff";
        else if (styleId === "podcast") color = "#fbbf24";
      } else {
        if (styleId === "mrbeast") color = "#fde047";
      }
      return `<span class="${isWordActive ? "live-word-active" : ""}" style="color:${color};">${text}</span>`;
    }).join(" ");

    liveSubtitleTrack.classList.remove("hidden");
  }

  function togglePlayPause() {
    if (!previewVideo || !previewVideo.src) return;
    if (previewVideo.paused) {
      previewVideo.play().then(() => {
        if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "pause"); refreshIcons(); }
        if (isPlayingLiveSource && previewBackdrop && previewBackdrop.src && previewBackdrop.paused) previewBackdrop.play().catch(() => {});
      }).catch(() => {});
    } else {
      previewVideo.pause();
      if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "play"); refreshIcons(); }
      if (previewBackdrop && !previewBackdrop.paused) previewBackdrop.pause();
    }
  }

  if (previewVideo) {
    previewVideo.addEventListener("click", () => togglePlayPause());
    previewVideo.addEventListener("play", () => {
      if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "pause"); refreshIcons(); }
      if (isPlayingLiveSource && previewBackdrop && previewBackdrop.src && previewBackdrop.paused) previewBackdrop.play().catch(() => {});
    });
    previewVideo.addEventListener("pause", () => {
      if (playPauseIcon) { playPauseIcon.setAttribute("data-lucide", "play"); refreshIcons(); }
      if (previewBackdrop && !previewBackdrop.paused) previewBackdrop.pause();
    });
  }

  if (btnPlayPause) btnPlayPause.addEventListener("click", togglePlayPause);
  if (btnJumpBack) {
    btnJumpBack.addEventListener("click", () => {
      if (!previewVideo) return;
      if (isPlayingLiveSource && activeClip) {
        previewVideo.currentTime = Math.max(activeClip.start_time, previewVideo.currentTime - 2);
      } else {
        previewVideo.currentTime = Math.max(0, previewVideo.currentTime - 2);
      }
    });
  }
  if (btnJumpForward) {
    btnJumpForward.addEventListener("click", () => {
      if (!previewVideo) return;
      if (isPlayingLiveSource && activeClip) {
        previewVideo.currentTime = Math.min(activeClip.end_time - 0.15, previewVideo.currentTime + 2);
      } else {
        previewVideo.currentTime = Math.min(previewVideo.duration || 9999, previewVideo.currentTime + 2);
      }
    });
  }
  if (btnSetMarkIn) {
    btnSetMarkIn.addEventListener("click", () => {
      if (!activeClip || !previewVideo) return;
      const cur = previewVideo.currentTime || 0;
      const absNow = isPlayingLiveSource ? cur : (activeClip.start_time + cur);
      if (absNow < activeClip.end_time - 2) {
        activeClip.start_time = Number(Math.max(0, absNow).toFixed(2));
        onClipEdited();
        showToast(`Marked Start: ${formatTime(activeClip.start_time)}`);
      } else {
        showToast("Start point must stay before End point", true);
      }
    });
  }
  if (btnSetMarkOut) {
    btnSetMarkOut.addEventListener("click", () => {
      if (!activeClip || !previewVideo) return;
      const cur = previewVideo.currentTime || 0;
      const absNow = isPlayingLiveSource ? cur : (activeClip.start_time + cur);
      if (absNow > activeClip.start_time + 2) {
        activeClip.end_time = Number(Math.min(totalVideoDuration || 36000, absNow).toFixed(2));
        onClipEdited();
        showToast(`Marked End: ${formatTime(activeClip.end_time)}`);
      } else {
        showToast("End point must stay after Start point", true);
      }
    });
  }

  if (studioFilterSelect) {
    studioFilterSelect.addEventListener("change", () => {
      applyVideoStageTransform();
      onClipEdited(false);
    });
  }
  if (studioFitSelect) {
    studioFitSelect.addEventListener("change", () => {
      layoutSelect.value = studioFitSelect.value;
      applyVideoStageTransform();
      onClipEdited(false);
    });
  }
  if (studioPanSelect) {
    studioPanSelect.addEventListener("change", () => {
      applyVideoStageTransform();
      onClipEdited(false);
    });
  }
  if (studioZoomSelect) {
    studioZoomSelect.addEventListener("change", () => {
      applyVideoStageTransform();
      onClipEdited(false);
    });
  }

  document.querySelectorAll(".hook-preset-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      if (!activeClip || !inputHookTitle) return;
      const text = pill.dataset.hook;
      inputHookTitle.value = text;
      activeClip.hook_title = text;
      onClipEdited(true);
      showToast(`Hook updated: ${text}`);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === "KeyJ" || e.code === "ArrowLeft") {
      e.preventDefault();
      if (btnJumpBack) btnJumpBack.click();
    } else if (e.code === "KeyL" || e.code === "ArrowRight") {
      e.preventDefault();
      if (btnJumpForward) btnJumpForward.click();
    } else if (e.code === "KeyK") {
      e.preventDefault();
      if (previewVideo) previewVideo.pause();
    } else if (e.code === "KeyI") {
      if (btnSetMarkIn) btnSetMarkIn.click();
    } else if (e.code === "KeyO") {
      if (btnSetMarkOut) btnSetMarkOut.click();
    } else if (e.code === "KeyM") {
      if (btnToggleSound) btnToggleSound.click();
    }
  });

  if (btnDownloadClip) {
    btnDownloadClip.addEventListener("click", async () => {
      if (!activeClip) return;
      const rendered = renderedClipsMap[activeClip.id];
      const isFresh = rendered && rendered.signature === getClipSignature(activeClip);

      if (isFresh) {
        triggerClipDownload(rendered, `klipnux_short_${activeClip.index}.mp4`);
        showToast(`Downloading Short #${activeClip.index}...`);
      } else {
        showToast(`Rendering 1080p Short #${activeClip.index}...`);
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
      soundIcon.style.color = previewVideo.muted ? "#fbbf24" : "#0ec88a";
      refreshIcons();
    });
  }

  if (btnPlaybackSpeed) {
    btnPlaybackSpeed.addEventListener("click", () => {
      speedIdx = (speedIdx + 1) % speedSteps.length;
      const rate = speedSteps[speedIdx];
      previewVideo.playbackRate = rate;
      if (previewBackdrop) previewBackdrop.playbackRate = rate;
      btnPlaybackSpeed.textContent = `${rate}x`;
    });
  }

  function seekWaveformByClientX(clientX) {
    if (!previewVideo || !waveformContainer) return;
    const rect = waveformContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    if (isPlayingLiveSource && activeClip) {
      const dur = Math.max(1, activeClip.end_time - activeClip.start_time);
      previewVideo.currentTime = activeClip.start_time + pct * dur;
    } else if (previewVideo.duration) {
      previewVideo.currentTime = pct * previewVideo.duration;
    }
  }

  function initWaveform(peaksArray) {
    if (!waveformContainer) return;
    const peaks = Array.isArray(peaksArray) && peaksArray.length >= 16
      ? peaksArray
      : [35, 60, 75, 45, 88, 70, 40, 82, 95, 58, 68, 90, 52, 42, 78, 84, 62, 88, 96, 72, 48, 66, 80, 92, 84, 68, 56, 86, 94, 52, 44, 78, 90, 70, 58, 82, 96, 86, 62, 48, 72, 84, 92, 68, 54, 78, 88, 58];

    waveformContainer.innerHTML = `<div id="waveformCutRange" class="waveform-cut-range hidden"></div><div id="waveformPlayhead" style="position: absolute; top: 0; bottom: 0; width: 2px; background: var(--brand-emerald); z-index: 20; pointer-events: none; left: 0%;"></div>`;
    peaks.forEach((h) => {
      const bar = document.createElement("div");
      bar.className = "waveform-bar";
      bar.style.height = `${Math.max(14, Math.min(100, h))}%`;
      bar.style.backgroundColor = "#d2d2d7";
      waveformContainer.appendChild(bar);
    });

    const cutRange = document.getElementById("waveformCutRange");
    if (cutRange && activeClip && totalVideoDuration > 0) {
      const leftPct = Math.max(0, Math.min(95, (activeClip.start_time / totalVideoDuration) * 100));
      const widthPct = Math.max(2, Math.min(100 - leftPct, (activeClip.duration / totalVideoDuration) * 100));
      cutRange.style.left = `${leftPct}%`;
      cutRange.style.width = `${widthPct}%`;
      cutRange.classList.remove("hidden");
    }

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
      let dur = Math.max(1, previewVideo.duration || activeClip.duration || 1);
      let rel = previewVideo.currentTime || 0;
      let absT = activeClip.start_time + rel;

      if (isPlayingLiveSource) {
        dur = Math.max(1, activeClip.end_time - activeClip.start_time);
        if (previewVideo.currentTime >= activeClip.end_time - 0.08) {
          previewVideo.currentTime = activeClip.start_time;
          if (previewBackdrop && previewBackdrop.src) previewBackdrop.currentTime = activeClip.start_time;
          rel = 0;
        } else if (previewVideo.currentTime < activeClip.start_time - 0.35) {
          previewVideo.currentTime = activeClip.start_time;
          rel = 0;
        } else {
          rel = Math.max(0, Math.min(dur, previewVideo.currentTime - activeClip.start_time));
        }
        absT = activeClip.start_time + rel;
      }

      const pct = Math.min(100, Math.max(0, (rel / dur) * 100));

      const ph = document.getElementById("waveformPlayhead");
      if (ph) ph.style.left = `${pct}%`;
      if (waveformTimecode) waveformTimecode.textContent = `${formatTime(rel)} / ${formatTime(dur)}`;
      if (playheadTimecode) playheadTimecode.textContent = `${formatTime(rel)} / ${formatTime(dur)}`;

      if (isPlayingLiveSource && previewBackdrop && previewBackdrop.src && !previewBackdrop.paused && Math.abs(previewBackdrop.currentTime - previewVideo.currentTime) > 0.28) {
        previewBackdrop.currentTime = previewVideo.currentTime;
      }

      const bars = document.querySelectorAll("#waveformContainer .waveform-bar");
      const activeIdx = Math.floor((pct / 100) * bars.length);
      bars.forEach((b, idx) => {
        b.style.backgroundColor = idx <= activeIdx ? "var(--brand-violet)" : "#d2d2d7";
      });

      document.querySelectorAll(`#inspectorTranscriptBox .transcript-word[data-clip-id="${activeClip.id}"]`).forEach((el) => {
        const s = parseFloat(el.dataset.start);
        const e = parseFloat(el.dataset.end);
        el.classList.toggle("active-word", absT >= s && absT <= e);
      });

      updateLiveSubtitles(absT);
      updateLiveBanner();
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
      showToast(`Copied caption copy for Clip #${activeClip.index}`);
    });
  }

  async function runBatchRender(targets) {
    for (let i = 0; i < targets.length; i++) {
      const clip = targets[i];
      if (batchBtnLabel) batchBtnLabel.textContent = `Cutting ${i + 1}/${targets.length}...`;
      const sig = getClipSignature(clip);
      try {
        let clipData = null;
        if (currentVideoUrl && currentVideoUrl.startsWith("local://browser/") && localClientSession) {
          clipData = await cutClientLocalClip(clip);
        } else {
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
              cookies_txt: getStoredCookies() || null,
            }),
          });
          if (res.ok) {
            clipData = await res.json();
          }
        }
        if (clipData) {
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
    refreshStorageStats();
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
      refreshStorageStats();
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
      dv.setUint16(8, 0, true);
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
      let blob = null;
      const isClientOnlyMode = !apiConnected || (currentVideoUrl && currentVideoUrl.startsWith("local://browser/"));
      let res = null;
      if (!isClientOnlyMode) {
        if (selectedFilenames.length > 0) {
          res = await fetch(`${API_BASE}/api/download-zip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filenames: selectedFilenames }),
          });
        } else {
          res = await fetch(`${API_BASE}/api/download-all-zip`);
        }
      }

      if (res && res.ok) {
        blob = await res.blob();
      } else {
        const memEntries = [];
        for (const c of Object.values(renderedClipsMap)) {
          if (!c || !c.filename) continue;
          if (selectedFilenames.length > 0 && !selectedFilenames.includes(c.filename)) continue;
          if (c.blob_url) {
            const cleanBlobUrl = c.blob_url.split("#")[0];
            const ab = await (await fetch(cleanBlobUrl)).arrayBuffer();
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
          const err = res ? await res.json().catch(() => ({})) : {};
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
      showToast("Downloaded klipnux ZIP pack");
    } catch (err) {
      showToast(err.message || "Failed to download ZIP pack", true);
    }
  }
  if (btnDownloadZip) btnDownloadZip.addEventListener("click", triggerZipExport);
  if (btnDownloadAllTop) btnDownloadAllTop.addEventListener("click", triggerZipExport);

  // Initial Hydration
  resolveWorkingApiBase().then(() => {
    loadServerSettings();
    refreshStorageStats();
  });
});
