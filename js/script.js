// --- Referências do DOM ---
const mainContainer = document.getElementById("main-container");
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
const finishAndDownloadButton = document.getElementById(
  "finish-and-download-button"
);

const resultCanvas = document.getElementById("result-canvas");
const resultTitle = document.getElementById("result-title"); // Título do resultado
const startOverButton = document.getElementById("start-over-button");
const editAnotherPageButton = document.getElementById(
  "edit-another-page-button"
);

// NOVAS Referências para Opções de Exportação
const exportOptions = document.getElementById("export-options");
const exportFilenameInput = document.getElementById("export-filename-input");
const exportFormatSelect = document.getElementById("export-format-select");
const exportButton = document.getElementById("export-button");

// NOVAS Referências para Filtros de Pós-Processamento
const postProcessingToolbar = document.getElementById(
  "post-processing-toolbar"
);
const filterNoneButton = document.getElementById("filter-none-button");
const filterBwButton = document.getElementById("filter-bw-button");
const filterContrastButton = document.getElementById("filter-contrast-button");
const filterSharpenButton = document.getElementById("filter-sharpen-button");
const filterRotateButton = document.getElementById("filter-rotate-button");
const sliderContainer = document.getElementById("slider-container");
const intensitySlider = document.getElementById("intensity-slider");
const sliderValue = document.getElementById("slider-value");

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
let editedPages = new Map(); // Armazena as páginas editadas (pageNum -> dataURL)

// Novas variáveis de estado para Pós-Processamento
let correctedImageMat = null; // cv.Mat com a imagem original corrigida
let currentFilter = "none"; // 'none', 'bw', 'contrast', 'sharpen'

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

function onOpenCvReady() {
  if (isCvReady) return;
  isCvReady = true;

  console.log("OpenCV.js está pronto.");
  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.remove("text-gray-700");
  opencvStatus.classList.add("text-green-600");
  uploadInstructions.classList.remove("hidden");
  uploadButtons.classList.remove("hidden");

  setupUploadListeners();
}

