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
const rotateButton = document.getElementById("rotate-button");
const cancelButton = document.getElementById("cancel-button");

const resultCanvas = document.getElementById("result-canvas");
let downloadButton = document.getElementById("download-button"); // Use 'let' para reatribuir
const startOverButton = document.getElementById("start-over-button");

const modalOverlay = document.getElementById("modal-overlay");
const modalBtnYes = document.getElementById("modal-btn-yes");
const modalBtnNo = document.getElementById("modal-btn-no");

// --- Variáveis de Estado ---
let originalImage; // O objeto Image() (renderizado do PDF ou da Imagem)
let originalFileName = "";
let originalFileType = "image/png"; // NOVO: 'image/png' ou 'application/pdf'
let displayedImageWidth;
let displayedImageHeight;
let points = [];
let draggingPoint = null;
let rotationAngle = 0;
let canvasScale = 1;

// ... Constantes de desenho (POINT_RADIUS, etc.) ...
const POINT_RADIUS = 25;
const CLICK_RADIUS = 40;
const LINE_WIDTH = 3;
const POINT_FILL_COLOR = "rgba(128, 128, 128, 0.4)";
const POINT_STROKE_COLOR = "rgba(0, 150, 255, 0.9)";
const DRAGGING_STROKE_COLOR = "rgba(255, 0, 0, 0.9)";

// --- 1. Inicialização do OpenCV ---

function onOpenCvReady() {
  // A biblioteca está pronta. Habilita a UI de upload.
  console.log("OpenCV.js está pronto.");
  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.remove("text-gray-700");
  opencvStatus.classList.add("text-green-600");
  uploadInstructions.classList.remove("hidden");
  uploadButtons.classList.remove("hidden");

  setupUploadListeners();
}

// --- 2. Lógica de Upload (Atualizada para PDF) ---

function setupUploadListeners() {
  selectButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

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
      handleFile(e.dataTransfer.files[0]);
    }
  });
}

// Função unificada para lidar com Imagem ou PDF
function handleFile(file) {
  const fileType = file.type;

  if (!fileType.startsWith("image/") && fileType !== "application/pdf") {
    alert("Por favor, selecione um arquivo de imagem (PNG, JPG) ou PDF.");
    return;
  }

  originalFileName = file.name;
  originalFileType = file.type; // Armazena o tipo de arquivo
  rotationAngle = 0;

  if (fileType.startsWith("image/")) {
    // --- Caminho 1: É uma IMAGEM (comportamento antigo) ---
    originalImage = new Image();
    originalImage.src = URL.createObjectURL(file);
    originalImage.onload = () => {
      showEditScreen();
    };
    originalImage.onerror = () => {
      alert("Não foi possível carregar a imagem.");
    };
  } else if (fileType === "application/pdf") {
    // --- Caminho 2: É um PDF (NOVO) ---
    opencvStatus.textContent = "Renderizando PDF..."; // Feedback
    uploadStep.classList.remove("hidden"); // Mostra o status
    editStep.classList.add("hidden");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1); // Pega a primeira página

        const scale = 2.0; // Renderiza em alta resolução
        const viewport = page.getViewport({ scale });

        // Cria um canvas temporário para renderizar o PDF
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({ canvasContext: tempCtx, viewport }).promise;

        // Converte o canvas do PDF em um objeto Image
        originalImage = new Image();
        originalImage.src = tempCanvas.toDataURL("image/png");
        originalImage.onload = () => {
          showEditScreen(); // Agora mostra a tela de edição
        };
        originalImage.onerror = () => {
          alert("Não foi possível carregar a imagem do PDF.");
        };
      } catch (error) {
        console.error("Erro ao renderizar PDF:", error);
        alert("Não foi possível carregar o arquivo PDF.");
        resetToUploadScreen();
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

// Função auxiliar para mostrar a tela de edição
function showEditScreen() {
  uploadStep.classList.add("hidden");
  resultStep.classList.add("hidden");
  editStep.classList.remove("hidden");
  initializeCanvas();
}

// --- 3. Lógica de Edição (Canvas) ---
// (Nenhuma mudança necessária aqui, `initializeCanvas` e `drawCanvas`
//  funcionam com o `originalImage` independentemente da origem)

function getRotatedDimensions() {
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

  const rotatedDims = getRotatedDimensions();
  let originalRotatedWidth = rotatedDims.width;
  let originalRotatedHeight = rotatedDims.height;

  let scaleFactor = 1;

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

  const margin = Math.min(displayedImageWidth, displayedImageHeight) * 0.1;

  points = [
    { x: margin, y: margin },
    { x: displayedImageWidth - margin, y: margin },
    { x: displayedImageWidth - margin, y: displayedImageHeight - margin },
    { x: margin, y: displayedImageHeight - margin },
  ];

  drawCanvas();
}

function drawCanvas() {
  if (!originalImage) return;
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  editCtx.save();
  editCtx.translate(editCanvas.width / 2, editCanvas.height / 2);
  editCtx.rotate((rotationAngle * Math.PI) / 180);

  const isRotated90or270 = rotationAngle % 180 !== 0;
  let imageWidth = isRotated90or270
    ? displayedImageHeight
    : displayedImageWidth;
  let imageHeight = isRotated90or270
    ? displayedImageWidth
    : displayedImageHeight;

  editCtx.drawImage(
    originalImage,
    -imageWidth / 2,
    -imageHeight / 2,
    imageWidth,
    imageHeight
  );

  editCtx.restore();

  editCtx.strokeStyle = POINT_STROKE_COLOR;
  editCtx.lineWidth = LINE_WIDTH;
  editCtx.beginPath();
  editCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    editCtx.lineTo(points[i].x, points[i].y);
  }
  editCtx.closePath();
  editCtx.stroke();

  points.forEach((p, index) => {
    editCtx.fillStyle = POINT_FILL_COLOR;
    editCtx.strokeStyle =
      index === draggingPoint ? DRAGGING_STROKE_COLOR : POINT_STROKE_COLOR;
    editCtx.lineWidth = LINE_WIDTH;
    editCtx.beginPath();
    editCtx.arc(p.x, p.y, POINT_RADIUS, 0, 2 * Math.PI);
    editCtx.fill();
    editCtx.stroke();
  });
}

