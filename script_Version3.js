// --- Eye-Typing Keyboard with Letters, Numbers, Special Keys, and Boxed UI ---

const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

const letterGrid = document.getElementById('word-grid');
const sentenceSpan = document.getElementById('sentence');
const playBtn = document.getElementById('play-btn');
const instructions = document.getElementById('instructions');
const hideInstructionsBtn = document.getElementById('hide-instructions');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Letters, Numbers + Special Keys (Each gets a box) ---
const lettersArray = [
  
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  "Space", "Delete"
];

let letters = [];
let activeIndex = 0;

// --- Populate grid ---
letterGrid.innerHTML = ''; // Clear any previous
lettersArray.forEach((l, i) => {
  const div = document.createElement('div');
  div.className = 'letter';
  div.textContent = l;
  div.tabIndex = 0;
  div.addEventListener('click', () => selectLetter(i));
  letterGrid.appendChild(div);
  letters.push(div);
});

setActiveLetter(0);

function setActiveLetter(index) {
  letters.forEach((l, i) => l.classList.toggle('active', i === index));
  activeIndex = index;

  // Scroll the active letter into view if necessary
  letters[index].scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}

// Eye/keyboard-based selection
function selectLetter(index) {
  const value = letters[index].textContent;
  if (value === "Space") {
    sentenceSpan.textContent += " ";
  } else if (value === "Delete") {
    sentenceSpan.textContent = sentenceSpan.textContent.slice(0, -1);
  } else {
    sentenceSpan.textContent += value;
  }
}

// --- Instructions panel drag & hide ---
hideInstructionsBtn.addEventListener('click', () => instructions.style.display = 'none');
instructions.onmousedown = function(e){
  let shiftX = e.clientX - instructions.getBoundingClientRect().left;
  let shiftY = e.clientY - instructions.getBoundingClientRect().top;
  function moveAt(pageX, pageY){ instructions.style.left = pageX - shiftX + 'px'; instructions.style.top = pageY - shiftY + 'px'; }
  function onMouseMove(e){ moveAt(e.pageX, e.pageY); }
  document.addEventListener('mousemove', onMouseMove);
  document.onmouseup = function(){ document.removeEventListener('mousemove', onMouseMove); document.onmouseup=null; }
};
instructions.ondragstart = () => false;

// --- Speech playback ---
function speakSentence() {
  const utter = new SpeechSynthesisUtterance(sentenceSpan.textContent.trim());
  utter.rate = 0.7;
  utter.pitch = 1;
  speechSynthesis.speak(utter);
}
playBtn.addEventListener('click', speakSentence);

function stopSpeaking() {
  speechSynthesis.cancel();
}

// --- Ensure play button is always enabled ---
function enablePlayBtn() {
  playBtn.disabled = false;
  playBtn.style.opacity = 1;
  playBtn.style.pointerEvents = 'auto';
}
window.addEventListener('DOMContentLoaded', enablePlayBtn);
setInterval(enablePlayBtn, 500);

// --- Eye Tracking with MediaPipe FaceMesh ---
const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });

let gazeDelay = 0;
const EAR_THRESHOLD = 0.25;
const BLINK_COOLDOWN = 400;
const LONG_BLINK_DURATION = 600;
const HOLD_DURATION = 1200;

let framesClosed = 0, lastBlinkTime = 0, blinkStartTime = 0;
let rightEyeHoldStart = 0, rightEyeHoldActive = false, rightEyeHoldDone = false;
let leftEyeHoldStart = 0, leftEyeHoldActive = false, leftEyeHoldDone = false;

faceMesh.onResults((results) => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!results.multiFaceLandmarks[0]) return;
  const lm = results.multiFaceLandmarks[0];
  const now = Date.now();

  // --- Eye Ratio Calculation (EAR) ---
  const earL = Math.hypot(lm[159].x-lm[145].x, lm[159].y-lm[145].y) / Math.hypot(lm[33].x-lm[133].x, lm[33].y-lm[133].y);
  const earR = Math.hypot(lm[386].x-lm[374].x, lm[386].y-lm[374].y) / Math.hypot(lm[362].x-lm[263].x, lm[362].y-lm[263].y);

  // --- Right eye hold: stop sound (long), blink: select letter (short) ---
  if (earL < EAR_THRESHOLD && earR >= EAR_THRESHOLD) {
    if (!rightEyeHoldActive) {
      rightEyeHoldStart = now;
      rightEyeHoldActive = true;
      rightEyeHoldDone = false;
    }
    if (!rightEyeHoldDone && now - rightEyeHoldStart > HOLD_DURATION) {
      stopSpeaking();
      lastBlinkTime = now;
      rightEyeHoldDone = true;
    }
  } else if (rightEyeHoldActive) {
    // If released before HOLD_DURATION, treat as a blink
    if (!rightEyeHoldDone && now - rightEyeHoldStart > BLINK_COOLDOWN) {
      selectLetter(activeIndex);
      lastBlinkTime = now;
    }
    rightEyeHoldActive = false;
    rightEyeHoldDone = false;
    rightEyeHoldStart = 0;
  }

  // --- Left eye hold: delete last (long), blink: play sentence (short) ---
  if (earR < EAR_THRESHOLD && earL >= EAR_THRESHOLD) {
    if (!leftEyeHoldActive) {
      leftEyeHoldStart = now;
      leftEyeHoldActive = true;
      leftEyeHoldDone = false;
    }
    if (!leftEyeHoldDone && now - leftEyeHoldStart > HOLD_DURATION) {
      // delete last character
      sentenceSpan.textContent = sentenceSpan.textContent.slice(0, -1);
      lastBlinkTime = now;
      leftEyeHoldDone = true;
    }
  } else if (leftEyeHoldActive) {
    // If released before HOLD_DURATION, treat as a blink
    if (!leftEyeHoldDone && now - leftEyeHoldStart > BLINK_COOLDOWN) {
      speakSentence();
      lastBlinkTime = now;
    }
    leftEyeHoldActive = false;
    leftEyeHoldDone = false;
    leftEyeHoldStart = 0;
  }

  // --- Both eyes closed (long blink) to clear sentence ---
  if (earL < EAR_THRESHOLD && earR < EAR_THRESHOLD) {
    framesClosed++;
    if (framesClosed === 1) blinkStartTime = now;
    if (now - blinkStartTime >= LONG_BLINK_DURATION && now - lastBlinkTime > BLINK_COOLDOWN) {
      sentenceSpan.textContent = "";
      lastBlinkTime = now;
      framesClosed = 0;
    }
  } else {
    framesClosed = 0;
    blinkStartTime = 0;
  }

  // --- Horizontal gaze movement: select previous/next letter ---
  const leftIris = lm[468], leftEyeInner = lm[133], leftEyeOuter = lm[33];
  const ratioX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);
  if(now - gazeDelay > 500){
    if(ratioX < 0.38) setActiveLetter((activeIndex-1 + letters.length) % letters.length);
    else if(ratioX > 0.60) setActiveLetter((activeIndex+1) % letters.length);
    gazeDelay = now;
  }
});

// --- Start camera ---
const camera = new Camera(video, {
  onFrame: async () => { await faceMesh.send({image:video}); },
  width:640, height:480
});
camera.start();
