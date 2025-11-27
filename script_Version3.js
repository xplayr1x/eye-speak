/**
 * Eye Speak - Version 3
 * 
 * This script provides eye-tracking based navigation and selection
 * for both a word grid and a letters/numbers grid.
 * Users can switch between screens using toggle buttons.
 */

const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

const wordGrid = document.getElementById('word-grid');
const lettersGrid = document.getElementById('letters-grid');
const sentenceSpan = document.getElementById('sentence');
const playBtn = document.getElementById('play-btn');
const instructions = document.getElementById('instructions');
const hideInstructionsBtn = document.getElementById('hide-instructions');

// Toggle buttons for switching between grids
const lettersBtnEl = document.getElementById('letters-btn');
const wordsBtnEl = document.getElementById('words-btn');

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

// --- Letters/Numbers array (A-Z, 0-9, and space for separating words) ---
const lettersArray = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "0","1","2","3","4","5","6","7","8","9",
  " " // Space character for separating words in the sentence
];

// Arrays to hold DOM elements for words and letters
let words = [];
let letters = [];

// Active indices for both grids
let activeWordIndex = 0;
let activeLetterIndex = 0;

// Track which screen is currently active: 'words' or 'letters'
let currentScreen = 'words';

// --- Populate word grid ---
wordsArray.forEach((w, i) => {
  const div = document.createElement('div');
  div.className = 'word';
  div.textContent = w;
  div.addEventListener('click', () => selectWord(i));
  wordGrid.appendChild(div);
  words.push(div);
});

// Set initial active word
words[activeWordIndex].classList.add('active');

// --- Populate letters/numbers grid ---
lettersArray.forEach((char, i) => {
  const div = document.createElement('div');
  div.className = 'letter';
  // Display "Space" for the space character for clarity
  div.textContent = char === ' ' ? 'Space' : char;
  div.addEventListener('click', () => selectLetter(i));
  lettersGrid.appendChild(div);
  letters.push(div);
});

// Set initial active letter
letters[activeLetterIndex].classList.add('active');

/**
 * Update the active word highlighting and scroll into view
 * @param {number} index - The index of the word to set as active
 */