// --- Lógica de Arrastar Pontos ---

function getCanvasPos(e) {
  const rect = editCanvas.getBoundingClientRect();
  canvasScale = editCanvas.width / rect.width;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * canvasScale,
    y: (clientY - rect.top) * canvasScale,
  };
}

function findPoint(x, y) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < CLICK_RADIUS) {
      return i;
    }
  }
  return null;
}

function onDown(e) {
  if (rotationAngle !== 0) {
    if (draggingPoint === null) drawCanvas();
  }
  e.preventDefault();
  const pos = getCanvasPos(e);
  draggingPoint = findPoint(pos.x, pos.y);
  if (draggingPoint !== null) {
    drawCanvas();
  }
}

function onMove(e) {
  if (draggingPoint === null) return;
  e.preventDefault();
  const pos = getCanvasPos(e);
  points[draggingPoint].x = Math.max(0, Math.min(displayedImageWidth, pos.x));
  points[draggingPoint].y = Math.max(0, Math.min(displayedImageHeight, pos.y));
  drawCanvas();
}

function onUp(e) {
  if (draggingPoint !== null) {
    draggingPoint = null;
    drawCanvas();
  }
}

function rotateImage() {
  if (!originalImage) return;
  rotationAngle = (rotationAngle + 90) % 360;
  initializeCanvas();
}

// --- 4. Processamento com OpenCV.js (Atualizado para salvar PDF) ---

