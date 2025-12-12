// --- Eye-Typing Keyboard: Only right eye held closed selects letter; no other right eye effects ---

document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('video');
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');
  const letterGrid = document.getElementById('word-grid');
  const sentenceSpan = document.getElementById('sentence');
  const playBtn = document.getElementById('play-btn');
  const instructions = document.getElementById('instructions');
  const hideInstructionsBtn = document.getElementById('hide-instructions');
  const yesBtn = document.getElementById('yes-btn');
  const noBtn = document.getElementById('no-btn');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // --- Letters, Numbers + Special Keys ---
  const lettersArray = [
    "YES", "NO",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ..."0123456789",
    "Space", "Delete"
  ];

  let letters = [];
  let activeIndex = 0;

  // --- Populate grid ---
  letterGrid.innerHTML = '';
  lettersArray.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'letter';
    div.textContent = l;
    div.tabIndex = 0;
    div.addEventListener('click', () => selectLetter(i));
    letterGrid.appendChild(div);
    letters.push(div);
  });

  yesBtn.addEventListener('click', () => selectLetter(0));
  noBtn.addEventListener('click', () => selectLetter(1));

  function setActiveLetter(index) {
    letters.forEach((l, i) => l.classList.toggle('active', i === index));
    yesBtn.classList.toggle('selected', index === 0);
    noBtn.classList.toggle('selected', index === 1);
    activeIndex = index;
    if (index > 1 && letters[index]) letters[index].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  function selectLetter(index) {
    const value = letters[index].textContent;
    if (value === "YES" || value === "NO") {
      const w = value + " ";
      if (!sentenceSpan.textContent.endsWith(w)) sentenceSpan.textContent += w;
    } else if (value === "Space") {
      if (sentenceSpan.textContent.slice(-1) !== " " && sentenceSpan.textContent !== "") {
        sentenceSpan.textContent += " ";
      }
    } else if (value === "Delete") {
      sentenceSpan.textContent = sentenceSpan.textContent.slice(0, -1);
    } else {
      sentenceSpan.textContent += value;
    }
  }

  setActiveLetter(0);

  hideInstructionsBtn.addEventListener('click', () => instructions.style.display = 'none');
  instructions.onmousedown = function (e) {
    let shiftX = e.clientX - instructions.getBoundingClientRect().left;
    let shiftY = e.clientY - instructions.getBoundingClientRect().top;
    function moveAt(pageX, pageY) { instructions.style.left = pageX - shiftX + 'px'; instructions.style.top = pageY - shiftY + 'px'; }
    function onMouseMove(e) { moveAt(e.pageX, e.pageY); }
    document.addEventListener('mousemove', onMouseMove);
    document.onmouseup = function () { document.removeEventListener('mousemove', onMouseMove); document.onmouseup = null; }
  };
  instructions.ondragstart = () => false;

  function speakSentence() {
    if (sentenceSpan.textContent.trim().length === 0) return;
    const utter = new SpeechSynthesisUtterance(sentenceSpan.textContent.trim());
    utter.rate = 0.7;
    utter.pitch = 1;
    speechSynthesis.speak(utter);
  }
  playBtn.addEventListener('click', speakSentence);

  function stopSpeaking() {
    speechSynthesis.cancel();
  }

  function enablePlayBtn() {
    playBtn.disabled = false;
    playBtn.style.opacity = 1;
    playBtn.style.pointerEvents = 'auto';
  }
  enablePlayBtn();
  setInterval(enablePlayBtn, 500);

  // --- Eye Tracking with MediaPipe FaceMesh ---
  const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
  faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

  // Gesture logic:
  let readyForHorizontalMove = false;
  let centerHoldStart = 0, sideHoldStart = 0;
  let lastDirection = null;
  const NEUTRAL_HOLD = 250;
  const SIDE_HOLD = 550;
  const leftThreshold = 0.44;
  const rightThreshold = 0.74;

  const EAR_THRESHOLD = 0.25;
  const BLINK_COOLDOWN = 400;
  const HOLD_DURATION = 1200;
  const LONG_BLINK_DURATION = 600;
  const RIGHT_EYE_HOLD_DURATION = 650; // ms to trigger selection

  let framesClosed = 0, lastBlinkTime = 0, blinkStartTime = 0;
  let rightEyeHoldStart = 0, rightEyeHoldActive = false, rightEyeHoldDone = false;
  let leftEyeHoldStart = 0, leftEyeHoldActive = false, leftEyeHoldDone = false;

  faceMesh.onResults((results) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!results.multiFaceLandmarks[0]) return;
    const lm = results.multiFaceLandmarks[0];
    const now = Date.now();

    // --- Eye Ratio Calculation (EAR) ---
    const earL = Math.hypot(lm[159].x - lm[145].x, lm[159].y - lm[145].y) / Math.hypot(lm[33].x - lm[133].x, lm[33].y - lm[133].y);
    const earR = Math.hypot(lm[386].x - lm[374].x, lm[386].y - lm[374].y) / Math.hypot(lm[362].x - lm[263].x, lm[362].y - lm[263].y);

    // --- RIGHT EYE HOLD (not blink): select letter only if hold is long enough; otherwise does nothing ---
    if (earL < EAR_THRESHOLD && earR >= EAR_THRESHOLD) {
      if (!rightEyeHoldActive) {
        rightEyeHoldStart = now;
        rightEyeHoldActive = true;
        rightEyeHoldDone = false;
      }
      if (!rightEyeHoldDone && now - rightEyeHoldStart > RIGHT_EYE_HOLD_DURATION) {
        selectLetter(activeIndex);
        rightEyeHoldDone = true;
      }
    } else {
      rightEyeHoldActive = false;
      rightEyeHoldDone = false;
      rightEyeHoldStart = 0;
    }

    // --- LEFT EYE hold: delete last (long), blink: play sentence (short) ---
    if (earR < EAR_THRESHOLD && earL >= EAR_THRESHOLD) {
      if (!leftEyeHoldActive) {
        leftEyeHoldStart = now;
        leftEyeHoldActive = true;
        leftEyeHoldDone = false;
      }
      if (!leftEyeHoldDone && now - leftEyeHoldStart > HOLD_DURATION) {
        sentenceSpan.textContent = sentenceSpan.textContent.slice(0, -1);
        lastBlinkTime = now;
        leftEyeHoldDone = true;
      }
    } else if (leftEyeHoldActive) {
      if (!leftEyeHoldDone && now - leftEyeHoldStart > BLINK_COOLDOWN) {
        speakSentence();
        lastBlinkTime = now;
      }
      leftEyeHoldActive = false;
      leftEyeHoldDone = false;
      leftEyeHoldStart = 0;
    }

    // --- Both eyes closed (long blink) to add space and highlight box ---
    if (earL < EAR_THRESHOLD && earR < EAR_THRESHOLD) {
      framesClosed++;
      if (framesClosed === 1) blinkStartTime = now;
      if (now - blinkStartTime >= LONG_BLINK_DURATION && now - lastBlinkTime > BLINK_COOLDOWN) {
        const prevIndex = activeIndex;
        const spaceIndex = lettersArray.findIndex(x => x === "Space");
        if (spaceIndex > -1) {
          setActiveLetter(spaceIndex);
          selectLetter(spaceIndex);
          setTimeout(() => setActiveLetter(prevIndex), 350);
        }
        lastBlinkTime = now;
        framesClosed = 0;
        blinkStartTime = 0;
      }
    } else {
      framesClosed = 0;
      blinkStartTime = 0;
    }

    // --- Robust, deliberate single-step horizontal gaze movement with required center-hold ---
    const leftIris = lm[468], leftEyeInner = lm[133], leftEyeOuter = lm[33];
    const ratioX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);

    let region = "center";
    if (ratioX < leftThreshold) region = "left";
    else if (ratioX > rightThreshold) region = "right";

    if (region === "center") {
      if (!centerHoldStart) centerHoldStart = now;
      if ((now - centerHoldStart) > NEUTRAL_HOLD) {
        readyForHorizontalMove = true;
        lastDirection = null;
      }
      sideHoldStart = 0;
    } else if (region === "left") {
      if (readyForHorizontalMove && lastDirection !== "left") {
        if (!sideHoldStart) sideHoldStart = now;
        if ((now - sideHoldStart) > SIDE_HOLD) {
          setActiveLetter((activeIndex - 1 + letters.length) % letters.length);
          lastDirection = "left";
          readyForHorizontalMove = false;
          centerHoldStart = 0;
          sideHoldStart = 0;
        }
      } else if (lastDirection === "left") {
        sideHoldStart = 0;
      }
    } else if (region === "right") {
      if (readyForHorizontalMove && lastDirection !== "right") {
        if (!sideHoldStart) sideHoldStart = now;
        if ((now - sideHoldStart) > SIDE_HOLD) {
          setActiveLetter((activeIndex + 1) % letters.length);
          lastDirection = "right";
          readyForHorizontalMove = false;
          centerHoldStart = 0;
          sideHoldStart = 0;
        }
      } else if (lastDirection === "right") {
        sideHoldStart = 0;
      }
    }
    if (region !== "center") centerHoldStart = 0;
  });

  // --- Start camera ---
  const camera = new Camera(video, {
    onFrame: async () => { await faceMesh.send({ image: video }); },
    width: 640, height: 480
  });
  camera.start();
});
