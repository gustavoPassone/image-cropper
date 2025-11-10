// --- Referências do DOM ---
const uploadStep = document.getElementById("upload-step");
const editStep = document.getElementById("edit-step");
const resultStep = document.getElementById("result-step");

const dropZone = document.getElementById("drop-zone");
const selectButton = document.getElementById("select-button");
const fileInput = document.getElementById("file-input");

const opencvStatus = document.getElementById("opencv-status");
const uploadInstructions = document.getElementById("upload-instructions");
const uploadButtons = document.getElementById("upload-buttons");

const canvasWrapper = document.getElementById("canvas-wrapper");
const editCanvas = document.getElementById("edit-canvas");
const editCtx = editCanvas.getContext("2d");

const cropButton = document.getElementById("crop-button");
const resetButton = document.getElementById("reset-button");

const resultCanvas = document.getElementById("result-canvas");
const downloadButton = document.getElementById("download-button");
const startOverButton = document.getElementById("start-over-button");

// --- Variáveis de Estado ---
let originalImage; // O objeto Image() original
let originalFileName = ""; // <-- CORREÇÃO 3: Armazena o nome do arquivo original
let displayedImageWidth; // Largura da imagem como ela é desenhada no canvas
let displayedImageHeight; // Altura da imagem como ela é desenhada no canvas
let points = []; // Array de 4 objetos {x, y}
let draggingPoint = null; // Índice do ponto sendo arrastado (0-3)
let canvasScale = 1; // Para corrigir cliques em canvas responsivo (relação entre canvas.width e rect.width)

const POINT_RADIUS = 25; // Raio visual do círculo externo do ponto
const CLICK_RADIUS = 40; // Raio da área clicável do ponto
const LINE_WIDTH = 3; // Largura da linha
const POINT_FILL_COLOR = "rgba(128, 128, 128, 0.4)"; // Cinza semi-transparente
const POINT_STROKE_COLOR = "rgba(0, 150, 255, 0.9)"; // Azul
const DRAGGING_STROKE_COLOR = "rgba(255, 0, 0, 0.9)"; // Vermelho ao arrastar

// --- 1. Inicialização do OpenCV ---

function onOpenCvReady() {
  // A biblioteca está pronta. Habilita a UI de upload.
  console.log("OpenCV.js está pronto.");
  opencvStatus.textContent = "Biblioteca carregada!";
  opencvStatus.classList.remove("text-gray-700");
  opencvStatus.classList.add("text-green-600");
  uploadInstructions.classList.remove("hidden");
  uploadButtons.classList.remove("hidden");

  // Ativa os listeners de upload
  setupUploadListeners();
}

// --- 2. Lógica de Upload ---

function setupUploadListeners() {
  // Botão de selecionar
  selectButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImage(e.target.files[0]);
    }
  });

  // Drag and Drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImage(e.dataTransfer.files[0]);
    }
  });
}

function handleImage(file) {
  if (!file.type.startsWith("image/")) {
    alert("Por favor, selecione um arquivo de imagem (PNG, JPG).");
    return;
  }

  originalFileName = file.name; // <-- CORREÇÃO 3: Salva o nome original
  originalImage = new Image();
  originalImage.src = URL.createObjectURL(file);
  originalImage.onload = () => {
    // <!--
    //   CORREÇÃO 1:
    //   Primeiro, tornamos a tela de edição visível.
    //   Isso garante que o 'canvasWrapper.clientWidth' não seja 0.
    // -->
    uploadStep.classList.add("hidden");
    resultStep.classList.add("hidden");
    editStep.classList.remove("hidden");

    // <!--
    //   CORREÇÃO 1:
    //   Agora que a tela está visível, podemos inicializar o canvas,
    //   que desenhará a imagem imediatamente.
    // -->
    initializeCanvas();
  };
  originalImage.onerror = () => {
    alert("Não foi possível carregar a imagem.");
  };
}

// --- 3. Lógica de Edição (Canvas) ---

