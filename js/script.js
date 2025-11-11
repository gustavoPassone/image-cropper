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
const rotateButton = document.getElementById("rotate-button"); // Novo botão de rotação

const resultCanvas = document.getElementById("result-canvas");
const downloadButton = document.getElementById("download-button");
const startOverButton = document.getElementById("start-over-button");

// --- Variáveis de Estado ---
let originalImage; // O objeto Image() original
let originalFileName = ""; // Armazena o nome do arquivo original
let displayedImageWidth; // Largura da imagem como ela é desenhada no canvas
let displayedImageHeight; // Altura da imagem como ela é desenhada no canvas
let points = []; // Array de 4 objetos {x, y}
let draggingPoint = null; // Índice do ponto sendo arrastado (0-3)
let rotationAngle = 0; // Novo estado: Ângulo de rotação em graus (0, 90, 180, 270)
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

  originalFileName = file.name; // Salva o nome original
  originalImage = new Image();
  originalImage.src = URL.createObjectURL(file);
  originalImage.onload = () => {
    // Reinicia a rotação ao carregar nova imagem
    rotationAngle = 0;

    // 1. Torna a tela de edição visível
    uploadStep.classList.add("hidden");
    resultStep.classList.add("hidden");
    editStep.classList.remove("hidden");

    // 2. Inicializa o canvas e desenha a imagem
    initializeCanvas();
  };
  originalImage.onerror = () => {
    alert("Não foi possível carregar a imagem.");
  };
}

// --- 3. Lógica de Edição (Canvas) ---

function getRotatedDimensions() {
  // Retorna as dimensões da imagem como se ela estivesse fisicamente girada
  const isRotated90or270 = rotationAngle % 180 !== 0;
  if (isRotated90or270) {
    return { width: originalImage.height, height: originalImage.width };
  }
  return { width: originalImage.width, height: originalImage.height };
}

function initializeCanvas() {
  if (!originalImage) return;

  const maxWidth = canvasWrapper.clientWidth * 0.9;
  const maxHeight = window.innerHeight * 0.7;

  // Usa as dimensões rotacionadas para o cálculo de escala
  const rotatedDims = getRotatedDimensions();
  let originalRotatedWidth = rotatedDims.width;
  let originalRotatedHeight = rotatedDims.height;

  let scaleFactor = 1;

  // Calcula o fator de escala para que a imagem caiba completamente na tela
  if (originalRotatedWidth > maxWidth || originalRotatedHeight > maxHeight) {
    scaleFactor = Math.min(
      maxWidth / originalRotatedWidth,
      maxHeight / originalRotatedHeight
    );
  }

  displayedImageWidth = originalRotatedWidth * scaleFactor;
  displayedImageHeight = originalRotatedHeight * scaleFactor;

  editCanvas.width = displayedImageWidth;
  editCanvas.height = displayedImageHeight;

  // Inicializa os 4 pontos nos cantos da *imagem redimensionada*
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

  // 1. Prepara a matriz de transformação do canvas para rotação
  editCtx.save();

  // Move o centro de rotação para o centro do canvas
  editCtx.translate(editCanvas.width / 2, editCanvas.height / 2);
  editCtx.rotate((rotationAngle * Math.PI) / 180);

  // 2. Desenha a imagem original (redimensionada) no centro do canvas girado
  // A imagem deve ser desenhada no centro do canvas *após* a rotação
  const isRotated90or270 = rotationAngle % 180 !== 0;
  let imageWidth = isRotated90or270
    ? displayedImageHeight
    : displayedImageWidth;
  let imageHeight = isRotated90or270
    ? displayedImageWidth
    : displayedImageHeight;

  // O drawImage sempre usa as dimensões originais (não giradas) da imagem
  editCtx.drawImage(
    originalImage,
    -imageWidth / 2, // Deslocamento para centralizar a imagem no eixo X
    -imageHeight / 2, // Deslocamento para centralizar a imagem no eixo Y
    imageWidth,
    imageHeight
  );

  // Reverte a matriz de transformação para desenhar os pontos corretamente
  editCtx.restore();

  // 3. Desenha as linhas de conexão (SEM ROTAÇÃO)
  editCtx.strokeStyle = POINT_STROKE_COLOR;
  editCtx.lineWidth = LINE_WIDTH;
  editCtx.beginPath();
  editCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    editCtx.lineTo(points[i].x, points[i].y);
  }
  editCtx.closePath();
  editCtx.stroke();

  // 4. Desenha os pontos (círculos transparentes com borda)
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
  // Permite que o arrastar funcione mesmo com a imagem girada
  if (rotationAngle !== 0) {
    // Redesenha para limpar a borda vermelha se o clique não for em um ponto
    if (draggingPoint === null) drawCanvas();
  }

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

// --- Função de Rotação (Novo) ---
function rotateImage() {
  if (!originalImage) return;

  // Incrementa 90 graus (sentido horário)
  rotationAngle = (rotationAngle + 90) % 360;

  // Re-inicializa o canvas, pois a rotação pode mudar as dimensões de exibição
  initializeCanvas();
}

// --- 4. Processamento com OpenCV.js ---

