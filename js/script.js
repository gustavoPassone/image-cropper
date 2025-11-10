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
let points = []; // Array de 4 objetos {x, y}
let draggingPoint = null; // Índice do ponto sendo arrastado (0-3)
let canvasScale = 1; // Para corrigir cliques em canvas responsivo

const POINT_RADIUS = 25; // <-- ADICIONADO: Raio visual do ponto
const CLICK_RADIUS = 40; // <-- ADICIONADO: Raio de clique (maior para facilitar)

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

  originalImage = new Image();
  originalImage.src = URL.createObjectURL(file);
  originalImage.onload = () => {
    // Imagem carregada, inicializa a área de edição
    initializeCanvas();
    // Troca as telas
    uploadStep.classList.add("hidden");
    resultStep.classList.add("hidden");
    editStep.classList.remove("hidden");
  };
  originalImage.onerror = () => {
    alert("Não foi possível carregar a imagem.");
  };
}

// --- 3. Lógica de Edição (Canvas) ---

function initializeCanvas() {
  // Define o tamanho do canvas com base na imagem original
  editCanvas.width = originalImage.width;
  editCanvas.height = originalImage.height;

  // Ajusta o wrapper do canvas (para telas pequenas)
  // A CSS 'max-width: 100%' e 'max-height: 75vh' cuidam do redimensionamento
  // A linha abaixo foi removida pois causava overflow em imagens grandes
  // canvasWrapper.style.maxWidth = `${originalImage.width}px`;

  // Inicializa os 4 pontos nos cantos
  // Damos uma pequena margem (ex: 10% ou 50px) para facilitar a seleção
  const margin = Math.min(originalImage.width, originalImage.height) * 0.1;
  points = [
    { x: margin, y: margin }, // Canto superior esquerdo
    { x: originalImage.width - margin, y: margin }, // Canto superior direito
    { x: originalImage.width - margin, y: originalImage.height - margin }, // Canto inferior direito
    { x: margin, y: originalImage.height - margin }, // Canto inferior esquerdo
  ];

  drawCanvas();
}

function drawCanvas() {
  if (!originalImage) return;

  // Limpa o canvas
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);

  // 1. Desenha a imagem original
  editCtx.drawImage(originalImage, 0, 0);

  // 2. Desenha as linhas de conexão
  editCtx.strokeStyle = "rgba(0, 150, 255, 0.9)";
  editCtx.lineWidth = 3;
  editCtx.beginPath();
  editCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    editCtx.lineTo(points[i].x, points[i].y);
  }
  editCtx.closePath();
  editCtx.stroke();

  // 3. Desenha os pontos (círculos)
  points.forEach((p, index) => {
    editCtx.fillStyle =
      index === draggingPoint
        ? "rgba(255, 0, 0, 0.8)"
        : "rgba(0, 150, 255, 0.7)";
    editCtx.beginPath();
    editCtx.arc(p.x, p.y, POINT_RADIUS, 0, 2 * Math.PI); // <-- ATUALIZADO: Círculo com raio 25
    editCtx.fill();
  });
}

// --- Lógica de Arrastar Pontos (Mouse e Toque) ---

function getCanvasPos(e) {
  const rect = editCanvas.getBoundingClientRect();
  // Calcula o quanto o canvas foi redimensionado pelo CSS
  canvasScale = editCanvas.width / rect.width;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  return {
    x: (clientX - rect.left) * canvasScale,
    y: (clientY - rect.top) * canvasScale,
  };
}

function findPoint(x, y) {
  // Verifica se o clique foi perto de um ponto (raio de 40px)
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < CLICK_RADIUS) {
      // <-- ATUALIZADO: Raio de clique maior para facilitar
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
    drawCanvas(); // Redesenha para mostrar o ponto vermelho
  }
}

function onMove(e) {
  if (draggingPoint === null) return;
  e.preventDefault();
  const pos = getCanvasPos(e);

  // Limita o movimento para dentro do canvas
  points[draggingPoint].x = Math.max(0, Math.min(editCanvas.width, pos.x));
  points[draggingPoint].y = Math.max(0, Math.min(editCanvas.height, pos.y));

  drawCanvas();
}

function onUp(e) {
  if (draggingPoint !== null) {
    draggingPoint = null;
    drawCanvas(); // Redesenha para voltar à cor azul
  }
}

// --- 4. Processamento com OpenCV.js ---

function performWarp() {
  try {
    // 1. Carrega a imagem original no OpenCV
    let src = cv.imread(originalImage);

    // 2. Define os 4 pontos de origem (do usuário)
    // O formato deve ser [x1, y1, x2, y2, ...]
    let srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      points[0].x,
      points[0].y,
      points[1].x,
      points[1].y,
      points[2].x,
      points[2].y,
      points[3].x,
      points[3].y,
    ]);

    // 3. Define os 4 pontos de destino (um retângulo perfeito)
    // Calculamos as dimensões do retângulo de saída com base na largura
    // e altura máximas do quadrilátero selecionado.

    // Larguras (topo, base) e Alturas (esquerda, direita)
    let w1 = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    let w2 = Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y);
    let h1 = Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y);
    let h2 = Math.hypot(points[1].x - points[2].x, points[1].y - points[2].y);

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
    downloadButton.href = resultCanvas.toDataURL("image/png");

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
