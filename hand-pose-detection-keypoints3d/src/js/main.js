let detector;
let results;
let net;
const decoLoadedImage = {}; // スタンプ画像を格納するオブジェクト
const decoImageList = ['star', 'peace', 'heart01', 'heart02', 'heart03']; // スタンプ画像のリスト

let webcam;
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasWrapperElement = document.getElementById('canvasWrapper');
const ctx = canvasElement.getContext('2d');

let thumbTip, thumbMcp, indexFingerTip, indexFingerMcp, middleFingerTip, middleFingerMcp, ringFingerTip, ringFingerMcp, pinkyFingerTip, pinkyFingerMcp;

// キーポイントを一度に取得する関数
function getFingerKeypoints(keypoints) {
  thumbTip = keypoints.find((keypoint) => keypoint.name === 'thumb_tip');
  thumbMcp = keypoints.find((keypoint) => keypoint.name === 'thumb_mcp');
  indexFingerTip = keypoints.find((keypoint) => keypoint.name === 'index_finger_tip');
  indexFingerMcp = keypoints.find((keypoint) => keypoint.name === 'index_finger_mcp');
  middleFingerTip = keypoints.find((keypoint) => keypoint.name === 'middle_finger_tip');
  middleFingerMcp = keypoints.find((keypoint) => keypoint.name === 'middle_finger_mcp');
  ringFingerTip = keypoints.find((keypoint) => keypoint.name === 'ring_finger_tip');
  ringFingerMcp = keypoints.find((keypoint) => keypoint.name === 'ring_finger_mcp');
  pinkyFingerTip = keypoints.find((keypoint) => keypoint.name === 'pinky_finger_tip');
  pinkyFingerMcp = keypoints.find((keypoint) => keypoint.name === 'pinky_finger_mcp');
}

// Webカメラを有効にする関数
async function enableCam() {
  const constraints = {
    audio: false,
    video: true,
    width: 640,
    height: 480
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    webcamElement.srcObject = stream;

    return new Promise((resolve) => {
      webcamElement.onloadedmetadata = () => {
        console.log("video loaded");
        webcamElement.play();
        resolve();
      };
    });
  } catch (error) {
    console.error('Error accessing webcam: ', error);
    alert('カメラのアクセスに失敗しました。カメラのアクセス権限を確認してください。');
  }
}

// Canvasの初期化関数
function initCanvas() {
  //canvasの大きさをwebcamに合わせる
  canvasElement.width = webcamElement.videoWidth;
  canvasElement.height = webcamElement.videoHeight;

  canvasWrapperElement.style.width = `${webcamElement.videoWidth}px`;
  canvasWrapperElement.style.height = `${webcamElement.videoHeight}px`;
}

// Webcamの画像をCanvasに描画する関数
function drawWebCamToCanvas() {
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // キャンバスの水平反転を設定
  ctx.save(); // 現在の状態を保存
  ctx.scale(-1, 1); // 水平反転
  ctx.translate(-canvasElement.width, 0); // 座標を移動して反転を適用

  ctx.drawImage(
    webcamElement,
    0,
    0,
    webcamElement.videoWidth,
    webcamElement.videoHeight
  );

  ctx.restore(); // 反転を元に戻す
}

// 手を検知するためのモデルを初期化する関数
async function createHandDetector() {
  const model = handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'mediapipe', // or 'tfjs',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
    modelType: 'full'
  }
  detector = await handPoseDetection.createDetector(model, detectorConfig);

  return new Promise((resolve) => {
    resolve(detector);
  });
}

// 手を検知する関数
async function estimateHands() {
  const estimationConfig = { flipHorizontal: false };

  results = await detector.estimateHands(webcamElement, estimationConfig);
}