if (typeof cv !== "undefined") {
  onOpenCvReady();
} else {
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

function handleFile(file) {
  const fileType = file.type;

  if (!fileType.startsWith("image/") && fileType !== "application/pdf") {
    alert("Por favor, selecione um arquivo de imagem (PNG, JPG) ou PDF.");
    return;
  }
  resetToUploadScreen(); // Garante que o estado anterior seja limpo

  originalFileName = file.name;
  originalFileType = file.type;
  rotationAngle = 0;

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
    opencvStatus.textContent = "Renderizando PDF...";
    uploadStep.classList.remove("hidden");
    editStep.classList.add("hidden");
    pdfPreviewStep.classList.add("hidden");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

        loadedPdf = pdfDoc;
        totalPdfPages = pdfDoc.numPages;

        if (totalPdfPages === 1) {
          await loadPageIntoEditor(1);
        } else {
          finishAndDownloadButton.classList.remove("hidden");
          opencvStatus.textContent = "Carregando miniaturas...";
          await renderPdfThumbnails();
          uploadStep.classList.add("hidden");
          pdfPreviewStep.classList.remove("hidden");
          opencvStatus.textContent = "Bibliotecas carregadas!";
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

async function loadPageIntoEditor(pageNum) {
  if (!loadedPdf) return;

  currentEditingPageNum = pageNum;

  try {
    const page = await loadedPdf.getPage(pageNum);
    const scale = 2.0;
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

async function renderPdfThumbnails() {
  if (!loadedPdf) return;
  pdfThumbnailsContainer.innerHTML = "";

  for (let i = 1; i <= totalPdfPages; i++) {
    const pageNum = i;
    const wrapper = document.createElement("div");
    wrapper.className = "thumbnail-item";
    wrapper.id = `thumbnail-item-${pageNum}`;
    if (editedPages.has(pageNum)) {
      wrapper.classList.add("edited");
    }

    const canvas = document.createElement("canvas");
    const p = document.createElement("p");
    p.textContent = `Página ${pageNum}`;

    wrapper.addEventListener("click", () => {
      pdfPreviewStep.classList.add("hidden");
      opencvStatus.textContent = `Carregando página ${pageNum}...`;
      uploadStep.classList.remove("hidden");
      loadPageIntoEditor(pageNum);
    });

    wrapper.appendChild(canvas);
    wrapper.appendChild(p);
    pdfThumbnailsContainer.appendChild(wrapper);

    // Renderiza a thumbnail
    updateThumbnail(pageNum);
  }
}

async function updateThumbnail(pageNum, dataUrl = null) {
  const wrapper = document.getElementById(`thumbnail-item-${pageNum}`);
  if (!wrapper) return;
  const canvas = wrapper.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  const renderImage = (src) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const thumbWidth = 120;
      const scale = thumbWidth / img.width;
      canvas.width = thumbWidth;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
  };

  if (dataUrl || editedPages.has(pageNum)) {
    renderImage(dataUrl || editedPages.get(pageNum));
    wrapper.classList.add("edited");
  } else if (loadedPdf) {
    try {
      const page = await loadedPdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.3 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (error) {
      console.error(`Erro ao renderizar miniatura ${pageNum}:`, error);
      wrapper.querySelector("p").textContent = `Erro Pág. ${pageNum}`;
    }
  }
}

function showEditScreen() {
  uploadStep.classList.add("hidden");
  resultStep.classList.add("hidden");
  editStep.classList.remove("hidden");
  mainContainer.classList.remove("result-active"); // Garante que o layout largo não esteja ativo
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
  let scaleFactor = Math.min(
    1,
    maxWidth / originalRotatedWidth,
    maxHeight / originalRotatedHeight
  );

  displayedImageWidth = originalRotatedWidth * scaleFactor;
  displayedImageHeight = originalRotatedHeight * scaleFactor;
  editCanvas.width = displayedImageWidth;
  editCanvas.height = displayedImageHeight;

  let autoPoints = findDocumentCorners(originalImage);
  if (autoPoints && autoPoints.length === 4) {
    points = autoPoints.map((p) => ({
      x: p.x * scaleFactor,
      y: p.y * scaleFactor,
    }));
    if (
      points.some(
        (p) =>
          p.x > displayedImageWidth ||
          p.y > displayedImageHeight ||
          p.x < 0 ||
          p.y < 0
      )
    ) {
      autoPoints = null; // Invalida pontos fora da tela
    }
  }

  if (!autoPoints || autoPoints.length !== 4) {
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
    if (dist < CLICK_RADIUS) return i;
  }
  return null;
}

function onDown(e) {
  e.preventDefault();
  const pos = getCanvasPos(e);
  draggingPoint = findPoint(pos.x, pos.y);
  if (draggingPoint !== null) drawCanvas();
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
  // ... (código existente sem alterações)
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

// --- 4. Processamento, Salvamento e Exportação ---

// Função auxiliar para obter a matriz de transformação e o resultado do warp
function getWarpedResult() {
  const origW = originalImage.width,
    origH = originalImage.height;
  const rotatedDims = getRotatedDimensions();
  const originalRotatedWidth = rotatedDims.width,
    originalRotatedHeight = rotatedDims.height;
  const originalToDisplayedScaleX = originalRotatedWidth / displayedImageWidth;
  const originalToDisplayedScaleY =
    originalRotatedHeight / displayedImageHeight;
  const pointsOnRotatedOriginal = points.map((p) => ({
    x: p.x * originalToDisplayedScaleX,
    y: p.y * originalToDisplayedScaleY,
  }));

  let finalPointsOriginalScale = [];
  pointsOnRotatedOriginal.forEach((p) => {
    let x, y;
    if (rotationAngle === 90) {
      x = p.y;
      y = origH - p.x;
    } else if (rotationAngle === 180) {
      x = origW - p.x;
      y = origH - p.y;
    } else if (rotationAngle === 270) {
      x = origW - p.y;
      y = p.x;
    } else {
      x = p.x;
      y = p.y;
    }
    finalPointsOriginalScale.push(x, y);
  });

  const p0 = { x: finalPointsOriginalScale[0], y: finalPointsOriginalScale[1] },
    p1 = { x: finalPointsOriginalScale[2], y: finalPointsOriginalScale[3] };
  const p2 = { x: finalPointsOriginalScale[4], y: finalPointsOriginalScale[5] },
    p3 = { x: finalPointsOriginalScale[6], y: finalPointsOriginalScale[7] };
  const w1 = Math.hypot(p0.x - p1.x, p0.y - p1.y),
    w2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const h1 = Math.hypot(p0.x - p3.x, p0.y - p3.y),
    h2 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const outWidth = Math.round(Math.max(w1, w2)),
    outHeight = Math.round(Math.max(h1, h2));

  let src = cv.imread(originalImage);
  let srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, finalPointsOriginalScale);
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

  src.delete();
  M.delete();
  srcPoints.delete();
  dstPoints.delete();
  return dst;
}

// Para imagens únicas ou PDFs de página única
function processAndShowFinalResult() {
  try {
    const dst = getWarpedResult();

    if (correctedImageMat) {
      correctedImageMat.delete();
    }
    correctedImageMat = dst.clone(); // Armazena a imagem corrigida

    cv.imshow(resultCanvas, dst);
    dst.delete();

    const newFileNameBase = originalFileName.split(".").slice(0, -1).join(".");
    if (originalFileType === "application/pdf") {
      exportFilenameInput.value = `${newFileNameBase}-pagina-${currentEditingPageNum}-corrigido`;
      exportFormatSelect.value = "pdf";
      resultTitle.textContent = `Resultado (Página ${currentEditingPageNum})`;
    } else {
      exportFilenameInput.value = `${newFileNameBase}-corrigido`;
      exportFormatSelect.value = "png";
      resultTitle.textContent = `Resultado Corrigido`;
    }

    // MOSTRA OS ELEMENTOS DA TELA DE RESULTADO
    resultTitle.hidden = false;
    startOverButton.hidden = false;
    if (loadedPdf && totalPdfPages > 1) {
      editAnotherPageButton.classList.remove("hidden");
    } else {
      editAnotherPageButton.classList.add("hidden");
    }

    postProcessingToolbar.classList.remove("hidden");
    exportOptions.classList.remove("hidden");
    updateActiveFilterButton("none");

    mainContainer.classList.add("result-active"); // Ativa o layout largo
    editStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro no processamento do OpenCV:", error);
    alert("Ocorreu um erro ao processar a imagem. Tente novamente.");
  }
}

// Para páginas de um PDF de múltiplas páginas
function savePageAndReturnToThumbnails() {
  try {
    const dst = getWarpedResult();
    const tempCanvas = document.createElement("canvas");
    cv.imshow(tempCanvas, dst);
    const dataUrl = tempCanvas.toDataURL("image/png");

    editedPages.set(currentEditingPageNum, dataUrl);
    updateThumbnail(currentEditingPageNum, dataUrl);

    dst.delete();

    editStep.classList.add("hidden");
    pdfPreviewStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro ao salvar página:", error);
    alert("Não foi possível salvar as alterações desta página.");
  }
}

async function buildAndDownloadFinalPdf() {
  opencvStatus.textContent = "Construindo PDF final...";
  uploadStep.classList.remove("hidden");
  pdfPreviewStep.classList.add("hidden");

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    pdf.deletePage(1); // Começa com um PDF em branco

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    for (let pageNum = 1; pageNum <= totalPdfPages; pageNum++) {
      opencvStatus.textContent = `Processando página ${pageNum}/${totalPdfPages}...`;
      let dataUrl;
      if (editedPages.has(pageNum)) {
        dataUrl = editedPages.get(pageNum);
      } else {
        const page = await loadedPdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport })
          .promise;
        dataUrl = canvas.toDataURL("image/png");
      }
      const img = await loadImage(dataUrl);
      const w = img.width;
      const h = img.height;
      const orientation = w > h ? "l" : "p";
      pdf.addPage([w, h], orientation);
      pdf.addImage(img, "PNG", 0, 0, w, h, undefined, "FAST");
    }

    const newFileNameBase = originalFileName.split(".").slice(0, -1).join(".");
    pdf.save(`${newFileNameBase}-editado.pdf`);
    resetToUploadScreen();
  } catch (error) {
    console.error("Erro ao construir PDF final:", error);
    alert("Ocorreu um erro ao gerar o PDF final.");
    resetToUploadScreen();
  }
}

function handleExport() {
  // ... (código existente sem alterações)
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
    const link = document.createElement("a");
    link.href = resultCanvas.toDataURL("image/png");
    link.download = `${filename}.png`;
    link.click();
    setTimeout(() => link.remove(), 100);
  }
}

// --- 5. Lógica de Pós-Processamento (Filtros) ---
function updateActiveFilterButton(activeFilter) {
  currentFilter = activeFilter;
  document
    .querySelectorAll(".filter-button")
    .forEach((btn) => btn.classList.remove("active"));

  const buttonMap = {
    none: filterNoneButton,
    bw: filterBwButton,
    contrast: filterContrastButton,
    sharpen: filterSharpenButton,
  };

  if (buttonMap[activeFilter]) {
    buttonMap[activeFilter].classList.add("active");
  }

  if (
    activeFilter === "bw" ||
    activeFilter === "contrast" ||
    activeFilter === "sharpen"
  ) {
    intensitySlider.value = 50;
    sliderValue.textContent = "50%";
    sliderContainer.classList.remove("hidden");
  } else {
    sliderContainer.classList.add("hidden");
  }
  applyPostProcessingEffects();
}

function applyPostProcessingEffects() {
  if (!correctedImageMat || correctedImageMat.isDeleted()) return;

  let matToDisplay;
  try {
    if (currentFilter === "bw") {
      matToDisplay = new cv.Mat();
      let gray = new cv.Mat();
      cv.cvtColor(correctedImageMat, gray, cv.COLOR_RGBA2GRAY);
      // Mapeia o slider (0-100) para o parâmetro C (15 a -5)
      // Intensidade maior (100) => C=-5 (mais detalhes, mais "preto")
      // Intensidade menor (0) => C=15 (menos detalhes, mais "branco")
      const C = 15 - (parseInt(intensitySlider.value, 10) / 100) * 20;
      cv.adaptiveThreshold(
        gray,
        matToDisplay,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11,
        C
      );
      gray.delete();
    } else if (currentFilter === "contrast") {
      // Mapeia o slider (0-100) para o alpha (contraste) (1.0 a 3.0)
      const alpha = 1.0 + (parseInt(intensitySlider.value, 10) / 100) * 2.0;
      matToDisplay = new cv.Mat();
      correctedImageMat.convertTo(matToDisplay, -1, alpha, 0); // beta=0
    } else if (currentFilter === "sharpen") {
      let sharpened = new cv.Mat();
      // Basic sharpen kernel
      let kernel = cv.matFromArray(
        3,
        3,
        cv.CV_32F,
        [0, -1, 0, -1, 5, -1, 0, -1, 0]
      );
      cv.filter2D(
        correctedImageMat,
        sharpened,
        cv.CV_8U,
        kernel,
        new cv.Point(-1, -1),
        0,
        cv.BORDER_DEFAULT
      );

      // Blend the sharpened image with the original based on the slider
      const alpha = parseInt(intensitySlider.value, 10) / 100; // Sharpened image weight
      const beta = 1.0 - alpha; // Original image weight

      matToDisplay = new cv.Mat();
      cv.addWeighted(
        sharpened,
        alpha,
        correctedImageMat,
        beta,
        0,
        matToDisplay,
        -1
      );

      sharpened.delete();
      kernel.delete();
    } else {
      // 'none'
      matToDisplay = correctedImageMat.clone();
    }
    cv.imshow(resultCanvas, matToDisplay);
  } catch (e) {
    console.error("Error applying filter", e);
    // Fallback para a imagem original corrigida em caso de erro
    if (correctedImageMat && !correctedImageMat.isDeleted()) {
      cv.imshow(resultCanvas, correctedImageMat);
    }
  } finally {
    if (matToDisplay && !matToDisplay.isDeleted()) {
      matToDisplay.delete();
    }
  }
}

// --- 6. Lógica dos Botões de Ação ---

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
  editedPages.clear();
  if (correctedImageMat && !correctedImageMat.isDeleted()) {
    correctedImageMat.delete();
    correctedImageMat = null;
  }
  currentFilter = "none";
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  const resultCtx = resultCanvas.getContext("2d");
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

  // ESCONDE TODAS AS ETAPAS E MOSTRA O UPLOAD
  resultStep.classList.add("hidden");
  editStep.classList.add("hidden");
  pdfPreviewStep.classList.add("hidden");
  uploadStep.classList.remove("hidden");

  // ESCONDE TODOS OS CONTROLES DA TELA DE RESULTADO
  postProcessingToolbar.classList.add("hidden");
  exportOptions.classList.add("hidden");
  sliderContainer.classList.add("hidden");
  finishAndDownloadButton.classList.add("hidden");
  resultTitle.hidden = true;
  startOverButton.hidden = true;
  editAnotherPageButton.classList.add("hidden");

  mainContainer.classList.remove("result-active"); // Desativa o layout largo
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
  if (e.target === modalOverlay) hideModal();
});