function performWarp() {
  try {
    const origW = originalImage.width;
    const origH = originalImage.height;

    const rotatedDims = getRotatedDimensions();
    const originalRotatedWidth = rotatedDims.width;
    const originalRotatedHeight = rotatedDims.height;

    const originalToDisplayedScaleX =
      originalRotatedWidth / displayedImageWidth;
    const originalToDisplayedScaleY =
      originalRotatedHeight / displayedImageHeight;

    const pointsOnRotatedOriginal = points.map((p) => ({
      x: p.x * originalToDisplayedScaleX,
      y: p.y * originalToDisplayedScaleY,
    }));

    const angle = rotationAngle;
    let finalPointsOriginalScale = [];

    pointsOnRotatedOriginal.forEach((p) => {
      let x, y;
      if (angle === 90) {
        x = p.y;
        y = origH - p.x;
      } else if (angle === 180) {
        x = origW - p.x;
        y = origH - p.y;
      } else if (angle === 270) {
        x = origW - p.y;
        y = p.x;
      } else {
        x = p.x;
        y = p.y;
      }
      finalPointsOriginalScale.push(x, y);
    });

    let src = cv.imread(originalImage);
    let srcPoints = cv.matFromArray(
      4,
      1,
      cv.CV_32FC2,
      finalPointsOriginalScale
    );

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

    let w1 = Math.hypot(p0_orig.x - p1_orig.x, p0_orig.y - p1_orig.y);
    let w2 = Math.hypot(p3_orig.x - p2_orig.x, p3_orig.y - p2_orig.y);
    let h1 = Math.hypot(p0_orig.x - p3_orig.x, p0_orig.y - p3_orig.y);
    let h2 = Math.hypot(p1_orig.x - p2_orig.x, p1_orig.y - p2_orig.y);

    let outWidth = Math.round(Math.max(w1, w2));
    let outHeight = Math.round(Math.max(h1, h2));

    let dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      outWidth - 1,
      0,
      outWidth - 1,
      outHeight - 1,
      0,
      outHeight - 1,
    ]);

    let M = cv.getPerspectiveTransform(srcPoints, dstPoints);
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
    cv.imshow(resultCanvas, dst);

    // --- NOVO: Lógica de Download Condicional ---

    const newFileNameBase = originalFileName.split(".").slice(0, -1).join(".");

    // Limpa listeners antigos clonando
    const newDownloadButton = downloadButton.cloneNode(true);
    downloadButton.parentNode.replaceChild(newDownloadButton, downloadButton);
    downloadButton = newDownloadButton; // Atualiza a referência

    if (originalFileType === "application/pdf") {
      // Salvar como PDF
      downloadButton.textContent = "Baixar PDF";
      downloadButton.addEventListener("click", () => {
        try {
          const imgData = resultCanvas.toDataURL("image/png");
          const w = resultCanvas.width;
          const h = resultCanvas.height;
          const orientation = w > h ? "l" : "p";

          // Instancia o jsPDF (note o window.jspdf)
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });

          pdf.addImage(imgData, "PNG", 0, 0, w, h);
          pdf.save(newFileNameBase + ".pdf");
        } catch (e) {
          console.error("Erro ao gerar PDF:", e);
          alert("Não foi possível gerar o PDF.");
        }
      });
    } else {
      // Salvar como PNG (comportamento original)
      downloadButton.textContent = "Baixar Imagem (PNG)";
      downloadButton.addEventListener("click", () => {
        const link = document.createElement("a");
        link.href = resultCanvas.toDataURL("image/png");
        link.download = newFileNameBase + ".png";
        link.click();
        // Limpa o link após o clique
        setTimeout(() => link.remove(), 100);
      });
    }

    // Limpa a memória
    src.delete();
    dst.delete();
    M.delete();
    srcPoints.delete();
    dstPoints.delete();

    // Troca para a tela de resultado
    editStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro no processamento do OpenCV:", error);
    alert("Ocorreu um erro ao processar a imagem. Tente novamente.");
  }
}

// --- 5. Lógica dos Botões de Ação ---

function resetToUploadScreen() {
  fileInput.value = null;
  originalImage = null;
  originalFileName = "";
  originalFileType = "image/png"; // Reseta o tipo de arquivo
  points = [];
  draggingPoint = null;
  rotationAngle = 0;

  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);

  resultStep.classList.add("hidden");
  editStep.classList.add("hidden");
  uploadStep.classList.remove("hidden");

  // Reseta o status do upload
  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.add("text-green-600");
}

// --- Lógica do Modal ---
function handleModalKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    modalBtnYes.click();
  } else if (e.key === "Escape") {
    e.preventDefault();
    modalBtnNo.click();
  }
}

function showModal() {
  modalOverlay.classList.remove("hidden");
  window.addEventListener("keydown", handleModalKeydown);
  modalBtnYes.focus();
}

function hideModal() {
  modalOverlay.classList.add("hidden");
  window.removeEventListener("keydown", handleModalKeydown);
}

modalBtnYes.addEventListener("click", () => {
  hideModal();
  resetToUploadScreen();
});
modalBtnNo.addEventListener("click", hideModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    hideModal();
  }
});

// --- Listeners Principais ---
resetButton.addEventListener("click", initializeCanvas);
cropButton.addEventListener("click", performWarp);
rotateButton.addEventListener("click", rotateImage);
cancelButton.addEventListener("click", showModal);
startOverButton.addEventListener("click", resetToUploadScreen);

editCanvas.addEventListener("mousedown", onDown);
editCanvas.addEventListener("mousemove", onMove);
editCanvas.addEventListener("mouseup", onUp);
editCanvas.addEventListener("mouseout", onUp);
editCanvas.addEventListener("touchstart", onDown);
editCanvas.addEventListener("touchmove", onMove);
editCanvas.addEventListener("touchend", onUp);
editCanvas.addEventListener("touchcancel", onUp);

window.addEventListener("resize", () => {
  if (originalImage && !editStep.classList.contains("hidden")) {
    initializeCanvas();
  }
});
