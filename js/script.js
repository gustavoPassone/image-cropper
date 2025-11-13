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

// Nova Etapa: PDF Preview
const pdfPreviewStep = document.getElementById("pdf-preview-step");
const pdfThumbnailsContainer = document.getElementById("pdf-thumbnails");
const cancelPdfPreviewButton = document.getElementById("cancel-pdf-preview");

const resultCanvas = document.getElementById("result-canvas");
const resultTitle = document.getElementById("result-title"); // Título do resultado
const startOverButton = document.getElementById("start-over-button");
const editAnotherPageButton = document.getElementById(
  "edit-another-page-button"
);

// NOVAS Referências para Opções de Exportação
const exportFilenameInput = document.getElementById("export-filename-input");
const exportFormatSelect = document.getElementById("export-format-select");
const exportButton = document.getElementById("export-button");

const modalOverlay = document.getElementById("modal-overlay");
const modalBtnYes = document.getElementById("modal-btn-yes");
const modalBtnNo = document.getElementById("modal-btn-no");

// --- Variáveis de Estado ---
let originalImage; // O objeto Image() (renderizado do PDF ou da Imagem)
let originalFileName = "";
let originalFileType = "image/png"; // 'image/png' ou 'application/pdf'
let displayedImageWidth;
let displayedImageHeight;
let points = [];
let draggingPoint = null;
let rotationAngle = 0;
let canvasScale = 1;

// Novas variáveis de estado para PDF
let loadedPdf = null;
let totalPdfPages = 0;
let currentEditingPageNum = 1;

// ... Constantes de desenho (POINT_RADIUS, etc.) ...
const POINT_RADIUS = 25;
const CLICK_RADIUS = 40;
const LINE_WIDTH = 3;
const POINT_FILL_COLOR = "rgba(128, 128, 128, 0.4)";
const POINT_STROKE_COLOR = "rgba(0, 150, 255, 0.9)";
const DRAGGING_STROKE_COLOR = "rgba(255, 0, 0, 0.9)";

// --- 1. Inicialização do OpenCV ---

// Flag para evitar que a função seja chamada múltiplas vezes
let isCvReady = false;

/**
 * Função de callback executada quando a biblioteca OpenCV.js está carregada e pronta.
 * É chamada por `Module.onRuntimeInitialized` (definido em index.html).
 * Atualiza a interface do usuário para permitir o upload de arquivos.
 */
function onOpenCvReady() {
  if (isCvReady) return;
  isCvReady = true;

  // A biblioteca está pronta. Habilita a UI de upload.
  console.log("OpenCV.js está pronto.");
  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.remove("text-gray-700");
  opencvStatus.classList.add("text-green-600");
  uploadInstructions.classList.remove("hidden");
  uploadButtons.classList.remove("hidden");

  setupUploadListeners();
}

// A inicialização do OpenCV é tratada pelo objeto `Module` em index.html,
// que chama `onOpenCvReady` quando a biblioteca está pronta.