// --- Listeners Principais ---
resetButton.addEventListener("click", initializeCanvas);
cropButton.addEventListener("click", () => {
  if (loadedPdf && totalPdfPages > 1) {
    savePageAndReturnToThumbnails();
  } else {
    processAndShowFinalResult();
  }
});
rotateButton.addEventListener("click", rotateImage);
cancelButton.addEventListener("click", showModal);
startOverButton.addEventListener("click", resetToUploadScreen);
exportButton.addEventListener("click", handleExport);
cancelPdfPreviewButton.addEventListener("click", resetToUploadScreen);
finishAndDownloadButton.addEventListener("click", buildAndDownloadFinalPdf);

editAnotherPageButton.addEventListener("click", () => {
  mainContainer.classList.remove("result-active");
  resultStep.classList.add("hidden");
  pdfPreviewStep.classList.remove("hidden");
});

// Listeners dos Filtros
filterNoneButton.addEventListener("click", () =>
  updateActiveFilterButton("none")
);
filterBwButton.addEventListener("click", () => updateActiveFilterButton("bw"));
filterContrastButton.addEventListener("click", () =>
  updateActiveFilterButton("contrast")
);
filterSharpenButton.addEventListener("click", () =>
  updateActiveFilterButton("sharpen")
);

intensitySlider.addEventListener("input", () => {
  sliderValue.textContent = `${intensitySlider.value}%`;
  applyPostProcessingEffects();
});

filterRotateButton.addEventListener("click", () => {
  if (!correctedImageMat || correctedImageMat.isDeleted()) return;
  try {
    let rotatedMat = new cv.Mat();
    cv.rotate(correctedImageMat, rotatedMat, cv.ROTATE_90_CLOCKWISE);
    correctedImageMat.delete(); // Deleta a matriz antiga
    correctedImageMat = rotatedMat; // Atribui a nova
    applyPostProcessingEffects(); // Reaplica o filtro na imagem rotacionada
  } catch (e) {
    console.error("Error rotating image: ", e);
  }
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