// ピースサインかどうかを判定する関数
function isPeaceSign(keypoints) {
  getFingerKeypoints(keypoints);

  // 親指が曲がっているかチェック
  const isThumbBent = thumbTip.y > thumbMcp.y;

  // 指の伸び具合を計算するための閾値
  const extendedThreshold = 40; // 例として40ピクセルの差を設定

  // 人差し指と中指が十分に伸ばされているかチェック
  const isIndexFingerExtended = (indexFingerMcp.y - indexFingerTip.y) > extendedThreshold;
  const isMiddleFingerExtended = (middleFingerMcp.y - middleFingerTip.y) > extendedThreshold;

  // 薬指と小指が曲がっているかチェック
  const isRingFingerBent = ringFingerTip.y > ringFingerMcp.y;
  const isPinkyFingerBent = pinkyFingerTip.y > pinkyFingerMcp.y;

  return isThumbBent && isIndexFingerExtended && isMiddleFingerExtended && isRingFingerBent && isPinkyFingerBent;
}

// 指ハートかどうかを判定する関数
function isFingerHeart(result, scale) {
  const { keypoints, handedness } = result;
  getFingerKeypoints(keypoints);

  // 親指と人差し指の先端が近いかどうかをチェック
  const thumbIndexDistance = Math.hypot(
    thumbTip.x - indexFingerTip.x,
    thumbTip.y - indexFingerTip.y
  );
  const thresholdDistance = 150 * scale; // 例として50ピクセルの距離を設定

  if (thumbIndexDistance >= thresholdDistance) {
    return false;
  }

  // handednessに基づいて親指が外側にあり、人差し指が内側にあるかをチェック
  const isThumbOutside =
    (handedness === 'Right' && thumbTip.x > indexFingerTip.x) ||
    (handedness === 'Left' && thumbTip.x < indexFingerTip.x);

  if (!isThumbOutside) {
    return false;
  }

  // その他の指のx座標が近いかをチェック
  const xThresholdDistance = 20; // 例として20ピクセルの距離を設定
  const isFingersAlignedX =
    Math.abs(indexFingerTip.x - middleFingerTip.x) < xThresholdDistance &&
    Math.abs(indexFingerTip.x - ringFingerTip.x) < xThresholdDistance &&
    Math.abs(indexFingerTip.x - pinkyFingerTip.x) < xThresholdDistance;

  if (!isFingersAlignedX) {
    return false;
  }

  // その他の指のy座標が中指＞薬指＞小指かをチェック
  const isFingersAlignedY = middleFingerTip.y < ringFingerTip.y && ringFingerTip.y < pinkyFingerTip.y;

  return isFingersAlignedX && isFingersAlignedY;
}

// ほっぺハートかどうかを判定する関数
function isCheekHeart(keypoints) {
  // キーポイントを取得
  getFingerKeypoints(keypoints);

  // 親指の位置が他の指よりも下にあるかをチェック
  const isThumbLower = thumbTip.y > indexFingerTip.y && thumbTip.y > middleFingerTip.y && thumbTip.y > ringFingerTip.y && thumbTip.y > pinkyFingerTip.y;

  // 他の指（人差し指、中指、薬指、小指）のxとy座標がほぼ同じ位置にあるかをチェック
  const xThresholdDistance = 20; // 例として20ピクセルの距離を設定
  const yThresholdDistance = 20; // 例として20ピクセルの距離を設定

  const isFingersAligned =
    Math.abs(indexFingerTip.x - middleFingerTip.x) < xThresholdDistance &&
    Math.abs(indexFingerTip.x - ringFingerTip.x) < xThresholdDistance &&
    Math.abs(indexFingerTip.x - pinkyFingerTip.x) < xThresholdDistance &&
    Math.abs(indexFingerTip.y - middleFingerTip.y) < yThresholdDistance &&
    Math.abs(indexFingerTip.y - ringFingerTip.y) < yThresholdDistance &&
    Math.abs(indexFingerTip.y - pinkyFingerTip.y) < yThresholdDistance;

  // 親指が他の指よりも下にあり、他の指の位置がほぼ同じであるかを総合的に判定
  return isThumbLower && isFingersAligned;
}

