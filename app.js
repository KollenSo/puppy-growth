(() => {
  "use strict";

  // Game progress starts at $0 until boss begins saving next month.
  // IB snapshot is shown for reference but EXCLUDED from puppy growth.
  const GAME_BASELINE_HKD = 0;
  const SAVING_STARTS_NOTE = "下個月開始存錢先計入養成進度";

  const STAGES = [
    { min: 0,  max: 10,  id: 0, name: "新生小狗", src: "assets/stages/stage-0.jpg", desc: "啱啱出世嘅小狗 · 小小隻好得意" },
    { min: 10, max: 25,  id: 1, name: "小小狗",   src: "assets/stages/stage-1.jpg", desc: "開始識行識玩" },
    { min: 25, max: 50,  id: 2, name: "成長中",   src: "assets/stages/stage-2.jpg", desc: "愈嚟愈壯健" },
    { min: 50, max: 75,  id: 3, name: "青少年",   src: "assets/stages/stage-3.jpg", desc: "活力滿滿，快要長大" },
    { min: 75, max: 101, id: 4, name: "成犬",     src: "assets/stages/stage-4.jpg", desc: "目標達成附近 · 好威！" },
  ];

  const STORAGE_KEY = "puppyGrowth_v2";
  const COOLDOWNS = { feed: 8000, play: 6000, pet: 4000 };
  const DECAY_MS = 15000;
  const DECAY = { hunger: 2, happy: 1.5 };
  const RING = 2 * Math.PI * 30;

  const $ = (id) => document.getElementById(id);

  const els = {
    asOfLabel: $("asOfLabel"),
    stageBadge: $("stageBadge"),
    puppyStage: $("puppyStage"),
    puppyImg: $("puppyImg"),
    stageName: $("stageName"),
    stageDesc: $("stageDesc"),
    stageTip: $("stageTip"),
    progressPct: $("progressPct"),
    ringFg: $("ringFg"),
    barFill: $("barFill"),
    barTrack: $("barTrack"),
    totalHkd: $("totalHkd"),
    goalHkd: $("goalHkd"),
    breakdown: $("breakdown"),
    monthlyTip: $("monthlyTip"),
    hungerVal: $("hungerVal"),
    happyVal: $("happyVal"),
    affectionVal: $("affectionVal"),
    hungerFill: $("hungerFill"),
    happyFill: $("happyFill"),
    affectionFill: $("affectionFill"),
    btnFeed: $("btnFeed"),
    btnPlay: $("btnPlay"),
    btnPet: $("btnPet"),
    feedCd: $("feedCd"),
    playCd: $("playCd"),
    petCd: $("petCd"),
    fxLayer: $("fxLayer"),
    foodFly: $("foodFly"),
    toast: $("toast"),
    btnMute: $("btnMute"),
    statusBanner: $("statusBanner"),
  };

  let meters = loadMeters();
  let lastAction = { feed: 0, play: 0, pet: 0 };
  let muted = true;
  let audioCtx = null;

  function loadMeters() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return {
          hunger: clamp(d.hunger ?? 80, 0, 100),
          happy: clamp(d.happy ?? 80, 0, 100),
          affection: clamp(d.affection ?? 50, 0, 100),
          lastDecay: d.lastDecay || Date.now(),
        };
      }
    } catch (_) {}
    return { hunger: 80, happy: 80, affection: 50, lastDecay: Date.now() };
  }

  function saveMeters() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meters));
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function formatHkd(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return "$" + v.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function getStage(pct) {
    const p = Number(pct) || 0;
    for (const s of STAGES) {
      if (p >= s.min && p < s.max) return s;
    }
    return STAGES[STAGES.length - 1];
  }

  function nextThreshold(pct) {
    const p = Number(pct) || 0;
    for (const s of STAGES) {
      if (p < s.min) return s.min;
      if (p < s.max && s.max < 101) return s.max === 101 ? 100 : s.max;
    }
    return 100;
  }

  function beep(freq, dur, type = "sine", vol = 0.04) {
    if (muted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (_) {}
  }

  function applyOfflineDecay() {
    const now = Date.now();
    const elapsed = Math.max(0, now - (meters.lastDecay || now));
    const ticks = Math.floor(elapsed / DECAY_MS);
    if (ticks > 0) {
      meters.hunger = clamp(meters.hunger - ticks * DECAY.hunger, 0, 100);
      meters.happy = clamp(meters.happy - ticks * DECAY.happy, 0, 100);
      meters.lastDecay = now - (elapsed % DECAY_MS);
      saveMeters();
    }
  }

  function renderMeters() {
    els.hungerVal.textContent = Math.round(meters.hunger);
    els.happyVal.textContent = Math.round(meters.happy);
    els.affectionVal.textContent = Math.round(meters.affection);
    els.hungerFill.style.width = meters.hunger + "%";
    els.happyFill.style.width = meters.happy + "%";
    els.affectionFill.style.width = meters.affection + "%";
  }


  function setBanner(type, msg) {
    const el = els.statusBanner;
    if (!el) return;
    if (!msg) { el.hidden = true; return; }
    el.hidden = false;
    el.className = "banner " + type;
    el.textContent = msg;
  }

  function setStageImage(stage) {
    const img = els.puppyImg;
    if (!img) return;
    if (img.getAttribute("src") === stage.src) {
      img.alt = stage.name;
      return;
    }
    img.classList.remove("idle", "swap-in");
    img.classList.add("swap-out");
    const done = () => {
      img.src = stage.src;
      img.alt = stage.name;
      img.classList.remove("swap-out");
      img.classList.add("swap-in", "idle");
      setTimeout(() => img.classList.remove("swap-in"), 480);
    };
    setTimeout(done, 180);
  }


  function updateMilestones(pct) {
    const nodes = document.querySelectorAll("#milestoneNodes li");
    if (!nodes.length) return;
    const thresholds = [0, 10, 25, 50, 75];
    nodes.forEach((li, i) => {
      li.classList.remove("done", "current");
      const at = Number(li.getAttribute("data-at"));
      const nextAt = i + 1 < thresholds.length ? thresholds[i + 1] : 100;
      if (pct >= nextAt) li.classList.add("done");
      else if (pct >= at) li.classList.add("current");
    });
  }

  function setRing(pct) {
    if (!els.ringFg || !els.ringFg.style) return;
    const p = Math.min(100, Math.max(0, pct));
    const offset = RING * (1 - p / 100);
    els.ringFg.style.strokeDasharray = String(RING);
    els.ringFg.style.strokeDashoffset = String(offset);
  }

  function renderSavings(data) {
    const goal = Number(data.goalHkd) || 48000;
    const ibTotal = Number(data.totalApproxHkd) || 0;
    const gameTotal = GAME_BASELINE_HKD;
    const pct = goal > 0 ? (gameTotal / goal) * 100 : 0;
    const stage = getStage(pct);
    const nextPct = nextThreshold(pct);
    const needHkd = Math.max(0, (nextPct / 100) * goal - gameTotal);

    els.asOfLabel.textContent = "截至 " + (data.asOf || "—");
    els.progressPct.textContent = (pct < 10 ? pct.toFixed(1) : pct.toFixed(0)) + "%";
    setRing(pct);
    if (els.barFill) els.barFill.style.width = Math.min(100, pct) + "%";
    if (els.barTrack) els.barTrack.setAttribute("aria-valuenow", String(Math.round(pct)));
    updateMilestones(pct);
    els.totalHkd.textContent = formatHkd(gameTotal);
    els.goalHkd.textContent = formatHkd(goal);

    els.stageBadge.textContent = "階段 " + (stage.id + 1) + "／5";
    els.puppyStage.dataset.stage = String(stage.id);
    setStageImage(stage);
    els.stageName.textContent = stage.name;
    els.stageDesc.textContent = stage.desc;

    if (els.stageTip) {
      if (pct >= 100) {
        els.stageTip.hidden = false;
        els.stageTip.textContent = "目標達成";
      } else if (needHkd > 0 && nextPct <= 100) {
        // Keep tip element for logic but hide helper text by default (calm UI)
        els.stageTip.hidden = true;
        els.stageTip.textContent = "";
      } else {
        els.stageTip.hidden = true;
      }
    }
    if (els.stageDesc) els.stageDesc.hidden = true;

    const cash = Number(data.cashHkd) || 0;
    const pos = Number(data.positionsHkd) || 0;
    let posLines = "";
    if (Array.isArray(data.positions) && data.positions.length) {
      posLines = data.positions
        .map((p) => {
          const sym = p.symbol || "?";
          const q = p.qty != null ? p.qty : "";
          const mv = formatHkd(p.mktValueHkd);
          return `<div class="pos muted-row"><span>${sym}${q !== "" ? " × " + q : ""}</span><span>${mv}</span></div>`;
        })
        .join("");
    }
    // Breakdown kept in DOM for logic/debug but hidden in calm UI
    if (els.breakdown) {
      els.breakdown.innerHTML = "";
      els.breakdown.hidden = true;
    }
    if (els.monthlyTip) {
      els.monthlyTip.textContent = "";
      els.monthlyTip.hidden = true;
    }
    void ibTotal; void cash; void pos; void posLines;
  }

  function showToast(msg) {
    els.toast.hidden = false;
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove("show"), 1600);
  }

  function spawnParticles(emoji, count = 5) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = "particle";
      el.textContent = emoji;
      el.style.setProperty("--dx", Math.random() * 100 - 50 + "px");
      el.style.left = 35 + Math.random() * 30 + "%";
      el.style.top = 28 + Math.random() * 25 + "%";
      el.style.animationDelay = i * 0.04 + "s";
      els.fxLayer.appendChild(el);
      setTimeout(() => el.remove(), 1100);
    }
  }

  function animPup(cls) {
    els.puppyImg.classList.remove("bounce", "pet", "munch", "idle");
    void els.puppyImg.offsetWidth;
    els.puppyImg.classList.add(cls);
    setTimeout(() => {
      els.puppyImg.classList.remove(cls);
      els.puppyImg.classList.add("idle");
    }, 650);
  }

  function screenShake() {
    document.body.classList.remove("shake");
    void document.body.offsetWidth;
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 360);
  }

  function remainingCd(key) {
    return Math.max(0, COOLDOWNS[key] - (Date.now() - lastAction[key]));
  }

  function updateCooldownUI() {
    const map = [
      ["feed", els.btnFeed, els.feedCd],
      ["play", els.btnPlay, els.playCd],
      ["pet", els.btnPet, els.petCd],
    ];
    for (const [key, btn, cdEl] of map) {
      const left = remainingCd(key);
      if (left > 0) {
        btn.disabled = true;
        cdEl.hidden = false;
        cdEl.textContent = Math.ceil(left / 1000) + "s";
      } else {
        btn.disabled = false;
        cdEl.hidden = true;
      }
    }
  }

  function doFeed() {
    if (remainingCd("feed") > 0) return;
    lastAction.feed = Date.now();
    meters.hunger = clamp(meters.hunger + 18, 0, 100);
    meters.affection = clamp(meters.affection + 2, 0, 100);
    saveMeters();
    renderMeters();

    els.foodFly.hidden = false;
    els.foodFly.classList.remove("run");
    void els.foodFly.offsetWidth;
    els.foodFly.classList.add("run");
    clearTimeout(doFeed._t);
    doFeed._t = setTimeout(() => {
      els.foodFly.classList.remove("run");
      els.foodFly.hidden = true;
      animPup("munch");
      spawnParticles("✨", 3);
      spawnParticles("❤️", 2);
    }, 520);

    screenShake();
    beep(420, 0.08, "triangle");
    setTimeout(() => beep(520, 0.1, "sine"), 120);
    showToast("餵咗一餐！好滋味～");
    updateCooldownUI();
  }

  function doPlay() {
    if (remainingCd("play") > 0) return;
    lastAction.play = Date.now();
    meters.happy = clamp(meters.happy + 20, 0, 100);
    meters.hunger = clamp(meters.hunger - 4, 0, 100);
    meters.affection = clamp(meters.affection + 3, 0, 100);
    saveMeters();
    renderMeters();

    const ball = document.createElement("span");
    ball.className = "ball";
    ball.textContent = "🎾";
    els.fxLayer.appendChild(ball);
    setTimeout(() => ball.remove(), 900);

    animPup("bounce");
    spawnParticles("✨", 4);
    screenShake();
    beep(660, 0.07, "square", 0.03);
    setTimeout(() => beep(880, 0.08, "square", 0.03), 100);
    showToast("玩得開心！汪汪～");
    updateCooldownUI();
  }

  function doPet() {
    if (remainingCd("pet") > 0) return;
    lastAction.pet = Date.now();
    meters.affection = clamp(meters.affection + 12, 0, 100);
    meters.happy = clamp(meters.happy + 6, 0, 100);
    saveMeters();
    renderMeters();
    animPup("pet");
    spawnParticles("💕", 6);
    spawnParticles("✨", 2);
    beep(740, 0.12, "sine", 0.035);
    showToast("摸頭殺！親密度↑");
    updateCooldownUI();
  }

  async function loadSnapshot() {
    const res = await fetch("data/savings_snapshot.json", { cache: "no-store" });
    if (!res.ok) throw new Error("無法載入儲蓄快照");
    return res.json();
  }

  function tickDecay() {
    meters.hunger = clamp(meters.hunger - DECAY.hunger, 0, 100);
    meters.happy = clamp(meters.happy - DECAY.happy, 0, 100);
    meters.lastDecay = Date.now();
    saveMeters();
    renderMeters();
  }

  function updateMuteUI() {
    els.btnMute.textContent = muted ? "🔇" : "🔊";
    els.btnMute.setAttribute("aria-label", muted ? "開啟音效" : "靜音");
  }

  async function init() {
    applyOfflineDecay();
    renderMeters();
    updateCooldownUI();
    updateMuteUI();
    setRing(0);
    els.puppyImg.classList.add("idle");

    setBanner("", "");
    try {
      const data = await loadSnapshot();
      renderSavings(data);
      setBanner("", "");
    } catch (err) {
      els.stageName.textContent = "載入失敗";
      if (els.asOfLabel) els.asOfLabel.textContent = "";
      setBanner("error", "暫時載入唔到，請稍後再試。");
      showToast("儲蓄數據載入失敗");
      console.error(err);
    }

    els.btnFeed.addEventListener("click", doFeed);
    els.btnPlay.addEventListener("click", doPlay);
    els.btnPet.addEventListener("click", doPet);
    els.puppyImg.addEventListener("click", doPet);
    els.btnMute.addEventListener("click", () => {
      muted = !muted;
      updateMuteUI();
      if (!muted) beep(520, 0.08);
    });

    setInterval(updateCooldownUI, 250);
    setInterval(tickDecay, DECAY_MS);
  }

  init();
})();
