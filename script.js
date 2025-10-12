const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

const wordGrid = document.getElementById('word-grid');
const sentenceSpan = document.getElementById('sentence');
const playBtn = document.getElementById('play-btn');
const instructions = document.getElementById('instructions');
const hideInstructionsBtn = document.getElementById('hide-instructions');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Word list ---
const wordsArray = [
  "yes","no","I","You","We","They","am","able","have","He","She",
  "want","need","like","love","hate","see","because","this","is",
  "go","come","stop","mum","eat","drink","trying","tried","what",
  "now","later","today","tomorrow","fucking",
  "happy","sad","more","am","angry","tired","good","bad",
  "really","very","so","too","much","a lot",
  "hello","bye","please","thanks","help","sorry",
  "home","fuck","to","food","water","music",
  "still","look","wait","okay","great","me"
];

let words = [];
let activeIndex = 0;

// --- Populate word grid ---
wordsArray.forEach((w, i) => {
  const div = document.createElement('div');
  div.className = 'word';
  div.textContent = w;
  div.addEventListener('click', () => selectWord(i));
  wordGrid.appendChild(div);
  words.push(div);
});

words[activeIndex].classList.add('active');

function updateActiveWord(index) {
  words.forEach((w, i) => w.classList.toggle('active', i === index));
  activeIndex = index;

  // Automatically scroll the active word into view
  const activeWord = words[index];
  activeWord.scrollIntoView({
    behavior: 'smooth',
    block: 'center'  // keeps it centered vertically
  });
}

function selectWord(index) {
  sentenceSpan.textContent += words[index].textContent + " ";
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

// --- Ensure play button is enabled on screen refresh ---
window.addEventListener('DOMContentLoaded', () => {
  playBtn.disabled = false;
  playBtn.style.opacity = 1;
  playBtn.style.pointerEvents = 'auto';
});

// --- Eye tracking setup ---
const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });

let gazeDelay = 0;
const EAR_THRESHOLD = 0.25;
const BLINK_COOLDOWN = 400;
const LONG_BLINK_DURATION = 600;
const HOLD_DURATION = 1200; // ms to hold eye closed for hold action

let framesClosed = 0, lastBlinkTime = 0, blinkStartTime = 0;
let rightEyeHoldStart = 0, rightEyeHoldActive = false, rightEyeHoldDone = false;
let leftEyeHoldStart = 0, leftEyeHoldActive = false, leftEyeHoldDone = false;

faceMesh.onResults((results) => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!results.multiFaceLandmarks[0]) return;
  const lm = results.multiFaceLandmarks[0];
  const now = Date.now();

  // --- Eye Ratio Calculation ---
  // earL: user's right eye, earR: user's left eye (mirrored from camera)
  const earL = Math.hypot(lm[159].x-lm[145].x, lm[159].y-lm[145].y) / Math.hypot(lm[33].x-lm[133].x, lm[33].y-lm[133].y);
  const earR = Math.hypot(lm[386].x-lm[374].x, lm[386].y-lm[374].y) / Math.hypot(lm[362].x-lm[263].x, lm[362].y-lm[263].y);

  // --- Hold user's right eye closed to stop sound ---
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
    // If released before HOLD_DURATION, treat as a blink (select word)
    if (!rightEyeHoldDone && now - rightEyeHoldStart > BLINK_COOLDOWN) {
      selectWord(activeIndex);
      lastBlinkTime = now;
    }
    rightEyeHoldActive = false;
    rightEyeHoldDone = false;
    rightEyeHoldStart = 0;
  }

  // --- Hold user's left eye closed to delete last word ---
  if (earR < EAR_THRESHOLD && earL >= EAR_THRESHOLD) {
    if (!leftEyeHoldActive) {
      leftEyeHoldStart = now;
      leftEyeHoldActive = true;
      leftEyeHoldDone = false;
    }
    if (!leftEyeHoldDone && now - leftEyeHoldStart > HOLD_DURATION) {
      // delete last word
      const arr = sentenceSpan.textContent.trim().split(" ");
      arr.pop();
      sentenceSpan.textContent = arr.join(" ") + (arr.length ? " " : "");
      lastBlinkTime = now;
      leftEyeHoldDone = true;
    }
  } else if (leftEyeHoldActive) {
    // If released before HOLD_DURATION, treat as a blink (play sentence)
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

  // --- Horizontal gaze movement ---
  // Uses left eye (code), which is user's right eye (mirrored)
  const leftIris = lm[468], leftEyeInner = lm[133], leftEyeOuter = lm[33];
  const ratioX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);
  if(now - gazeDelay > 500){
    if(ratioX < 0.45) updateActiveWord((activeIndex-1 + words.length) % words.length);
    else if(ratioX > 0.60) updateActiveWord((activeIndex+1) % words.length);
    gazeDelay = now;
  }

  // --- Look Up Gesture (optional): select word
  // If you want to keep this, it uses left eye (code), i.e. user's right eye
  /*
  const leftEyeTop = lm[159], leftEyeBottom = lm[145];
  const eyeHeight = leftEyeBottom.y - leftEyeTop.y;
  const leftIrisY = lm[468].y;
  const irisToTop = leftIrisY - leftEyeTop.y;
  if(irisToTop / eyeHeight < 0.2 && now - lookUpDelay > 1000){
    selectWord(activeIndex);
    lookUpDelay = now;
  }
  */
});

// --- Start camera ---
const camera = new Camera(video, {
  onFrame: async () => { await faceMesh.send({image:video}); },
  width:640, height:480
});
camera.start();
