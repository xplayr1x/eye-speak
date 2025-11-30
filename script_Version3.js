// --- Eye-Typing Keyboard: Both-Eyes Blink = Space Only ---

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
  "YES", "NO",   // Big-Button selections
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

setActiveLetter(0);

function setActiveLetter(index) {
  letters.forEach((l, i) => l.classList.toggle('active', i === index));
  activeIndex = index;
  letters[index].scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}

function selectLetter(index) {
  const value = letters[index].textContent;
  if (value === "Space") {
    // Only add a space if last character is NOT a space and not empty
    if (sentenceSpan.textContent.slice(-1) !== " " && sentenceSpan.textContent !== "") {
      sentenceSpan.textContent += " ";
    }
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

  // --- Both eyes blink (any duration) to add space ---
  if (earL < EAR_THRESHOLD && earR < EAR_THRESHOLD) {
    framesClosed++;
    if (framesClosed === 1) blinkStartTime = now;
  } else {
    if (framesClosed > 1 && now - lastBlinkTime > BLINK_COOLDOWN) {
      const prevIndex = activeIndex;
      const spaceIndex = lettersArray.findIndex(x => x === "Space");
      if (spaceIndex > -1) {
        setActiveLetter(spaceIndex);
        selectLetter(spaceIndex);
        setTimeout(() => setActiveLetter(prevIndex), 350);
      }
      lastBlinkTime = now;
    }
    framesClosed = 0;
    blinkStartTime = 0;
  }

  // --- Horizontal gaze movement: select previous/next letter ---
  const leftIris = lm[468], leftEyeInner = lm[133], leftEyeOuter = lm[33];
  const ratioX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);
  if(now - gazeDelay > 1000){ // less sensitive (1 sec interval)
    if(ratioX < 0.42) setActiveLetter((activeIndex-1 + letters.length) % letters.length);
    else if(ratioX > 0.58) setActiveLetter((activeIndex+1) % letters.length);
    gazeDelay = now;
  }
});

// --- Start camera ---
const camera = new Camera(video, {
  onFrame: async () => { await faceMesh.send({image:video}); },
  width:640, height:480
});
camera.start();
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');

// Visual sync: highlight YES/NO button when active
function setActiveLetter(index) {
  letters.forEach((l, i) => l.classList.toggle('active', i === index));
  yesBtn.classList.toggle('selected', index === 0);
  noBtn.classList.toggle('selected', index === 1);
  activeIndex = index;
  // Only scroll grid if not yes/no buttons
  if (index > 1) letters[index].scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
}
