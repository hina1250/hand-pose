let detector;
let results;
let knnResult;
let knnProbability; // 確率を保持する変数
let classifier;
let net;
const decoLoadedImage = {}; // スタンプ画像を格納するオブジェクト
const decoImageList = ['star', 'peace', 'heart01', 'heart02', 'heart03']; // スタンプ画像のリスト

let webcam;
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasWrapperElement = document.getElementById('canvasWrapper');
const ctx = canvasElement.getContext('2d');

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

// ポーズを検知する関数
async function estimatePose() {
  if (classifier.getNumClasses() > 0) {
    const img = await webcam.capture();

    const activation = net.infer(img, 'conv_preds');
    const result = await classifier.predictClass(activation);

    const classes = ['ふつうのピース', '顔ピース', '指ハート', 'なし'];
    const probabilities = result.confidences; // 各クラスの確率を取得

    knnResult = classes[result.label];
    knnProbability = probabilities[result.label]; // 確率を変数に保存

    img.dispose();
  }

  await tf.nextFrame();
}

async function setupKNN() {
  classifier = knnClassifier.create();
  net = await mobilenet.load();

  webcam = await tf.data.webcam(webcamElement);

  return new Promise((resolve) => {
    resolve();
  });
}

async function loadKNNModel() {
  const response = await fetch('models/knn-classifier-model.txt');
  const txt = await response.text();

  // https://github.com/tensorflow/tfjs/issues/633
  classifier.setClassifierDataset(
    Object.fromEntries(
      JSON.parse(txt).map(([label, data, shape]) => [
        label,
        tf.tensor(data, shape)
      ])
    )
  );

  return new Promise((resolve) => {
    resolve();
  });
}

// Canvasにスタンプ画像を描画する関数
function drawCanvas() {
  if (!results || results.length === 0) return;

  results.forEach(result => {
    const { keypoints } = result;

    const thumbMcp = keypoints.find((keypoint) => keypoint.name === 'thumb_mcp');
    const thumbTip = keypoints.find((keypoint) => keypoint.name === 'thumb_tip');
    const indexFingerMcp = keypoints.find((keypoint) => keypoint.name === 'index_finger_mcp');
    const indexFingerTip = keypoints.find((keypoint) => keypoint.name === 'index_finger_tip');
    const middleFingerMcp = keypoints.find((keypoint) => keypoint.name === 'middle_finger_mcp');
    const middleFingerTip = keypoints.find((keypoint) => keypoint.name === 'middle_finger_tip');
    const ringFingerMcp = keypoints.find((keypoint) => keypoint.name === 'ring_finger_mcp');
    const ringFingerTip = keypoints.find((keypoint) => keypoint.name === 'ring_finger_tip');
    const pinkyFingerMcp = keypoints.find((keypoint) => keypoint.name === 'pinky_finger_mcp');
    const pinkyFingerTip = keypoints.find((keypoint) => keypoint.name === 'pinky_finger_tip');

    // 位置の中間点を計算
    const indexMiddleMidPointX = (indexFingerTip.x + middleFingerTip.x) / 2;
    const thumbIndexMidPointX = (thumbTip.x + indexFingerTip.x) / 2;

    // 手の大きさを基準にスケールを計算
    const fingerDistance = Math.hypot(
      indexFingerTip.x - middleFingerTip.x,
      indexFingerTip.y - middleFingerTip.y
    );
    const baseFingerDistance = 50; // 基準となる指の距離
    const scale = baseFingerDistance / fingerDistance;

    if (knnResult === 'ふつうのピース' && knnProbability === 1) {
      drawDecoImage({
        image: decoLoadedImage.peace,
        x: indexMiddleMidPointX,
        y: indexFingerTip.y - 30,
        scale: 3 * scale,
      });
    } else if (knnResult === '顔ピース' && knnProbability === 1) {
      drawDecoImage({
        image: decoLoadedImage.star,
        x: pinkyFingerMcp.x,
        y: middleFingerMcp.y - 30,
        scale: 2 * scale,
      });
    } else if (knnResult === '指ハート' && knnProbability === 1) {
      drawDecoImage({
        image: decoLoadedImage.heart01,
        x: thumbIndexMidPointX,
        y: indexFingerTip.y - 30,
        scale: 2 * scale,
      });
    }
  });
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
function drawDecoImage({ image, x, y, scale = 1, xFix = 0, yFix = 0}) {
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
function render() {
  estimatePose(); // ポーズを検知する
  estimateHands(); // 手を検知する
  drawWebCamToCanvas(); // canvasにvideoを描画する
  drawCanvas(); // canvasにやりたいことを描画する

  window.requestAnimationFrame(render);
}

// 初期化関数
async function initHandPose() {
  loadDecoImages(); // スタンプ画像をロード
  await enableCam(); // Webカメラの起動
  await createHandDetector(); // 手検知モデルの初期化
  await setupKNN(); // KNNモデルのセットアップ
  await loadKNNModel(); // KNNモデルのロード
  initCanvas(); // Canvasの初期化

  render(); // 毎フレーム走らせる処理
}

// 初期化関数を呼び出す
initHandPose();