// Checa se o OpenCV já carregou e inicializou, para o caso de ter acontecido
// antes deste script ser executado (condição de corrida).
if (typeof cv !== "undefined") {
  onOpenCvReady();
} else {
  // Adiciona um listener de erro para o caso de falha de rede ao carregar o OpenCV
  const opencvScript = document.getElementById("opencv-script");
  if (opencvScript) {
    opencvScript.addEventListener("error", () => {
      opencvStatus.textContent = "Falha ao carregar a biblioteca OpenCV.";
      opencvStatus.classList.remove("text-gray-700");
      opencvStatus.classList.add("text-red-600");
    });
  }
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
  loadedPdf = null; // Reseta o PDF carregado
  totalPdfPages = 0;
  currentEditingPageNum = 1;

  if (fileType.startsWith("image/")) {
    originalImage = new Image();
    originalImage.src = URL.createObjectURL(file);
    originalImage.onload = () => {
      showEditScreen();
    };
    originalImage.onerror = () => {
      alert("Não foi possível carregar a imagem.");
    };
  } else if (fileType === "application/pdf") {
    opencvStatus.textContent = "Renderizando PDF..."; // Feedback
    uploadStep.classList.remove("hidden"); // Mostra o status
    editStep.classList.add("hidden");
    pdfPreviewStep.classList.add("hidden");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

        loadedPdf = pdfDoc; // Armazena o documento PDF
        totalPdfPages = pdfDoc.numPages;

        if (totalPdfPages === 1) {
          await loadPageIntoEditor(1);
        } else {
          opencvStatus.textContent = "Carregando miniaturas...";
          await renderPdfThumbnails();
          uploadStep.classList.add("hidden");
          pdfPreviewStep.classList.remove("hidden");
          opencvStatus.textContent = "Bibliotecas carregadas!"; // Reseta o status
        }
      } catch (error) {
        console.error("Erro ao carregar PDF:", error);
        alert("Não foi possível carregar o arquivo PDF.");
        resetToUploadScreen();
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

// NOVO: Renderiza a página do PDF no editor
async function loadPageIntoEditor(pageNum) {
  if (!loadedPdf) return;

  currentEditingPageNum = pageNum;

  try {
    const page = await loadedPdf.getPage(pageNum);
    const scale = 2.0; // Renderiza em alta resolução
    const viewport = page.getViewport({ scale });

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;

    await page.render({ canvasContext: tempCtx, viewport }).promise;

    originalImage = new Image();
    originalImage.src = tempCanvas.toDataURL("image/png");
    originalImage.onload = () => {
      showEditScreen();
    };
    originalImage.onerror = () => {
      alert("Não foi possível carregar a imagem do PDF.");
    };
  } catch (error) {
    console.error(`Erro ao carregar página ${pageNum}:`, error);
    alert(`Não foi possível carregar a página ${pageNum}.`);
    resetToUploadScreen();
  }
}

// NOVO: Renderiza as miniaturas de todas as páginas
async function renderPdfThumbnails() {
  if (!loadedPdf) return;
  pdfThumbnailsContainer.innerHTML = ""; // Limpa miniaturas antigas

  for (let i = 1; i <= totalPdfPages; i++) {
    const pageNum = i;

    const wrapper = document.createElement("div");
    wrapper.className = "thumbnail-item";

    const canvas = document.createElement("canvas");
    const p = document.createElement("p");
    p.textContent = `Página ${pageNum}`;

    wrapper.addEventListener("click", () => {
      pdfPreviewStep.classList.add("hidden");
      opencvStatus.textContent = `Carregando página ${pageNum}...`;
      uploadStep.classList.remove("hidden");
      loadPageIntoEditor(pageNum);
    });

    try {
      const page = await loadedPdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.3 }); // Escala pequena para miniatura
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      wrapper.appendChild(canvas);
      wrapper.appendChild(p);
      pdfThumbnailsContainer.appendChild(wrapper);
    } catch (error) {
      console.error(`Erro ao renderizar miniatura ${pageNum}:`, error);
      p.textContent = `Erro Pág. ${pageNum}`;
      wrapper.appendChild(p);
      pdfThumbnailsContainer.appendChild(wrapper);
    }
  }
}

function showEditScreen() {
  uploadStep.classList.add("hidden");
  resultStep.classList.add("hidden");
  editStep.classList.remove("hidden");
  initializeCanvas();
}

// --- 3. Lógica de Edição (Canvas) ---

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

  let autoPoints = findDocumentCorners(originalImage);

  if (autoPoints && autoPoints.length === 4) {
    console.log("Detecção automática de cantos BEM SUCEDIDA.");
    points = [
      { x: autoPoints[0].x * scaleFactor, y: autoPoints[0].y * scaleFactor }, // tl
      { x: autoPoints[1].x * scaleFactor, y: autoPoints[1].y * scaleFactor }, // tr
      { x: autoPoints[2].x * scaleFactor, y: autoPoints[2].y * scaleFactor }, // br
      { x: autoPoints[3].x * scaleFactor, y: autoPoints[3].y * scaleFactor }, // bl
    ];

    if (
      points[2].x > displayedImageWidth ||
      points[2].y > displayedImageHeight ||
      points[0].x < 0
    ) {
      console.warn(
        "Pontos automáticos parecem inválidos, revertendo para manual."
      );
      autoPoints = null;
    }
  }

  if (!autoPoints || autoPoints.length !== 4) {
    console.log(
      "Detecção automática FALHOU ou foi invalidada. Usando margem manual."
    );
    const margin = Math.min(displayedImageWidth, displayedImageHeight) * 0.1;

    points = [
      { x: margin, y: margin },
      { x: displayedImageWidth - margin, y: margin },
      { x: displayedImageWidth - margin, y: displayedImageHeight - margin },
      { x: margin, y: displayedImageHeight - margin },
    ];
  }

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

