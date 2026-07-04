/* ============================================================
   הילה HALO - מנוע האתר
   גולל קליפ מצולם אחד (media/film.mp4 / film_m.mp4) לפי מיקום
   הגלילה. Vanilla JS, בלי תלויות.
   DUR = משכי הסצנות האמיתיים בסרט (מתעדכן אחרי הרכבת הסרט).
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mqMobile = window.matchMedia("(max-width: 820px), (orientation: portrait)");

  var film  = document.getElementById("film");
  var video = document.getElementById("filmVideo");
  var caps  = Array.prototype.slice.call(document.querySelectorAll(".cap"));
  var dots  = Array.prototype.slice.call(document.querySelectorAll(".dots a"));
  var cue   = document.getElementById("scrollCue");
  var nav   = document.getElementById("nav");
  var pbar  = document.getElementById("progress");

  /* משכי הקליפים -> רצועות סצנה כחלק יחסי מהסרט */
  var DUR = [8.041667, 6.041667, 6.041667, 6.041667, 6.041667];
  var TOTAL = DUR.reduce(function (a, b) { return a + b; }, 0);
  var bands = (function () {
    var out = [], acc = 0;
    DUR.forEach(function (d) { var from = acc / TOTAL; acc += d; out.push({ from: from, to: acc / TOTAL }); });
    return out;
  })();

  /* ---------- מקור הסרט (מחשב/נייד) + הכנה לניגון ---------- */
  var ready = false, primed = false;
  function wantSrc() { return mqMobile.matches ? video.dataset.srcM : video.dataset.src; }
  function loadFilm() {
    var want = wantSrc();
    if (video.getAttribute("src") !== want) {
      video.setAttribute("src", want);
      video.load();
      ready = false; primed = false;
    }
  }
  video.addEventListener("loadedmetadata", function () { ready = true; update(); });
  /* "הצתה" של הדיקודר כדי שסיק יצייר פריימים (בעיקר iOS Safari) */
  function prime() {
    if (primed) return;
    primed = true;
    var p = video.play();
    if (p && p.then) p.then(function () { video.pause(); }).catch(function () { primed = false; });
    else { try { video.pause(); } catch (e) {} }
  }

  /* ---------- מנוע הגלילה (מיפוי ישיר: גלילה -> זמן בסרט) ---------- */
  function dur() { return (video.duration && isFinite(video.duration)) ? video.duration : TOTAL; }

  function filmProgress() {
    var scrollable = film.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    var top = film.getBoundingClientRect().top;
    var p = -top / scrollable;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }
  function activeIndex(p) {
    for (var i = 0; i < bands.length; i++) { if (p < bands[i].to) return i; }
    return bands.length - 1;
  }
  var lastP = 0;
  function bufferedEnd() {
    try { return video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0; } catch (e) { return 0; }
  }
  /* לא מחפשים מעבר למה שכבר ירד - מונע קפיאה ב-iOS בגלילה מהירה */
  function seek(t) {
    if (!ready) return;
    var safe = Math.min(t, Math.max(0, bufferedEnd() - 0.05));
    try { video.currentTime = safe; } catch (e) {}
  }

  var revealEls = [];
  function runReveals() {
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    for (var k = 0; k < revealEls.length; k++) {
      if (!revealEls[k].classList.contains("is-in") &&
          revealEls[k].getBoundingClientRect().top < vh * 0.92) {
        revealEls[k].classList.add("is-in");
      }
    }
  }

  function update() {
    var p = filmProgress();
    lastP = p;
    var idx = activeIndex(p);
    for (var i = 0; i < caps.length; i++) caps[i].classList.toggle("is-active", i === idx);
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("is-active", j === idx);
    if (cue) cue.style.opacity = p > 0.02 ? "0" : "";
    seek(p * dur());
  }

  /* ---------- גלילה: סקראב + פס התקדמות + ניווט ---------- */
  function onScroll() {
    update();
    var st = window.scrollY || window.pageYOffset;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (pbar) pbar.style.width = (h > 0 ? (st / h) * 100 : 0) + "%";
    if (nav) nav.classList.toggle("is-scrolled", st > 40);
    runReveals();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update, { passive: true });

  /* ---------- אתחול ---------- */
  loadFilm();
  prime();
  revealEls = Array.prototype.slice.call(document.querySelectorAll(".trust li, .visit__block, .lead-form"));
  if (!prefersReduced) document.documentElement.classList.add("reveal-on");
  video.addEventListener("progress", function () { seek(lastP * dur()); });
  ["touchstart", "pointerdown", "click", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, prime, { once: true, passive: true });
  });
  onScroll();

  function onMQ() { loadFilm(); prime(); update(); }
  if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMQ);
  else if (mqMobile.addListener) mqMobile.addListener(onMQ);

  /* נקודות -> קפיצה לנקודת הסצנה בסרט */
  function scrollToBand(i) {
    var scrollable = film.offsetHeight - window.innerHeight;
    var mid = (bands[i].from + bands[i].to) / 2;
    window.scrollTo({ top: Math.round(film.offsetTop + mid * scrollable), behavior: "smooth" });
  }
  dots.forEach(function (d, i) {
    d.addEventListener("click", function (e) { e.preventDefault(); scrollToBand(i); });
  });
  if (cue) cue.addEventListener("click", function (e) { e.preventDefault(); scrollToBand(1); });

  /* ---------- תפריט נייד ---------- */
  var toggle = document.getElementById("navToggle");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
  document.querySelectorAll("[data-link]").forEach(function (a) {
    a.addEventListener("click", function () { if (nav) nav.classList.remove("is-open"); });
  });

  /* ============================================================
     הקולקציה - החלפת טבעת וסוג זהב בזמן אמת
     ============================================================ */
  var RINGS = {
    ring1: {
      name: "סוליטר קלאסית",
      desc: "יהלום עגול בליטוש Round Brilliant על רצועה מעוגלת ונקייה. הקלאסיקה שלעולם אינה מתיישנת.",
      price: "8,900 ₪"
    },
    ring2: {
      name: "הילה מלכותית",
      desc: "יהלום אובל מוקף הילת יהלומים עדינה. הטבעת שהעניקה לבית שלנו את שמו.",
      price: "12,400 ₪"
    },
    ring3: {
      name: "פרינסס מודרנית",
      desc: "יהלום מרובע בחיתוך פרינסס עם שיבוץ פאווה לאורך הרצועה. גיאומטרית, נועזת, עכשווית.",
      price: "10,600 ₪"
    }
  };
  var state = { ring: "ring1", gold: "yellow" };

  var viewerImgs = Array.prototype.slice.call(document.querySelectorAll(".viewer__frame img"));
  var ringTabs   = Array.prototype.slice.call(document.querySelectorAll(".ring-tab"));
  var goldBtns   = Array.prototype.slice.call(document.querySelectorAll(".gold-btn"));
  var ringTitle  = document.getElementById("ringTitle");
  var ringDesc   = document.getElementById("ringDesc");
  var ringPrice  = document.getElementById("ringPrice");

  function renderShowcase() {
    var key = state.ring + "_" + state.gold;
    viewerImgs.forEach(function (img) {
      img.classList.toggle("is-active", img.dataset.key === key);
    });
    ringTabs.forEach(function (t) {
      var on = t.dataset.ring === state.ring;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    goldBtns.forEach(function (b) {
      var on = b.dataset.gold === state.gold;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    var r = RINGS[state.ring];
    if (ringTitle) ringTitle.textContent = r.name;
    if (ringDesc)  ringDesc.textContent  = r.desc;
    if (ringPrice) ringPrice.textContent = r.price;
  }
  ringTabs.forEach(function (t) {
    t.addEventListener("click", function () { state.ring = t.dataset.ring; renderShowcase(); });
  });
  goldBtns.forEach(function (b) {
    b.addEventListener("click", function () { state.gold = b.dataset.gold; renderShowcase(); });
  });

  /* ============================================================
     טופס תיאום פגישה (אתר דוגמה - בלי שליחה לשרת)
     ============================================================ */
  var form = document.getElementById("leadForm");
  if (form) {
    var fldName  = document.getElementById("fldName");
    var fldPhone = document.getElementById("fldPhone");
    var errName  = document.getElementById("errName");
    var errPhone = document.getElementById("errPhone");
    var success  = document.getElementById("formSuccess");
    var submitBtn = form.querySelector(".lead-form__submit");

    var submitAttempted = false;
    function setInvalid(input, errEl, bad) {
      input.closest(".field").classList.toggle("is-invalid", bad);
      errEl.hidden = !bad;
      input.setAttribute("aria-invalid", String(bad));
    }
    /* ולידציה בעזיבת שדה, לא בכל הקשה; שדה ריק שלא נגעו בו לא מסומן
       כשגוי לפני ניסיון שליחה ראשון */
    fldName.addEventListener("blur", function () {
      if (!submitAttempted && fldName.value.trim() === "") return;
      setInvalid(fldName, errName, fldName.value.trim().length < 2);
    });
    fldPhone.addEventListener("blur", function () {
      if (!submitAttempted && fldPhone.value.trim() === "") return;
      var digits = fldPhone.value.replace(/\D/g, "");
      setInvalid(fldPhone, errPhone, digits.length < 9);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitAttempted = true;
      var badName  = fldName.value.trim().length < 2;
      var badPhone = fldPhone.value.replace(/\D/g, "").length < 9;
      setInvalid(fldName, errName, badName);
      setInvalid(fldPhone, errPhone, badPhone);
      if (badName)  { fldName.focus(); return; }
      if (badPhone) { fldPhone.focus(); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = "שולחים...";
      setTimeout(function () {
        success.hidden = false;
        submitBtn.textContent = "נשלח בהצלחה";
        form.reset();
      }, 700);
    });
  }
})();