function initializeCanvas() {
  if (!originalImage) return;

  const maxWidth = canvasWrapper.clientWidth * 0.9; // 90% da largura do wrapper
  const maxHeight = window.innerHeight * 0.7; // 70% da altura da viewport para caber bem

  let scaleFactor = 1;

  // Calcula o fator de escala para que a imagem caiba completamente
  if (originalImage.width > maxWidth || originalImage.height > maxHeight) {
    scaleFactor = Math.min(
      maxWidth / originalImage.width,
      maxHeight / originalImage.height
    );
  }

  displayedImageWidth = originalImage.width * scaleFactor;
  displayedImageHeight = originalImage.height * scaleFactor;

  editCanvas.width = displayedImageWidth;
  editCanvas.height = displayedImageHeight;

  // Inicializa os 4 pontos nos cantos da *imagem redimensionada*
  // Damos uma pequena margem (ex: 10% do menor lado da imagem REDIMENSIONADA)
  const margin = Math.min(displayedImageWidth, displayedImageHeight) * 0.1;

  // Ajusta os pontos para as novas dimensões do canvas
  points = [
    { x: margin, y: margin }, // Canto superior esquerdo
    { x: displayedImageWidth - margin, y: margin }, // Canto superior direito
    { x: displayedImageWidth - margin, y: displayedImageHeight - margin }, // Canto inferior direito
    { x: margin, y: displayedImageHeight - margin }, // Canto inferior esquerdo
  ];

  drawCanvas();
}

function drawCanvas() {
  if (!originalImage) return;

  // Limpa o canvas
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);

  // 1. Desenha a imagem original (redimensionada)
  editCtx.drawImage(
    originalImage,
    0,
    0,
    displayedImageWidth,
    displayedImageHeight
  );

  // 2. Desenha as linhas de conexão
  editCtx.strokeStyle = POINT_STROKE_COLOR;
  editCtx.lineWidth = LINE_WIDTH;
  editCtx.beginPath();
  editCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    editCtx.lineTo(points[i].x, points[i].y);
  }
  editCtx.closePath();
  editCtx.stroke();

  // 3. Desenha os pontos (círculos transparentes com borda)
  points.forEach((p, index) => {
    editCtx.fillStyle = POINT_FILL_COLOR; // Corpo do círculo
    editCtx.strokeStyle =
      index === draggingPoint ? DRAGGING_STROKE_COLOR : POINT_STROKE_COLOR; // Borda do círculo
    editCtx.lineWidth = LINE_WIDTH;

    editCtx.beginPath();
    editCtx.arc(p.x, p.y, POINT_RADIUS, 0, 2 * Math.PI);
    editCtx.fill();
    editCtx.stroke(); // Desenha a borda
  });
}

// --- Lógica de Arrastar Pontos (Mouse e Toque) ---

function getCanvasPos(e) {
  const rect = editCanvas.getBoundingClientRect();
  // Calcula o quanto o canvas foi redimensionado pelo CSS em relação ao seu tamanho "interno" (width/height)
  canvasScale = editCanvas.width / rect.width;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  return {
    x: (clientX - rect.left) * canvasScale,
    y: (clientY - rect.top) * canvasScale,
  };
}

function findPoint(x, y) {
  // Verifica se o clique foi perto de um ponto
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < CLICK_RADIUS) {
      // Usa o raio de clique maior
      return i;
    }
  }
  return null;
}

function onDown(e) {
  e.preventDefault();
  const pos = getCanvasPos(e);
  draggingPoint = findPoint(pos.x, pos.y);
  if (draggingPoint !== null) {
    drawCanvas(); // Redesenha para mostrar o ponto com borda vermelha
  }
}

function onMove(e) {
  if (draggingPoint === null) return;
  e.preventDefault();
  const pos = getCanvasPos(e);

  // Limita o movimento para dentro das dimensões da imagem exibida
  points[draggingPoint].x = Math.max(0, Math.min(displayedImageWidth, pos.x));
  points[draggingPoint].y = Math.max(0, Math.min(displayedImageHeight, pos.y));

  drawCanvas();
}

function onUp(e) {
  if (draggingPoint !== null) {
    draggingPoint = null;
    drawCanvas(); // Redesenha para voltar à borda azul
  }
}

// --- 4. Processamento com OpenCV.js ---

