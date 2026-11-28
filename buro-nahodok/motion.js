// Decorative motion receives no quest, answers, input values or saved progress.
const motionFeedbackActions = new Set(['inspect-clue', 'hint']);
const motionClamp = (motionValue, motionLow, motionHigh) => Math.min(motionHigh, Math.max(motionLow, motionValue));

/**
 * Construction creates no DOM, animation, frame or timer. Call sync(root) after
 * rendering and setActive(false) for pause/dialog/navigation. The host owns the
 * explicit user preference; the OS reduced-motion preference always wins.
 */
export function createQuestMotion(motionOptions = {}) {
  let motionRoot = null, motionScene = null, motionLayer = null;
  let motionDocument = motionOptions.document ?? motionOptions.root?.ownerDocument ?? globalThis.document ?? null;
  let motionWindow = motionOptions.window ?? motionDocument?.defaultView ?? globalThis.window ?? null;
  let motionEnabled = motionOptions.enabled !== false, motionActive = motionOptions.active !== false;
  let motionDestroyed = false, motionReduced = false, motionFine = false, motionFocused = true;
  let motionReduceQuery = null, motionFineQuery = null, motionBound = false;
  let motionFrame = null, motionPending = null, motionControlFrame = null, motionPendingControl = null, motionLastState = '';
  let motionPointerVersion = 0, motionControlVersion = 0;
  const motionAnimations = new Set(), motionRootListeners = [], motionLifeListeners = [];

  function motionQuery(motionParent, motionSelector) {
    try { return motionParent?.querySelector?.(motionSelector) || null; } catch { return null; }
  }
  function motionHasModal() {
    return Boolean(motionQuery(motionDocument, '.dialog-backdrop, [aria-modal="true"], dialog[open]'));
  }
  function motionAllowed() {
    return !motionDestroyed && Boolean(motionRoot) && motionEnabled && motionActive
      && !motionReduced && !motionDocument?.hidden && motionFocused && !motionHasModal();
  }
  function motionState() {
    return {enabled:motionEnabled, active:motionActive, reduced:motionReduced, allowed:motionAllowed(), destroyed:motionDestroyed};
  }
  function motionEmit() {
    const motionSnapshot = motionState(), motionSerialized = JSON.stringify(motionSnapshot);
    if (motionSerialized === motionLastState) return;
    motionLastState = motionSerialized;
    try { motionOptions.onChange?.(motionSnapshot); } catch { /* A UI callback cannot break game controls. */ }
  }
  function motionListen(motionTarget, motionType, motionHandler, motionList, motionSettings) {
    if (typeof motionTarget?.addEventListener !== 'function') return;
    motionTarget.addEventListener(motionType, motionHandler, motionSettings);
    motionList.push(() => motionTarget.removeEventListener?.(motionType, motionHandler, motionSettings));
  }
  function motionReadPreferences() {
    try { motionReduceQuery = motionWindow?.matchMedia?.('(prefers-reduced-motion: reduce)') || null; } catch { /* Optional browser API. */ }
    try { motionFineQuery = motionWindow?.matchMedia?.('(hover: hover) and (pointer: fine)') || null; } catch { /* Touch remains still. */ }
    motionReduced = Boolean(motionReduceQuery?.matches);
    motionFine = Boolean(motionFineQuery?.matches);
  }
  function motionSetDrift(motionTarget, motionX = 0, motionY = 0) {
    motionTarget?.style?.setProperty?.('--scene-drift-x', `${motionX}px`);
    motionTarget?.style?.setProperty?.('--scene-drift-y', `${motionY}px`);
  }
  function motionResetPointer() {
    motionPointerVersion += 1;
    if (motionFrame !== null) {
      const motionCancel = motionOptions.cancelAnimationFrame || motionWindow?.cancelAnimationFrame?.bind(motionWindow);
      try { motionCancel?.(motionFrame); } catch { /* A detached browser may no longer own its frame. */ }
    }
    motionFrame = null;
    motionPending = null;
    motionSetDrift(motionScene);
  }
  function motionRemoveLayer() {
    if (motionLayer && !motionLayer.children?.length) {
      motionLayer.remove?.();
      motionLayer = null;
    }
  }
  function motionCancelAnimations(motionCelebrationOnly = false) {
    if (!motionCelebrationOnly) {
      motionControlVersion += 1;
      const motionCancel = motionOptions.cancelAnimationFrame || motionWindow?.cancelAnimationFrame?.bind(motionWindow);
      if (motionControlFrame !== null) {
        try { motionCancel?.(motionControlFrame); } catch { /* The old frame will also check its permission. */ }
      }
      motionControlFrame = null;
      motionPendingControl = null;
    }
    for (const motionRecord of [...motionAnimations]) {
      if (motionCelebrationOnly && motionRecord.kind === 'control') continue;
      try { motionRecord.animation.cancel?.(); } catch { /* Cleanup still runs when cancellation is unsupported. */ }
      motionRecord.finish();
    }
    motionRemoveLayer();
  }
  function motionUpdate() {
    const motionIsAllowed = motionAllowed();
    const motionPreferenceEnabled = !motionDestroyed && motionEnabled && !motionReduced;
    motionRoot?.setAttribute?.('data-motion', motionPreferenceEnabled ? 'on' : 'off');
    motionRoot?.classList?.toggle?.('motion-suspended', !motionIsAllowed);
    if (!motionIsAllowed) {
      motionResetPointer();
      motionCancelAnimations();
    }
    motionEmit();
    return motionIsAllowed;
  }
  function motionPreferenceChanged() {
    motionReduced = Boolean(motionReduceQuery?.matches);
    motionFine = Boolean(motionFineQuery?.matches);
    if (!motionFine) motionResetPointer();
    motionUpdate();
  }
  function motionBindLife() {
    if (motionBound || (!motionDocument && !motionWindow)) return;
    motionBound = true;
    for (const motionQueryList of [motionReduceQuery, motionFineQuery]) {
      if (typeof motionQueryList?.addEventListener === 'function') {
        motionListen(motionQueryList, 'change', motionPreferenceChanged, motionLifeListeners);
      } else if (typeof motionQueryList?.addListener === 'function') {
        motionQueryList.addListener(motionPreferenceChanged);
        motionLifeListeners.push(() => motionQueryList.removeListener?.(motionPreferenceChanged));
      }
    }
    motionListen(motionDocument, 'visibilitychange', motionUpdate, motionLifeListeners);
    motionListen(motionWindow, 'blur', () => { motionFocused = false; motionUpdate(); }, motionLifeListeners);
    motionListen(motionWindow, 'focus', () => { motionFocused = true; motionUpdate(); }, motionLifeListeners);
    motionListen(motionWindow, 'pagehide', () => { motionFocused = false; motionUpdate(); }, motionLifeListeners);
    motionListen(motionWindow, 'pageshow', () => { motionFocused = true; motionUpdate(); }, motionLifeListeners);
    motionListen(motionWindow, 'resize', motionResetPointer, motionLifeListeners, {passive:true});
  }
  function motionRect(motionNode) {
    try {
      const motionBox = motionNode?.getBoundingClientRect?.();
      if (!motionBox || ![motionBox.left, motionBox.top, motionBox.width, motionBox.height].every(Number.isFinite)
        || motionBox.width <= 0 || motionBox.height <= 0) return null;
      return motionBox;
    } catch { return null; }
  }
  function motionPointer(motionEvent) {
    if (!motionAllowed() || !motionFine || (motionEvent.pointerType && motionEvent.pointerType !== 'mouse')) {
      motionResetPointer();
      return;
    }
    const motionBox = motionRect(motionScene);
    if (!motionBox || !Number.isFinite(motionEvent.clientX) || !Number.isFinite(motionEvent.clientY)) return;
    motionPending = {
      x:motionClamp((motionEvent.clientX - motionBox.left - motionBox.width / 2) / (motionBox.width / 2), -1, 1) * 6,
      y:motionClamp((motionEvent.clientY - motionBox.top - motionBox.height / 2) / (motionBox.height / 2), -1, 1) * 6,
    };
    const motionRequest = motionOptions.requestAnimationFrame || motionWindow?.requestAnimationFrame?.bind(motionWindow);
    if (motionFrame !== null || !motionRequest) return;
    const motionRequestVersion = motionPointerVersion;
    try {
      motionFrame = motionRequest(() => {
        if (motionRequestVersion !== motionPointerVersion) return;
        motionFrame = null;
        if (!motionAllowed() || !motionPending) return;
        motionSetDrift(motionScene, Number(motionPending.x.toFixed(2)), Number(motionPending.y.toFixed(2)));
        motionPending = null;
      });
    } catch { motionResetPointer(); }
  }
  function motionAnimate(motionNode, motionFrames, motionTiming, motionKind, motionRemove = false) {
    if (typeof motionNode?.animate !== 'function') {
      if (motionRemove) motionNode?.remove?.();
      return false;
    }
    let motionAnimation;
    try { motionAnimation = motionNode.animate(motionFrames, motionTiming); } catch {
      if (motionRemove) motionNode.remove?.();
      return false;
    }
    if (!motionAnimation) {
      if (motionRemove) motionNode.remove?.();
      return false;
    }
    let motionFinished = false;
    const motionRecord = {animation:motionAnimation, kind:motionKind, node:motionNode, finish:() => {
      if (motionFinished) return;
      motionFinished = true;
      motionAnimations.delete(motionRecord);
      motionAnimation.onfinish = null;
      motionAnimation.oncancel = null;
      if (motionRemove) motionNode.remove?.();
      motionRemoveLayer();
    }};
    motionAnimations.add(motionRecord);
    motionAnimation.onfinish = motionRecord.finish;
    motionAnimation.oncancel = motionRecord.finish;
    return true;
  }
  function motionFeedback() {
    motionControlFrame = null;
    const motionPendingTap = motionPendingControl;
    motionPendingControl = null;
    if (!motionAllowed() || !motionPendingTap) return;
    let motionControl = motionPendingTap.node;
    if (!motionRoot?.contains?.(motionControl)) {
      // Task rendering may replace a keypad button during its native click.
      // Match public control identity without reading any answer or input value.
      try {
        motionControl = [...(motionRoot?.querySelectorAll?.('[data-action]') || [])].find(motionCandidate =>
          motionCandidate.getAttribute?.('data-action') === motionPendingTap.action
          && (motionPendingTap.focus
            ? motionCandidate.getAttribute?.('data-focus') === motionPendingTap.focus
            : motionCandidate.getAttribute?.('data-value') === motionPendingTap.value));
      } catch { return; }
    }
    if (!motionControl || motionControl.disabled || motionControl.getAttribute?.('aria-disabled') === 'true') return;
    // Repeated taps replace the previous effect; no focus, class or value changes.
    for (const motionRecord of [...motionAnimations]) {
      if (motionRecord.kind === 'control' && motionRecord.node === motionControl) {
        try { motionRecord.animation.cancel?.(); } catch { /* Continue with the new tap. */ }
        motionRecord.finish();
      }
    }
    motionAnimate(motionControl, [
      {transform:'translateY(0) scale(1)'},
      {transform:'translateY(-3px) scale(1.025)', offset:.38},
      {transform:'translateY(0) scale(1)'},
    ], {duration:240, easing:'cubic-bezier(.2,.7,.3,1)', iterations:1}, 'control');
  }
  function motionClick(motionEvent) {
    if (!motionAllowed()) return;
    let motionControl;
    try { motionControl = motionEvent.target?.closest?.('[data-action]'); } catch { return; }
    if (!motionControl || !motionRoot?.contains?.(motionControl) || motionControl.disabled
      || motionControl.getAttribute?.('aria-disabled') === 'true') return;
    const motionAction = motionControl.getAttribute?.('data-action') || '';
    if (!motionFeedbackActions.has(motionAction) && !motionAction.startsWith('task-')) return;
    motionPendingControl = {node:motionControl, action:motionAction,
      focus:motionControl.getAttribute?.('data-focus'), value:motionControl.getAttribute?.('data-value')};
    const motionRequest = motionOptions.requestAnimationFrame || motionWindow?.requestAnimationFrame?.bind(motionWindow);
    if (!motionRequest) { motionFeedback(); return; }
    if (motionControlFrame !== null) return;
    const motionRequestVersion = motionControlVersion;
    try {
      motionControlFrame = motionRequest(() => {
        if (motionRequestVersion === motionControlVersion) motionFeedback();
      });
    } catch { motionPendingControl = null; }
  }
  function motionGetLayer() {
    if (motionLayer) return motionLayer;
    if (!motionDocument?.createElement || !motionDocument.body?.append) return null;
    motionLayer = motionDocument.createElement('div');
    motionLayer.className = 'motion-overlay';
    motionLayer.setAttribute('aria-hidden', 'true');
    motionLayer.setAttribute('inert', '');
    Object.assign(motionLayer.style, {position:'fixed', inset:'0', overflow:'hidden', pointerEvents:'none', zIndex:'90'});
    motionDocument.body.append(motionLayer);
    return motionLayer;
  }
  function motionCelebrate(motionCelebration = {}) {
    if (!motionAllowed()) { motionUpdate(); return false; }
    const motionDesk = motionRect(motionQuery(motionRoot, '.adventure-desk'));
    if (!motionDesk || !motionDocument?.createElement) return false;
    const motionProbe = motionDocument.createElement('span');
    if (typeof motionProbe.animate !== 'function') return false;
    // A rapid second success replaces the old burst, keeping at most 18 pieces
    // and one letter in the document, with no deferred replay after a pause.
    motionCancelAnimations(true);
    const motionOverlay = motionGetLayer();
    if (!motionOverlay) return false;
    const motionOrigin = {x:motionDesk.left + motionDesk.width / 2, y:motionDesk.top + Math.min(160, motionDesk.height * .35)};
    const motionCount = motionCelebration.final ? 18 : motionCelebration.stationComplete ? 14 : 9;
    let motionStarted = false;
    for (let motionIndex = 0; motionIndex < motionCount; motionIndex += 1) {
      const motionPiece = motionIndex ? motionDocument.createElement('span') : motionProbe;
      const motionStar = motionIndex % 3 !== 1;
      motionPiece.className = `motion-particle ${motionStar ? 'motion-star' : 'motion-paper'}`;
      motionPiece.textContent = motionStar ? '✦' : '';
      const motionAngle = Math.PI * 2 * motionIndex / motionCount;
      const motionDistance = 70 + (motionIndex % 4) * 24;
      const motionX = Math.cos(motionAngle) * motionDistance;
      const motionY = Math.sin(motionAngle) * motionDistance * .65 + 35;
      const motionSpin = (motionIndex % 2 ? -1 : 1) * (90 + motionIndex * 29);
      Object.assign(motionPiece.style, {position:'absolute', left:`${motionOrigin.x}px`, top:`${motionOrigin.y}px`,
        width:motionStar ? '14px' : '7px', height:motionStar ? '14px' : '11px', color:motionIndex % 2 ? '#d5a345' : '#f0cb78',
        background:motionStar ? 'transparent' : '#e6bd67', fontSize:'18px', lineHeight:'1', pointerEvents:'none'});
      motionOverlay.append(motionPiece);
      motionStarted = motionAnimate(motionPiece, [
        {transform:'translate3d(0,0,0) rotate(0deg) scale(.4)', opacity:0},
        {transform:`translate3d(${motionX * .28}px,${motionY * .15 - 25}px,0) rotate(${motionSpin * .2}deg) scale(1)`, opacity:1, offset:.2},
        {transform:`translate3d(${motionX}px,${motionY}px,0) rotate(${motionSpin}deg) scale(.75)`, opacity:0},
      ], {duration:motionCelebration.final ? 1050 : 820, delay:motionIndex % 4 * 24,
        easing:'cubic-bezier(.12,.6,.36,1)', iterations:1}, 'particle', true) || motionStarted;
    }
    const motionPassport = motionRect(motionQuery(motionRoot, '.passport-summary, .holiday-passport, .passport-sheet'));
    if (motionPassport) {
      const motionLetter = motionDocument.createElement('span');
      motionLetter.className = 'motion-letter';
      motionLetter.textContent = '✉';
      Object.assign(motionLetter.style, {position:'absolute', left:`${motionOrigin.x}px`, top:`${motionOrigin.y}px`,
        color:'#fff5d7', textShadow:'0 2px 8px #70452566', fontFamily:'Georgia, serif', fontSize:'42px', lineHeight:'1', pointerEvents:'none'});
      motionOverlay.append(motionLetter);
      const motionDX = motionPassport.left + motionPassport.width / 2 - motionOrigin.x;
      const motionDY = motionPassport.top + motionPassport.height / 2 - motionOrigin.y;
      motionStarted = motionAnimate(motionLetter, [
        {transform:'translate3d(0,0,0) rotate(-12deg) scale(.65)', opacity:0},
        {transform:`translate3d(${motionDX * .36}px,${Math.min(-65, motionDY * .5 - 70)}px,0) rotate(8deg) scale(1)`, opacity:1, offset:.38},
        {transform:`translate3d(${motionDX}px,${motionDY}px,0) rotate(-5deg) scale(.35)`, opacity:0},
      ], {duration:1050, easing:'cubic-bezier(.25,.65,.35,1)', iterations:1}, 'letter', true) || motionStarted;
    }
    motionRemoveLayer();
    return motionStarted;
  }
  motionReadPreferences();
  return {
    state:motionState,
    sync(motionNextRoot = motionRoot || motionOptions.root) {
      if (motionDestroyed) return false;
      if (!motionDocument && motionNextRoot?.ownerDocument) {
        motionDocument = motionNextRoot.ownerDocument;
        motionWindow ||= motionDocument.defaultView;
        motionReadPreferences();
      }
      if (motionRoot !== motionNextRoot) {
        motionResetPointer();
        motionCancelAnimations();
        motionRoot?.setAttribute?.('data-motion', 'off');
        motionRoot?.classList?.toggle?.('motion-suspended', true);
        motionRootListeners.splice(0).forEach(motionUnlisten => motionUnlisten());
        motionRoot = motionNextRoot || null;
        motionListen(motionRoot, 'pointermove', motionPointer, motionRootListeners, {passive:true});
        motionListen(motionRoot, 'pointerleave', motionResetPointer, motionRootListeners, {passive:true});
        motionListen(motionRoot, 'click', motionClick, motionRootListeners);
      }
      const motionNextScene = motionQuery(motionRoot, '.quest-scene');
      if (motionScene !== motionNextScene) {
        motionResetPointer();
        motionCancelAnimations();
        motionScene = motionNextScene;
        motionSetDrift(motionScene);
      }
      motionBindLife();
      return motionUpdate();
    },
    setActive(motionValue) {
      if (motionDestroyed) return false;
      motionActive = Boolean(motionValue);
      return motionUpdate();
    },
    setEnabled(motionValue) {
      if (motionDestroyed) return false;
      motionEnabled = Boolean(motionValue);
      return motionUpdate();
    },
    celebrate:motionCelebrate,
    destroy() {
      if (motionDestroyed) return;
      motionDestroyed = true;
      motionUpdate();
      motionRootListeners.splice(0).forEach(motionUnlisten => motionUnlisten());
      motionLifeListeners.splice(0).forEach(motionUnlisten => motionUnlisten());
      motionRoot = null;
      motionScene = null;
    },
  };
}