// Canvasにスタンプ画像を描画する関数
function drawCanvas() {
  if (!results || results.length === 0) return;

  results.forEach(result => {
    const { keypoints } = result;
    getFingerKeypoints(keypoints); // 2Dキーポイントを取得

    // 位置の中間点を計算
    const indexMiddleMidPoint = keypoints.find(k => k.name === 'middle_finger_tip');
    const thumbIndexMidPoint = keypoints.find(k => k.name === 'thumb_tip');
    const pinkyFingerMcp = keypoints.find(k => k.name === 'pinky_finger_mcp');
    const middleFingerMcp = keypoints.find(k => k.name === 'middle_finger_mcp');

    // 手のバウンディングボックスを計算
    const handBoundingBox = calculateHandBoundingBox(keypoints);
    const handWidth = handBoundingBox.maxX - handBoundingBox.minX;
    const handHeight = handBoundingBox.maxY - handBoundingBox.minY;
    const handSize = Math.max(handWidth, handHeight); // 手のサイズを決定

    const baseHandSize = 100; // 基準となる手のサイズ（ピクセル）
    const scale = baseHandSize / handSize; // スケールを計算

    if (isPeaceSign(keypoints)) {
      drawDecoImage({
        image: decoLoadedImage.peace,
        x: indexMiddleMidPoint.x,
        y: indexMiddleMidPoint.y - 30,
        scale: 3 * scale,
      });
    } else if (isCheekHeart(keypoints)) {

      drawDecoImage({
        image: decoLoadedImage.heart01,
        x: pinkyFingerMcp.x,
        y: middleFingerMcp.y,
        scale: 2 * scale,
      });
    } else if (isFingerHeart(result, scale)) {
      drawDecoImage({
        image: decoLoadedImage.heart03,
        x: thumbIndexMidPoint.x,
        y: thumbIndexMidPoint.y - 30,
        scale: 2 * scale,
      });
    }
  });
}


// 手のバウンディングボックスを計算する関数
function calculateHandBoundingBox(keypoints) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  keypoints.forEach(keypoint => {
    if (keypoint.x < minX) minX = keypoint.x;
    if (keypoint.y < minY) minY = keypoint.y;
    if (keypoint.x > maxX) maxX = keypoint.x;
    if (keypoint.y > maxY) maxY = keypoint.y;
  });

  return { minX, minY, maxX, maxY };
}

// スタンプ画像をロードする関数
function loadDecoImages() {
  decoImageList.forEach((name) => {
    const img = new Image();
    img.src = `hand-pose/images/${name}.png`;
    decoLoadedImage[name] = img;
  });
}

// スタンプ画像を描画する関数
function drawDecoImage({ image, x, y, scale = 1, xFix = 0, yFix = 0 }) {
  const flippedX = canvasElement.width - x;
  const dx = flippedX - image.width / scale / 2; // 画像の中心に合わせるための計算
  const dy = y - image.height / scale / 2; // 画像の中心に合わせるための計算

  ctx.save(); // 現在のキャンバス状態を保存
  ctx.translate(dx + xFix + image.width / scale / 2, dy + yFix + image.height / scale / 2); // 画像の中心に移動

  ctx.drawImage(
    image,
    -image.width / scale / 2,
    -image.height / scale / 2,
    image.width / scale,
    image.height / scale
  );
  ctx.restore(); // 回転前の状態に戻す
}

// 毎フレーム走らせる処理
async function render() {
  await estimateHands(); // 手を検知する
  drawWebCamToCanvas(); // canvasにvideoを描画する
  drawCanvas(); // canvasにやりたいことを描画する

  window.requestAnimationFrame(render);
}

// 初期化関数
async function initHandPose() {
  loadDecoImages(); // スタンプ画像をロード
  await enableCam(); // Webカメラの起動
  await createHandDetector(); // 手検知モデルの初期化
  initCanvas(); // Canvasの初期化

  render(); // 毎フレーム走らせる処理
}

// 初期化関数を呼び出す
initHandPose();