function performWarp() {
  try {
    // Para o OpenCV, precisamos dos pontos na escala da IMAGEM ORIGINAL.
    // Primeiro, calculamos o fator de escala que usamos para exibir a imagem.
    const originalToDisplayedScaleX = originalImage.width / displayedImageWidth;
    const originalToDisplayedScaleY =
      originalImage.height / displayedImageHeight;

    // 1. Carrega a imagem original no OpenCV (sem redimensionamento)
    let src = cv.imread(originalImage);

    // 2. Define os 4 pontos de origem (do usuário), convertidos para a escala original da imagem
    let srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      points[0].x * originalToDisplayedScaleX,
      points[0].y * originalToDisplayedScaleY,
      points[1].x * originalToDisplayedScaleX,
      points[1].y * originalToDisplayedScaleY,
      points[2].x * originalToDisplayedScaleX,
      points[2].y * originalToDisplayedScaleY,
      points[3].x * originalToDisplayedScaleX,
      points[3].y * originalToDisplayedScaleY,
    ]);

    // 3. Define os 4 pontos de destino (um retângulo perfeito)
    // Calculamos as dimensões do retângulo de saída com base na largura
    // e altura máximas do quadrilátero selecionado na ESCALA ORIGINAL.

    let p0_orig = {
      x: points[0].x * originalToDisplayedScaleX,
      y: points[0].y * originalToDisplayedScaleY,
    };
    let p1_orig = {
      x: points[1].x * originalToDisplayedScaleX,
      y: points[1].y * originalToDisplayedScaleY,
    };
    let p2_orig = {
      x: points[2].x * originalToDisplayedScaleX,
      y: points[2].y * originalToDisplayedScaleY,
    };
    let p3_orig = {
      x: points[3].x * originalToDisplayedScaleX,
      y: points[3].y * originalToDisplayedScaleY,
    };

    // Larguras (topo, base) e Alturas (esquerda, direita) na escala ORIGINAL
    let w1 = Math.hypot(p0_orig.x - p1_orig.x, p0_orig.y - p1_orig.y);
    let w2 = Math.hypot(p3_orig.x - p2_orig.x, p3_orig.y - p2_orig.y);
    let h1 = Math.hypot(p0_orig.x - p3_orig.x, p0_orig.y - p3_orig.y);
    let h2 = Math.hypot(p1_orig.x - p2_orig.x, p1_orig.y - p2_orig.y);

    let outWidth = Math.round(Math.max(w1, w2));
    let outHeight = Math.round(Math.max(h1, h2));

    let dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0, // Canto superior esquerdo
      outWidth - 1,
      0, // Canto superior direito
      outWidth - 1,
      outHeight - 1, // Canto inferior direito
      0,
      outHeight - 1, // Canto inferior esquerdo
    ]);

    // 4. Calcula a Matriz de Transformação de Perspectiva
    let M = cv.getPerspectiveTransform(srcPoints, dstPoints);

    // 5. Aplica a transformação (warp)
    let dst = new cv.Mat();
    let dsize = new cv.Size(outWidth, outHeight);
    cv.warpPerspective(
      src,
      dst,
      M,
      dsize,
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    );

    // 6. Exibe a imagem resultante no canvas de resultado
    cv.imshow(resultCanvas, dst);

    // 7. Configura o link de download
    // <-- CORREÇÃO 3: Usa o nome original e muda a extensão para .png -->
    const newFileName =
      originalFileName.split(".").slice(0, -1).join(".") + ".png";
    downloadButton.href = resultCanvas.toDataURL("image/png");
    downloadButton.download = newFileName; // Define o nome do arquivo

    // 8. Limpa a memória (MUITO IMPORTANTE no OpenCV.js)
    src.delete();
    dst.delete();
    M.delete();
    srcPoints.delete();
    dstPoints.delete();

    // 9. Troca para a tela de resultado
    editStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro no processamento do OpenCV:", error);
    alert("Ocorreu um erro ao processar a imagem. Tente novamente.");
  }
}

// --- 5. Lógica dos Botões de Ação ---

// Botões do Canvas
resetButton.addEventListener("click", initializeCanvas);
cropButton.addEventListener("click", performWarp);

// Botões de Resultado
startOverButton.addEventListener("click", () => {
  // Reseta tudo para a tela inicial
  fileInput.value = null; // Limpa o input de arquivo
  originalImage = null;
  originalFileName = ""; // <-- CORREÇÃO 3: Limpa o nome do arquivo
  points = [];
  draggingPoint = null;

  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  // Nâo precisa limpar o resultCanvas, ele será sobrescrito

  resultStep.classList.add("hidden");
  editStep.classList.add("hidden");
  uploadStep.classList.remove("hidden");
});

// Adiciona todos os listeners de mouse e toque
editCanvas.addEventListener("mousedown", onDown);
editCanvas.addEventListener("mousemove", onMove);
editCanvas.addEventListener("mouseup", onUp);
editCanvas.addEventListener("mouseout", onUp); // Cancela se o mouse sair

editCanvas.addEventListener("touchstart", onDown);
editCanvas.addEventListener("touchmove", onMove);
editCanvas.addEventListener("touchend", onUp);
editCanvas.addEventListener("touchcancel", onUp);

// Também re-inicializa o canvas se a janela for redimensionada
// Isso garante que a imagem sempre se ajuste à tela
window.addEventListener("resize", () => {
  if (originalImage && !editStep.classList.contains("hidden")) {
    initializeCanvas();
  }
});