function performWarp() {
  try {
    // Dimensões originais da imagem (sem rotação)
    const origW = originalImage.width;
    const origH = originalImage.height;

    // Fator de escala para reverter dos pixels do Canvas para os pixels Originais
    const rotatedDims = getRotatedDimensions();
    const originalRotatedWidth = rotatedDims.width;
    const originalRotatedHeight = rotatedDims.height;

    const originalToDisplayedScaleX =
      originalRotatedWidth / displayedImageWidth;
    const originalToDisplayedScaleY =
      originalRotatedHeight / displayedImageHeight;

    // 1. Mapeia os pontos do Canvas para a Imagem *Original e Rotacionada*
    const pointsOnRotatedOriginal = points.map((p) => ({
      x: p.x * originalToDisplayedScaleX,
      y: p.y * originalToDisplayedScaleY,
    }));

    // 2. Transforma as coordenadas dos pontos para a Imagem *Original (0 graus)*
    const angle = rotationAngle; // 0, 90, 180, 270
    let finalPointsOriginalScale = [];

    pointsOnRotatedOriginal.forEach((p) => {
      let x, y;
      const halfW = origW / 2;
      const halfH = origH / 2;

      // Rotaciona em torno do centro da imagem original (origW, origH)
      // Ponto (x', y') na imagem girada
      // Ponto (x, y) na imagem original

      switch (angle) {
        case 0: // 0°: Sem rotação
          x = p.x;
          y = p.y;
          break;
        case 90: // 90°: (x', y') -> (origW - y', x')
          x = p.y;
          y = origW - p.x;
          break;
        case 180: // 180°: (x', y') -> (origW - x', origH - y')
          x = origW - p.x;
          y = origH - p.y;
          break;
        case 270: // 270°: (x', y') -> (y', origH - x')
          x = origH - p.y;
          y = p.x;
          break;
        default:
          x = p.x;
          y = p.y;
      }

      // Mapeamento correto (sem precisar de matriz de rotação complexa):
      if (angle === 90) {
        // (x', y') na imagem girada 90 é (y', origH - x') na imagem original
        // ESTA É A LÓGICA CORRETA PARA 90° (Antes, era a de 270°)
        x = p.y;
        y = origH - p.x;
      } else if (angle === 180) {
        // (x', y') na imagem girada 180 é (origW - x, origH - y) na imagem original
        x = origW - p.x;
        y = origH - p.y;
      } else if (angle === 270) {
        // (x', y') na imagem girada 270 é (origW - y', x') na imagem original
        // ESTA É A LÓGICA CORRETA PARA 270° (Antes, era a de 90°)
        x = origW - p.y;
        y = p.x;
      } else {
        // 0 ou 360
        x = p.x;
        y = p.y;
      }

      finalPointsOriginalScale.push(x, y);
    });

    // 3. Carrega a imagem original no OpenCV (sem redimensionamento)
    let src = cv.imread(originalImage);

    // 4. Define os 4 pontos de origem (do usuário) na escala original da imagem
    let srcPoints = cv.matFromArray(
      4,
      1,
      cv.CV_32FC2,
      finalPointsOriginalScale
    );

    // 5. Define os 4 pontos de destino (um retângulo perfeito)
    // Usamos os pontos já transformados para calcular as dimensões do retângulo

    let p0_orig = {
      x: finalPointsOriginalScale[0],
      y: finalPointsOriginalScale[1],
    };
    let p1_orig = {
      x: finalPointsOriginalScale[2],
      y: finalPointsOriginalScale[3],
    };
    let p2_orig = {
      x: finalPointsOriginalScale[4],
      y: finalPointsOriginalScale[5],
    };
    let p3_orig = {
      x: finalPointsOriginalScale[6],
      y: finalPointsOriginalScale[7],
    };

    // Larguras (topo, base) e Alturas (esquerda, direita) na escala ORIGINAL
    let w1 = Math.hypot(p0_orig.x - p1_orig.x, p0_orig.y - p1_orig.y);
    let w2 = Math.hypot(p3_orig.x - p2_orig.x, p3_orig.y - p2_orig.y);
    let h1 = Math.hypot(p0_orig.x - p3_orig.x, p0_orig.y - p3_orig.y);
    let h2 = Math.hypot(p1_orig.x - p2_orig.x, p1_orig.y - p2_orig.y);

    let outWidth = Math.round(Math.max(w1, w2));
    let outHeight = Math.round(Math.max(h1, h2));

    // Mapeamento final dos pontos de destino para o retângulo perfeito
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

    // 6. Calcula a Matriz de Transformação de Perspectiva
    let M = cv.getPerspectiveTransform(srcPoints, dstPoints);

    // 7. Aplica a transformação (warp)
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

    // 8. Exibe a imagem resultante no canvas de resultado
    cv.imshow(resultCanvas, dst);

    // 9. Configura o link de download
    const newFileName =
      originalFileName.split(".").slice(0, -1).join(".") + ".png";
    downloadButton.href = resultCanvas.toDataURL("image/png");
    downloadButton.download = newFileName; // Define o nome do arquivo

    // 10. Limpa a memória (MUITO IMPORTANTE no OpenCV.js)
    src.delete();
    dst.delete();
    M.delete();
    srcPoints.delete();
    dstPoints.delete();

    // 11. Troca para a tela de resultado
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
rotateButton.addEventListener("click", rotateImage); // Ativa a rotação

// Botões de Resultado
startOverButton.addEventListener("click", () => {
  // Reseta tudo para a tela inicial
  fileInput.value = null; // Limpa o input de arquivo
  originalImage = null;
  originalFileName = "";
  points = [];
  draggingPoint = null;
  rotationAngle = 0; // Zera o ângulo de rotação

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
