import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MascotEmotion } from '../types/chat';

interface EmojiMascot3DProps {
  emotion: MascotEmotion;
  talkingLevel?: number; // 0 to 1 for voice lip sync
  speechText?: string;
  onTap?: () => void;
}

export const EmojiMascot3D: React.FC<EmojiMascot3DProps> = ({
  emotion,
  talkingLevel = 0,
  speechText,
  onTap,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const characterGroupRef = useRef<THREE.Group | null>(null);
  const headMeshRef = useRef<THREE.Mesh | null>(null);
  const leftEyeRef = useRef<THREE.Group | null>(null);
  const rightEyeRef = useRef<THREE.Group | null>(null);
  const leftPupilRef = useRef<THREE.Mesh | null>(null);
  const rightPupilRef = useRef<THREE.Mesh | null>(null);
  const heartEyesRef = useRef<THREE.Group | null>(null);
  const mouthRef = useRef<THREE.Mesh | null>(null);
  const leftHandRef = useRef<THREE.Mesh | null>(null);
  const rightHandRef = useRef<THREE.Mesh | null>(null);
  const sunglassesRef = useRef<THREE.Group | null>(null);
  const blushLeftRef = useRef<THREE.Mesh | null>(null);
  const blushRightRef = useRef<THREE.Mesh | null>(null);

  const pointerPos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const animAction = useRef<{
    type: 'none' | 'jump' | 'spin' | 'wobble' | 'love_pulse';
    progress: number;
  }>({ type: 'none', progress: 0 });

  const [bubbleText, setBubbleText] = useState<string | null>(speechText || null);

  useEffect(() => {
    if (speechText) {
      setBubbleText(speechText);
      const timer = setTimeout(() => setBubbleText(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [speechText]);

  // Trigger animations based on emotion
  useEffect(() => {
    if (emotion === 'love') {
      animAction.current = { type: 'love_pulse', progress: 0 };
    } else if (emotion === 'party' || emotion === 'cool') {
      animAction.current = { type: 'spin', progress: 0 };
    } else if (emotion === 'laugh') {
      animAction.current = { type: 'wobble', progress: 0 };
    } else if (emotion === 'happy' || emotion === 'shock') {
      animAction.current = { type: 'jump', progress: 0 };
    }
  }, [emotion]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 140;
    const height = container.clientHeight || 140;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    // 2. Renderer
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffe6aa, 0x5a3d75, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff77aa, 1.2);
    rimLight.position.set(-3, -2, -2);
    scene.add(rimLight);

    const topSparkle = new THREE.PointLight(0xffffff, 1.4, 8);
    topSparkle.position.set(0, 2.5, 2);
    scene.add(topSparkle);

    // 4. Procedural 3D Emoji Character Group
    const rootGroup = new THREE.Group();
    characterGroupRef.current = rootGroup;
    scene.add(rootGroup);

    // Head Material: Glossy golden-yellow physical material
    const headMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffba08),
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      reflectivity: 0.9,
    });
    const headGeo = new THREE.SphereGeometry(1.0, 36, 36);
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMeshRef.current = headMesh;
    rootGroup.add(headMesh);

    // Contact shadow beneath emoji
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050210,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.15;
    rootGroup.add(shadowMesh);

    // Left & Right Eyes (Groups with Whites & Pupils)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a0f28 });

    const createEye = (isRight: boolean) => {
      const eyeGroup = new THREE.Group();
      const whiteGeo = new THREE.SphereGeometry(0.24, 20, 20);
      const white = new THREE.Mesh(whiteGeo, eyeWhiteMat);
      white.scale.set(0.9, 1.15, 0.5);
      eyeGroup.add(white);

      const pupilGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, 0.13);
      eyeGroup.add(pupil);

      // Eye highlight sparkle
      const sparkleGeo = new THREE.SphereGeometry(0.04, 10, 10);
      const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
      sparkle.position.set(0.04, 0.04, 0.19);
      eyeGroup.add(sparkle);

      eyeGroup.position.set(isRight ? 0.34 : -0.34, 0.22, 0.85);
      return { eyeGroup, pupil };
    };

    const eyeL = createEye(false);
    leftEyeRef.current = eyeL.eyeGroup;
    leftPupilRef.current = eyeL.pupil;
    rootGroup.add(eyeL.eyeGroup);

    const eyeR = createEye(true);
    rightEyeRef.current = eyeR.eyeGroup;
    rightPupilRef.current = eyeR.pupil;
    rootGroup.add(eyeR.eyeGroup);

    // Procedural 3D Heart Eyes for 'love' mode ❤️
    const heartGroup = new THREE.Group();
    heartEyesRef.current = heartGroup;
    const heartShape = new THREE.Shape();
    const x = 0, y = 0;
    heartShape.moveTo(x + 0.25, y + 0.25);
    heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
    heartShape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
    heartShape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 1.0);
    heartShape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
    heartShape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
    heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

    const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    heartGeo.center();
    const heartMat = new THREE.MeshPhysicalMaterial({
      color: 0xff0055,
      emissive: 0x880022,
      roughness: 0.15,
      clearcoat: 0.9,
    });

    const leftHeart = new THREE.Mesh(heartGeo, heartMat);
    leftHeart.scale.set(0.48, -0.48, 0.48);
    leftHeart.position.set(-0.34, 0.24, 0.95);
    heartGroup.add(leftHeart);

    const rightHeart = new THREE.Mesh(heartGeo, heartMat);
    rightHeart.scale.set(0.48, -0.48, 0.48);
    rightHeart.position.set(0.34, 0.24, 0.95);
    heartGroup.add(rightHeart);

    heartGroup.visible = false;
    rootGroup.add(heartGroup);

    // Cute Cheeks Blush
    const blushGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const blushMat = new THREE.MeshStandardMaterial({
      color: 0xff4077,
      roughness: 0.5,
      transparent: true,
      opacity: 0.55,
    });
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.scale.set(1.2, 0.6, 0.3);
    blushL.position.set(-0.58, -0.05, 0.76);
    blushLeftRef.current = blushL;
    rootGroup.add(blushL);

    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.scale.set(1.2, 0.6, 0.3);
    blushR.position.set(0.58, -0.05, 0.76);
    blushRightRef.current = blushR;
    rootGroup.add(blushR);

    // Expressive 3D Mouth
    const mouthGeo = new THREE.TorusGeometry(0.24, 0.065, 12, 28, Math.PI);
    const mouthMat = new THREE.MeshStandardMaterial({
      color: 0x4a0e2e,
      roughness: 0.3,
    });
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.rotation.z = Math.PI;
    mouthMesh.position.set(0, -0.25, 0.92);
    mouthRef.current = mouthMesh;
    rootGroup.add(mouthMesh);

    // Floating 3D Hands
    const handGeo = new THREE.SphereGeometry(0.26, 20, 20);
    const handMat = new THREE.MeshPhysicalMaterial({
      color: 0xffba08,
      roughness: 0.25,
      clearcoat: 0.6,
    });
    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.scale.set(0.9, 1.1, 0.8);
    leftHand.position.set(-1.18, -0.3, 0.3);
    leftHandRef.current = leftHand;
    rootGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.scale.set(0.9, 1.1, 0.8);
    rightHand.position.set(1.18, -0.3, 0.3);
    rightHandRef.current = rightHand;
    rootGroup.add(rightHand);

    // Cool Sunglasses (hidden by default, shown in 'cool' mode)
    const glassesGroup = new THREE.Group();
    sunglassesRef.current = glassesGroup;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x050510,
      roughness: 0.05,
      clearcoat: 1.0,
      reflectivity: 1.0,
    });
    const lensGeo = new THREE.BoxGeometry(0.42, 0.28, 0.05);
    const lensL = new THREE.Mesh(lensGeo, lensMat);
    lensL.position.set(-0.35, 0.22, 0.97);
    glassesGroup.add(lensL);

    const lensR = new THREE.Mesh(lensGeo, lensMat);
    lensR.position.set(0.35, 0.22, 0.97);
    glassesGroup.add(lensR);

    const bridgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.2);
    const bridge = new THREE.Mesh(bridgeGeo, frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.25, 0.97);
    glassesGroup.add(bridge);

    glassesGroup.visible = false;
    rootGroup.add(glassesGroup);

    // 5. Pointer Tracking Listener
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      const nx = ((clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2));
      const ny = ((clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2));
      pointerPos.current.targetX = Math.max(-1, Math.min(1, nx));
      pointerPos.current.targetY = Math.max(-1, Math.min(1, ny));
    };
    window.addEventListener('pointermove', onPointerMove);

    // 6. Animation Loop
    let animFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Pointer smooth damping
      pointerPos.current.x += (pointerPos.current.targetX - pointerPos.current.x) * 0.1;
      pointerPos.current.y += (pointerPos.current.targetY - pointerPos.current.y) * 0.1;

      // Idle bobbing
      const bobY = Math.sin(time * 2.8) * 0.08;
      rootGroup.position.y = bobY;

      // Head tilt following pointer
      const targetRotY = pointerPos.current.x * 0.55;
      const targetRotX = -pointerPos.current.y * 0.4;
      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.12;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.12;

      // Eye pupils tracking
      if (leftPupilRef.current && rightPupilRef.current) {
        const pupilX = pointerPos.current.x * 0.05;
        const pupilY = -pointerPos.current.y * 0.05;
        leftPupilRef.current.position.x = pupilX;
        leftPupilRef.current.position.y = pupilY;
        rightPupilRef.current.position.x = pupilX;
        rightPupilRef.current.position.y = pupilY;
      }

      // Blinking
      const blinkCycle = time % 4.5;
      const isBlinking = blinkCycle > 4.3 && blinkCycle < 4.45;
      const eyeScaleY = isBlinking ? 0.08 : 1.0;
      if (leftEyeRef.current && rightEyeRef.current) {
        leftEyeRef.current.scale.y = eyeScaleY;
        rightEyeRef.current.scale.y = eyeScaleY;
      }

      // Floating hands motion
      if (leftHandRef.current && rightHandRef.current) {
        leftHandRef.current.position.y = -0.3 + Math.sin(time * 3.2 + 0.8) * 0.06;
        rightHandRef.current.position.y = -0.3 + Math.sin(time * 3.2 + 2.2) * 0.06;
        leftHandRef.current.rotation.z = Math.sin(time * 2.5) * 0.15;
        rightHandRef.current.rotation.z = -Math.sin(time * 2.5) * 0.15;
      }

      // Voice lip-sync during calls / voice notes
      if (mouthRef.current) {
        const voiceTalk = Math.max(talkingLevel, 0);
        const dynamicScale = 1 + voiceTalk * 1.8;
        mouthRef.current.scale.set(1 + voiceTalk * 0.4, dynamicScale, 1);
        mouthRef.current.position.y = -0.25 - voiceTalk * 0.06;
      }

      // Action animations (jump, spin, wobble, love_pulse)
      const action = animAction.current;
      if (action.type !== 'none') {
        action.progress += delta * 2.5;

        if (action.type === 'jump') {
          const jumpHeight = Math.sin(Math.min(action.progress, 1) * Math.PI) * 0.65;
          rootGroup.position.y += jumpHeight;
          if (leftHandRef.current && rightHandRef.current) {
            leftHandRef.current.position.y += jumpHeight * 0.7;
            rightHandRef.current.position.y += jumpHeight * 0.7;
          }
        } else if (action.type === 'spin') {
          rootGroup.rotation.y += Math.PI * 2 * (1 - Math.min(action.progress, 1)) * delta * 4;
        } else if (action.type === 'wobble') {
          rootGroup.rotation.z = Math.sin(action.progress * Math.PI * 4) * 0.22 * (1 - Math.min(action.progress, 1));
        } else if (action.type === 'love_pulse') {
          const beat = 1 + Math.sin(action.progress * Math.PI * 4) * 0.18 * (1 - Math.min(action.progress, 1));
          rootGroup.scale.set(beat, beat, beat);
        }

        if (action.progress >= 1) {
          action.type = 'none';
          rootGroup.scale.set(1, 1, 1);
          rootGroup.rotation.z = 0;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Update facial expression on emotion change
  useEffect(() => {
    const isLove = emotion === 'love';
    const isCool = emotion === 'cool';
    const isLaugh = emotion === 'laugh';
    const isShock = emotion === 'shock';
    const isSad = emotion === 'sad';

    if (heartEyesRef.current) heartEyesRef.current.visible = isLove;
    if (leftEyeRef.current) leftEyeRef.current.visible = !isLove && !isCool;
    if (rightEyeRef.current) rightEyeRef.current.visible = !isLove && !isCool;
    if (sunglassesRef.current) sunglassesRef.current.visible = isCool;

    if (mouthRef.current) {
      if (isSad) {
        mouthRef.current.rotation.z = 0; // upside down frown
        mouthRef.current.position.y = -0.32;
      } else if (isShock) {
        mouthRef.current.rotation.z = Math.PI;
        mouthRef.current.scale.set(0.7, 1.8, 0.7);
        mouthRef.current.position.y = -0.28;
      } else if (isLaugh) {
        mouthRef.current.rotation.z = Math.PI;
        mouthRef.current.scale.set(1.4, 1.6, 1);
        mouthRef.current.position.y = -0.22;
      } else {
        mouthRef.current.rotation.z = Math.PI;
        mouthRef.current.scale.set(1, 1, 1);
        mouthRef.current.position.y = -0.25;
      }
    }
  }, [emotion]);

  const handleMascotClick = () => {
    // Random cheerful giggle phrases in Hindi/English
    const quotes = [
      'Awww! ❤️',
      'Hahaha! 😂',
      'Dost ready hai! 🚀',
      'Video call karein? 📹',
      'Heart react try karo! 💕',
      'Sun raha hu! 🎙️',
      'Kya haal hai? 👋',
    ];
    const picked = quotes[Math.floor(Math.random() * quotes.length)];
    setBubbleText(picked);
    animAction.current = { type: 'jump', progress: 0 };
    if (onTap) onTap();
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group"
      onClick={handleMascotClick}
      title="Click 3D Emoji Mascot to interact!"
    >
      {/* Interactive 3D Canvas Mount */}
      <div
        ref={mountRef}
        className="w-28 h-28 md:w-32 md:h-32 transition-transform duration-200 group-hover:scale-105"
      />

      {/* Speech / Reaction Bubble */}
      {bubbleText && (
        <div className="absolute -top-7 px-3 py-1 bg-white/95 backdrop-blur-md text-[#1d1238] font-bold text-xs rounded-full shadow-lg border border-purple-300/40 animate-pop-in pointer-events-none whitespace-nowrap z-20">
          {bubbleText}
          <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-2 h-2 bg-white/95 rotate-45" />
        </div>
      )}

      {/* Interactive tap prompt on hover */}
      <div className="text-[10px] text-purple-300/70 tracking-wider font-semibold opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        TAP ME ✨
      </div>
    </div>
  );
};