function updateActiveWord(index) {
  words.forEach((w, i) => w.classList.toggle('active', i === index));
  activeWordIndex = index;

  // Automatically scroll the active word into view
  const activeWord = words[index];
  activeWord.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

/**
 * Update the active letter highlighting and scroll into view
 * @param {number} index - The index of the letter to set as active
 */
function updateActiveLetter(index) {
  letters.forEach((l, i) => l.classList.toggle('active', i === index));
  activeLetterIndex = index;

  // Automatically scroll the active letter into view
  const activeLetter = letters[index];
  activeLetter.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

/**
 * Select a word and append it to the sentence
 * @param {number} index - The index of the word to select
 */
function selectWord(index) {
  sentenceSpan.textContent += words[index].textContent + " ";
}

/**
 * Select a letter/number and append it to the sentence
 * @param {number} index - The index of the letter to select
 */
function selectLetter(index) {
  const char = lettersArray[index];
  sentenceSpan.textContent += char;
}

/**
 * Switch to the letters/numbers grid view
 */
function showLettersScreen() {
  currentScreen = 'letters';
  wordGrid.style.display = 'none';
  lettersGrid.style.display = 'grid';
  lettersBtnEl.style.display = 'none';
  wordsBtnEl.style.display = 'inline-block';
}

/**
 * Switch to the words grid view
 */
function showWordsScreen() {
  currentScreen = 'words';
  lettersGrid.style.display = 'none';
  wordGrid.style.display = 'grid';
  wordsBtnEl.style.display = 'none';
  lettersBtnEl.style.display = 'inline-block';
}

// Event listeners for toggle buttons
lettersBtnEl.addEventListener('click', showLettersScreen);
wordsBtnEl.addEventListener('click', showWordsScreen);

// --- Instructions panel drag & hide ---
hideInstructionsBtn.addEventListener('click', () => instructions.style.display = 'none');
instructions.onmousedown = function(e){
  let shiftX = e.clientX - instructions.getBoundingClientRect().left;
  let shiftY = e.clientY - instructions.getBoundingClientRect().top;
  function moveAt(pageX, pageY){ 
    instructions.style.left = pageX - shiftX + 'px'; 
    instructions.style.top = pageY - shiftY + 'px'; 
  }
  function onMouseMove(e){ moveAt(e.pageX, e.pageY); }
  document.addEventListener('mousemove', onMouseMove);
  document.onmouseup = function(){ 
    document.removeEventListener('mousemove', onMouseMove); 
    document.onmouseup = null; 
  }
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
// Always keep play button enabled -- on load and every 500ms
window.addEventListener('DOMContentLoaded', enablePlayBtn);
setInterval(enablePlayBtn, 500);

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

/**
 * Get the current active items array based on which screen is active
 * @returns {Array} - The array of DOM elements for the current grid
 */
function getCurrentItems() {
  return currentScreen === 'words' ? words : letters;
}

/**
 * Get the current active index based on which screen is active
 * @returns {number} - The current active index
 */
function getCurrentActiveIndex() {
  return currentScreen === 'words' ? activeWordIndex : activeLetterIndex;
}

/**
 * Update the active item (word or letter) based on current screen
 * @param {number} index - The index to set as active
 */
function updateCurrentActive(index) {
  if (currentScreen === 'words') {
    updateActiveWord(index);
  } else {
    updateActiveLetter(index);
  }
}

/**
 * Select the current active item (word or letter) based on current screen
 * @param {number} index - The index to select
 */
function selectCurrentItem(index) {
  if (currentScreen === 'words') {
    selectWord(index);
  } else {
    selectLetter(index);
  }
}

faceMesh.onResults((results) => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!results.multiFaceLandmarks[0]) return;
  const lm = results.multiFaceLandmarks[0];
  const now = Date.now();

  // Get current items and index for navigation
  const items = getCurrentItems();
  const activeIndex = getCurrentActiveIndex();

  // --- Eye Ratio Calculation ---
  // Note: Camera image is mirrored, so earL (calculated from landmarks 159,145,33,133) 
  // corresponds to the user's RIGHT eye, and earR (landmarks 386,374,362,263) corresponds
  // to the user's LEFT eye. This affects all eye-specific controls below.
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
    // If released before HOLD_DURATION, treat as a blink (select current item)
    if (!rightEyeHoldDone && now - rightEyeHoldStart > BLINK_COOLDOWN) {
      selectCurrentItem(activeIndex);
      lastBlinkTime = now;
    }
    rightEyeHoldActive = false;
    rightEyeHoldDone = false;
    rightEyeHoldStart = 0;
  }

  // --- Hold user's left eye closed to delete last word/letter ---
  if (earR < EAR_THRESHOLD && earL >= EAR_THRESHOLD) {
    if (!leftEyeHoldActive) {
      leftEyeHoldStart = now;
      leftEyeHoldActive = true;
      leftEyeHoldDone = false;
    }
    if (!leftEyeHoldDone && now - leftEyeHoldStart > HOLD_DURATION) {
      // Delete last word (if on words screen) or last character (if on letters screen)
      if (currentScreen === 'words') {
        const arr = sentenceSpan.textContent.trim().split(" ");
        arr.pop();
        sentenceSpan.textContent = arr.join(" ") + (arr.length ? " " : "");
      } else {
        // Delete last character for letters screen
        sentenceSpan.textContent = sentenceSpan.textContent.slice(0, -1);
      }
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

  // --- Horizontal gaze movement (works for both grids) ---
  const leftIris = lm[468], leftEyeInner = lm[133], leftEyeOuter = lm[33];
  const ratioX = (leftIris.x - leftEyeInner.x) / (leftEyeOuter.x - leftEyeInner.x);
  if(now - gazeDelay > 500){
    if(ratioX < 0.45) {
      // Move left in the current grid
      updateCurrentActive((activeIndex - 1 + items.length) % items.length);
    }
    else if(ratioX > 0.60) {
      // Move right in the current grid
      updateCurrentActive((activeIndex + 1) % items.length);
    }
    gazeDelay = now;
  }
});

// --- Start camera ---
const camera = new Camera(video, {
  onFrame: async () => { await faceMesh.send({image:video}); },
  width:640, height:480
});
camera.start();