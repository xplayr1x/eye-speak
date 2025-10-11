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
  "I","You","We","They","He","She",
  "want","need","like","love","hate","see",
  "go","come","stop","mum","eat","drink",
  "now","later","today","tomorrow","yes","no",
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

// --- Eye tracking setup ---
const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });

let gazeDelay = 0;
const EAR_THRESHOLD = 0.25;
const MIN_FRAMES_CLOSED = 2;
const BLINK_COOLDOWN = 400;
const LONG_BLINK_DURATION = 600;
let framesClosed = 0, lastBlinkTime = 0, blinkStartTime = 0;

faceMesh.onResults((results) => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!results.multiFaceLandmarks[0]) return;
  const lm = results.multiFaceLandmarks[0];
  const now = Date.now();

  // --- Horizontal gaze movement ---
  const leftIris = lm[468], leftEyeInner = lm[133], leftEyeOuter = lm[33];
  const ratioX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);
  if(now - gazeDelay > 500){
    if(ratioX < 0.45) updateActiveWord((activeIndex-1 + words.length) % words.length);
    else if(ratioX > 0.65) updateActiveWord((activeIndex+1) % words.length);
    gazeDelay = now;
  }

  // --- Blink detection ---
  const topL = lm[159], bottomL = lm[145], topR = lm[386], bottomR = lm[374];
  const leftCornerL = lm[33], rightCornerL = lm[133], leftCornerR = lm[362], rightCornerR = lm[263];
  const earL = Math.hypot(topL.x-bottomL.x, topL.y-bottomL.y) / Math.hypot(leftCornerL.x-rightCornerL.x,leftCornerL.y-rightCornerL.y);
  const earR = Math.hypot(topR.x-bottomR.x, topR.y-bottomR.y) / Math.hypot(leftCornerR.x-rightCornerR.x,leftCornerR.y-rightCornerR.y);
  const ear = (earL + earR)/2;

  if(ear < EAR_THRESHOLD){
    framesClosed++;
    if(framesClosed === 1) blinkStartTime = now;
    if(now - blinkStartTime >= LONG_BLINK_DURATION && now - lastBlinkTime > BLINK_COOLDOWN){
      sentenceSpan.textContent = "";
      lastBlinkTime = now;
      framesClosed = 0;
    }
  } else {
    // Right eye only → delete last word
    if(earR < EAR_THRESHOLD && earL >= EAR_THRESHOLD && now - lastBlinkTime > BLINK_COOLDOWN){
      const arr = sentenceSpan.textContent.trim().split(" ");
      arr.pop();
      sentenceSpan.textContent = arr.join(" ") + (arr.length ? " " : "");
      lastBlinkTime = now;
    }
    // Left eye only → play sentence
    else if(earL < EAR_THRESHOLD && earR >= EAR_THRESHOLD && now - lastBlinkTime > BLINK_COOLDOWN){
      speakSentence();
      lastBlinkTime = now;
    }
    // Short blink → select word
    else if(framesClosed >= MIN_FRAMES_CLOSED && now - lastBlinkTime > BLINK_COOLDOWN && now - blinkStartTime < LONG_BLINK_DURATION){
      selectWord(activeIndex);
      lastBlinkTime = now;
    }
    framesClosed = 0;
    blinkStartTime = 0;
  }
});

// --- Start camera ---
const camera = new Camera(video, {
  onFrame: async () => { await faceMesh.send({image:video}); },
  width:640, height:480
});
camera.start();
