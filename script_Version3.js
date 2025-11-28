// --- Both eyes closed (long blink) to add space and highlight box ---
if (earL < EAR_THRESHOLD && earR < EAR_THRESHOLD) {
  framesClosed++;
  if (framesClosed === 1) blinkStartTime = now;
  if (now - blinkStartTime >= LONG_BLINK_DURATION && now - lastBlinkTime > BLINK_COOLDOWN) {
    const prevIndex = activeIndex;
    const spaceIndex = lettersArray.findIndex(x => x === "Space");
    if (spaceIndex > -1) {
      setActiveLetter(spaceIndex); // highlight
      selectLetter(spaceIndex);    // add space
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