function findDocumentCorners(imageElement) {
  let src;
  let gray;
  let blurred;
  let edged;
  let contours;
  let hierarchy;
  let bestApprox;

  try {
    src = cv.imread(imageElement);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    edged = new cv.Mat();
    cv.Canny(blurred, edged, 75, 200);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(
      edged,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    let maxArea = 0;
    bestApprox = null;

    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt);

      if (area > (src.rows * src.cols) / 20) {
        let peri = cv.arcLength(cnt, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4 && area > maxArea) {
          maxArea = area;
          if (bestApprox) {
            bestApprox.delete();
          }
          bestApprox = approx;
        } else {
          approx.delete();
        }
      }
      cnt.delete();
    }

    if (bestApprox) {
      let pts = [
        { x: bestApprox.data32S[0], y: bestApprox.data32S[1] },
        { x: bestApprox.data32S[2], y: bestApprox.data32S[3] },
        { x: bestApprox.data32S[4], y: bestApprox.data32S[5] },
        { x: bestApprox.data32S[6], y: bestApprox.data32S[7] },
      ];

      pts.sort((a, b) => a.y - b.y);
      let top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
      let bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);

      let orderedPoints = [top[0], top[1], bottom[1], bottom[0]];

      bestApprox.delete();
      return orderedPoints;
    }

    return null;
  } catch (error) {
    console.error("Auto-crop falhou:", error);
    return null;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (edged) edged.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
    if (bestApprox && !bestApprox.isDeleted()) bestApprox.delete();
  }
}

// --- 4. Processamento com OpenCV.js e Lógica de Exportação ---

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

    // --- NOVO: Preenche as opções de exportação ---
    const newFileNameBase = originalFileName.split(".").slice(0, -1).join(".");

    if (originalFileType === "application/pdf") {
      exportFilenameInput.value = `${newFileNameBase}-pagina-${currentEditingPageNum}-corrigido`;
      exportFormatSelect.value = "pdf";
      resultTitle.textContent = `Resultado Corrigido (Página ${currentEditingPageNum})`;
    } else {
      exportFilenameInput.value = `${newFileNameBase}-corrigido`;
      exportFormatSelect.value = "png";
      resultTitle.textContent = `Resultado Corrigido`;
    }

    // Limpa a memória
    src.delete();
    dst.delete();
    M.delete();
    srcPoints.delete();
    dstPoints.delete();

    if (loadedPdf && totalPdfPages > 1) {
      editAnotherPageButton.classList.remove("hidden");
    } else {
      editAnotherPageButton.classList.add("hidden");
    }

    editStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro no processamento do OpenCV:", error);
    alert("Ocorreu um erro ao processar a imagem. Tente novamente.");
  }
}

function handleExport() {
  const format = exportFormatSelect.value;
  const filename = exportFilenameInput.value.trim();

  if (!filename) {
    alert("Por favor, insira um nome para o arquivo.");
    exportFilenameInput.focus();
    return;
  }

  if (format === "pdf") {
    try {
      const imgData = resultCanvas.toDataURL("image/png");
      const w = resultCanvas.width;
      const h = resultCanvas.height;
      const orientation = w > h ? "l" : "p";

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });

      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`${filename}.pdf`);
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Não foi possível gerar o PDF.");
    }
  } else {
    // PNG
    const link = document.createElement("a");
    link.href = resultCanvas.toDataURL("image/png");
    link.download = `${filename}.png`;
    link.click();
    setTimeout(() => link.remove(), 100);
  }
}

// --- 5. Lógica dos Botões de Ação ---

function resetToUploadScreen() {
  fileInput.value = null;
  originalImage = null;
  originalFileName = "";
  originalFileType = "image/png";
  points = [];
  draggingPoint = null;
  rotationAngle = 0;

  loadedPdf = null;
  totalPdfPages = 0;
  currentEditingPageNum = 1;

  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);

  resultStep.classList.add("hidden");
  editStep.classList.add("hidden");
  pdfPreviewStep.classList.add("hidden");
  uploadStep.classList.remove("hidden");

  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.add("text-green-600");
}

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
exportButton.addEventListener("click", handleExport); // NOVO Listener para exportar

cancelPdfPreviewButton.addEventListener("click", resetToUploadScreen);
editAnotherPageButton.addEventListener("click", () => {
  resultStep.classList.add("hidden");
  pdfPreviewStep.classList.remove("hidden");
});

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
